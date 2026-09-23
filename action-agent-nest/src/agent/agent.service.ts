// Agent 核心业务：创建会话（行动指数/劝说模式/神秘加成）、查询、历史、行为反馈
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskSession } from './entities/task-session.entity';
import { ActionRecord } from './entities/action-record.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { ActionRecordDto } from './dto/action-record.dto';
import { AnswerBookService } from './answerbook.service';
import { TarotService } from './tarot.service';
import { TodoService } from './todo.service';
import { LlmService } from './llm.service';
import { MemoryService } from '../memory/memory.service';
import { BehaviorMemoryService } from '../memory/behavior-memory.service';
import { LlmMemoryService } from '../memory/llm-memory.service';
import { UserMemory } from '../memory/entities/user-memory.entity';
import { buildFeedbackReplyPrompt } from './agent.prompt';

// 劝说模式文案（规则 fallback 用），key 与前端 PersuadeMode 联合类型完全对齐
const PERSUADE_TEXTS: Record<string, string> = {
  温柔劝说模式: '没关系，慢慢来。完成比完美更重要，先迈出第一步。',
  激将模式: '你不是一直说要做吗？现在退缩，下一秒就会后悔。',
  理性分析模式: '综合意愿、精力与重要度评估，当前行动收益高于拖延成本，建议执行。',
};

// 塔罗第三方接口不可用时的本地兜底牌面
const FALLBACK_TAROT = ['愚人', '魔术师', '女祭司', '皇后', '皇帝', '教皇', '恋人', '战车', '力量', '隐者', '命运之轮', '正义', '倒吊人', '死神', '节制', '恶魔', '塔', '星星', '月亮', '太阳'];

@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(TaskSession)
    private readonly sessionRepo: Repository<TaskSession>,
    @InjectRepository(ActionRecord)
    private readonly recordRepo: Repository<ActionRecord>,
    private readonly answerBookService: AnswerBookService,
    private readonly tarotService: TarotService,
    private readonly todoService: TodoService,
    private readonly llmService: LlmService,
    private readonly memoryService: MemoryService,
    private readonly behaviorMemoryService: BehaviorMemoryService,
    private readonly llmMemoryService: LlmMemoryService,
  ) {}

  /** 创建会话：取历史 → 保存任务 → 计算建议 → 神秘加成 → 保存会话 */
  async createSession(userId: number, dto: CreateSessionDto) {
    // 0. 先取历史行为摘要（在保存本次任务之前，确保只含"过去"、不含本次）。
    //    同一份摘要既喂给 LLM 做个性化建议，也用于结果页展示，避免重复查询。
    const historySummary = await this.buildHistorySummary(userId, dto.category);

    // 1. 保存任务输入
    const task = this.taskRepo.create({
      userId,
      taskContent: dto.taskContent,
      category: dto.category,
      willScore: dto.willScore,
      energyScore: dto.energyScore,
      importance: dto.importance,
      expectCostMin: dto.expectCostMin ?? null,
      deadline: dto.deadline ?? null,
      location: dto.location ?? '',
      enableTarot: !!dto.enableTarot,
      enableAnswerBook: dto.enableAnswerBook !== false,
      extraContext: dto.extraContext?.trim() ?? '',
    });
    const savedTask = await this.taskRepo.save(task);

    // 2. 读取用户长期记忆（3.3），与历史摘要一起喂给 LLM；无记忆时为空串、不影响原流程
    const memoryText = await this.buildMemoryText(userId);

    // 3. 调 DeepSeek LLM 生成建议（带入历史行为 + 长期记忆；失败时 fallback 到规则计算）
    const advice = await this.generateAdvice(dto, historySummary, memoryText);
    const { agentSuggestIndex, conclusion, persuadeMode, persuadeText, minAction } = advice;

    // 4. 神秘加成：答案之书
    let answerBook: string | null = null;
    if (dto.enableAnswerBook !== false) {
      answerBook = await this.answerBookService.ask(dto.taskContent);
    }

    // 5. 神秘加成：塔罗牌（第三方失败时本地随机兜底）
    let tarotCards: string[] | undefined;
    if (dto.enableTarot) {
      const result = await this.tarotService.draw(5);
      if (result?.cards?.length) {
        tarotCards = result.cards.map((c) => `${c.cardName} · ${c.orientation}`);
      } else {
        const name = FALLBACK_TAROT[Math.floor(Math.random() * FALLBACK_TAROT.length)];
        tarotCards = [`${name} · ${Math.random() > 0.5 ? '正位' : '逆位'}`];
      }
    }

    // 6. 保存会话（historySummary 在读取时动态生成，不存固定值）
    const session = this.sessionRepo.create({
      taskId: savedTask.id,
      agentSuggestIndex,
      conclusion,
      persuadeMode,
      persuadeText,
      minAction,
      taroCard: tarotCards ? tarotCards[0] : null,
      tarotCards: tarotCards ? JSON.stringify(tarotCards) : null,
      answerBook,
    });
    const savedSession = await this.sessionRepo.save(session);

    // 复用开头算好的历史摘要（给 SessionResult 页面展示），不再重复查询
    return this.toSessionRes(savedSession, tarotCards, answerBook, historySummary);
  }

  /** 会话详情（校验归属） */
  async getSession(userId: number, sessionId: number) {
    const session = await this.findOwnedSession(userId, sessionId);
    return this.toSessionRes(session);
  }

  /** 历史会话列表（首页卡片 + 统计共用，返回完整详情数组） */
  async listSessions(userId: number) {
    const sessions = await this.sessionRepo.find({
      relations: { task: true },
      order: { createdAt: 'DESC' },
    });
    const mine = sessions.filter((s) => s.task?.userId === userId);

    const records = mine.length
      ? await this.recordRepo.find({
          where: { sessionId: In(mine.map((s) => s.id)) },
        })
      : [];

    // 每条会话动态计算 historySummary（反映用户当前真实历史状态）
    const details = await Promise.all(
      mine.map(async (s) => {
        const dynamicSummary = await this.buildHistorySummary(userId, s.task.category);
        return this.toHistoryDetail(s, records.find((r) => r.sessionId === s.id) ?? null, dynamicSummary);
      }),
    );
    return details;
  }

  /** 历史详情（校验归属） */
  async getHistory(userId: number, sessionId: number) {
    const session = await this.findOwnedSession(userId, sessionId);
    const record = await this.recordRepo.findOne({ where: { sessionId } });
    const dynamicSummary = await this.buildHistorySummary(userId, session.task.category);
    return this.toHistoryDetail(session, record ?? null, dynamicSummary);
  }

  /** 提交/更新行为反馈（按会话 upsert，校验归属）；写入后异步对齐长期记忆（3.4） */
  async submitRecord(userId: number, dto: ActionRecordDto) {
    const session = await this.findOwnedSession(userId, dto.sessionId);

    let record = await this.recordRepo.findOne({ where: { sessionId: dto.sessionId } });
    // 评论只在"做出决定"的那次反馈（comment 字段显式给出）写入；计划表勾选执行的回写不带它，保留原评论
    const comment = dto.comment !== undefined ? dto.comment.trim() || null : undefined;
    if (record) {
      record.userAcceptSuggest = dto.userAcceptSuggest;
      record.isExecute = dto.isExecute;
      record.actualCostMin = dto.actualCostMin;
      record.executeResult = dto.executeResult ?? '';
      if (comment !== undefined) record.feedbackComment = comment;
    } else {
      record = this.recordRepo.create({
        sessionId: dto.sessionId,
        userAcceptSuggest: dto.userAcceptSuggest,
        isExecute: dto.isExecute,
        actualCostMin: dto.actualCostMin,
        executeResult: dto.executeResult ?? '',
        feedbackComment: comment ?? null,
        agentReply: null,
      });
    }

    // 用户做出接受/拒绝决定时：把 态度 + 是否入计划表 + 评论 打包，二次调用 LLM 生成一句回应。
    // 仅 withReply=true 的请求触发（计划表执行回写不触发）；失败用本地兜底文案，绝不影响反馈主流程。
    if (dto.withReply === true) {
      record.agentReply = await this.generateFeedbackReply(
        session,
        dto.userAcceptSuggest,
        dto.addToTodo === true,
        comment ?? '',
      );
    }

    const saved = await this.recordRepo.save(record);

    // 3.4 附加逻辑：按本类别的真实反馈重算并对齐长期记忆（失败只记日志，不影响反馈返回）
    await this.behaviorMemoryService.syncFromFeedback(userId, session.task.category);

    // 3.5 附加逻辑：异步让 LLM 从长期行为提炼稳定偏好写回记忆（fire-and-forget，
    // 服务内 10 分钟节流 + 样本下限，失败只记日志，不阻塞反馈返回）
    void this.llmMemoryService.maybeExtractFromBehavior(userId);

    return this.toRecordRes(saved);
  }

  /** 删除会话记录：删关联待办 → 删反馈 → 删会话 → 删任务（含归属校验） */
  async deleteSession(userId: number, sessionId: number) {
    const session = await this.findOwnedSession(userId, sessionId);
    const taskId = session.task.id;
    const category = session.task.category;

    // 由该会话加入计划表的待办一并删除
    await this.todoService.deleteBySession(sessionId);
    // 显式按顺序删除，不依赖外键级联时序
    await this.recordRepo.delete({ sessionId });
    await this.sessionRepo.delete(sessionId);
    await this.taskRepo.delete(taskId);

    // 3.4：派生记忆随样本变化重算（样本归零则回收该类别受管记忆）
    await this.behaviorMemoryService.syncFromFeedback(userId, category);

    return { success: true };
  }

  /** 批量删除：一次查出归属会话，批量删除 待办→反馈→会话→任务；任一 id 不存在/不归属即拒绝 */
  async deleteSessions(userId: number, ids: number[]) {
    const uniqueIds = [...new Set(ids)];
    const sessions = await this.sessionRepo.find({
      where: { id: In(uniqueIds) },
      relations: { task: true },
    });

    const owned = sessions.filter((s) => s.task && s.task.userId === userId);
    if (owned.length !== uniqueIds.length) {
      throw new ForbiddenException('包含无权访问或不存在的会话，已取消删除');
    }

    const sessionIds = owned.map((s) => s.id);
    const taskIds = owned.map((s) => s.task.id);
    const categories = [...new Set(owned.map((s) => s.task.category))];
    await this.todoService.deleteBySessions(sessionIds);
    await this.recordRepo.delete({ sessionId: In(sessionIds) });
    await this.sessionRepo.delete(sessionIds);
    await this.taskRepo.delete(taskIds);

    // 3.4：受影响类别的派生记忆逐一重算
    for (const category of categories) {
      await this.behaviorMemoryService.syncFromFeedback(userId, category);
    }

    return { success: true, deleted: sessionIds.length };
  }

  /** 生成建议：优先 DeepSeek LLM（带入历史行为 + 长期记忆），失败 fallback 到规则计算 */
  private async generateAdvice(
    dto: CreateSessionDto,
    historySummary?: string,
    memoryText?: string,
  ) {
    const llm = await this.llmService.generateAdvice(dto, historySummary, memoryText);
    if (llm) {
      return llm;
    }
    return this.computeAdviceByRule(dto);
  }

  /**
   * 用户决定后的二次回复：态度 + 是否入计划表 + 评论打包给 LLM 生成一句话。
   * LLM 不可用时按接受/拒绝走本地兜底文案，保证前端总有回应。
   */
  private async generateFeedbackReply(
    session: TaskSession,
    accepted: boolean,
    addToTodo: boolean,
    comment: string,
  ): Promise<string> {
    const messages = buildFeedbackReplyPrompt({
      taskContent: session.task.taskContent,
      category: session.task.category,
      conclusion: session.conclusion,
      persuadeMode: session.persuadeMode,
      persuadeText: session.persuadeText,
      minAction: session.minAction,
      accepted,
      addToTodo,
      comment,
    });
    const reply = await this.llmService.chatText(messages, 0.7);
    if (reply) return reply;
    if (!accepted) return '好，那就先按你自己的节奏来，下次纠结随时找我。';
    return addToTodo
      ? '决定了就别反悔，按最小行动先开始第一步，我在这儿等你的完成打卡。'
      : '行，说走就走，先行动起来吧。';
  }

  /**
   * 读取用户长期记忆并格式化为 Prompt 文本（3.3）。
   * 按置信度倒序取 top10，每行一条 "- {content}"；无记忆返回空串。
   * MySQL decimal 经驱动返回可能是 string，统一 Number 化再排序。
   */
  private async buildMemoryText(userId: number): Promise<string> {
    const memories = await this.memoryService.list(userId);
    if (!memories.length) return '';
    return this.formatMemoryText(memories);
  }

  /** 纯函数：记忆实体列表 → Prompt 片段（与 buildMemoryText 分开，方便后续 3.4/3.5 复用） */
  private formatMemoryText(memories: UserMemory[]): string {
    const top = [...memories]
      .sort((a, b) => Number(b.confidence) - Number(a.confidence))
      .slice(0, 10);
    return top.map((m) => `- ${m.content}`).join('\n');
  }

  /** 规则兜底：LLM 不可用时使用（保留原规则逻辑） */
  private computeAdviceByRule(dto: CreateSessionDto) {
    const base = dto.willScore * 5 + dto.energyScore * 3 + dto.importance * 2;
    const agentSuggestIndex = Math.max(
      5,
      Math.min(98, Math.round(base + (dto.willScore - 5) * 2)),
    );

    // 劝说模式只按指数分档；塔罗/答案之书是附加展示，不影响劝说模式
    let persuadeMode = '理性分析模式';
    if (agentSuggestIndex < 40) {
      persuadeMode = '激将模式';
    } else if (agentSuggestIndex < 70) {
      persuadeMode = '温柔劝说模式';
    }

    const shouldGo = agentSuggestIndex >= 50;
    const conclusion = shouldGo ? '去做，趁现在状态在线' : '暂缓，今天不建议强行做';
    const minAction = shouldGo
      ? `先做 5 分钟：${dto.taskContent.slice(0, 12)}…`
      : '今天先记录下来，明天再启动。';

    return {
      agentSuggestIndex,
      shouldGo,
      conclusion,
      persuadeMode,
      persuadeText: PERSUADE_TEXTS[persuadeMode],
      minAction,
    };
  }

  /**
   * 动态生成历史行为摘要（喂 LLM + 结果页展示，不入库）。
   * 方案 B：在「次数/执行率」之外增加跨维度规律——意愿/精力/重要度/耗时 与执行率的关联，
   * 以及「接受却没执行」。规律仅在样本足够（每组 ≥2）且差异显著（≥25 个百分点）时输出，避免小样本噪声。
   */
  private async buildHistorySummary(userId: number, currentCategory: string): Promise<string> {
    const categoryLabelMap: Record<string, string> = {
      work: '工作',
      study: '学习',
      life: '生活',
      shopping: '购物',
      health: '健康',
      social: '社交',
      other: '其他',
    };
    const categoryLabel = categoryLabelMap[currentCategory] ?? currentCategory;

    // 最近 50 个会话 + 其反馈，一次查全（createSession 在保存本次之前调用，故天然不含本次）
    const sessions = await this.sessionRepo.find({
      relations: { task: true },
      where: { task: { userId } },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    if (sessions.length === 0) {
      return '这是你的第一个任务，开启行动之旅吧。';
    }

    const records = await this.recordRepo.find({
      where: { sessionId: In(sessions.map((s) => s.id)) },
    });
    const recMap = new Map(records.map((r) => [r.sessionId, r]));
    // 有反馈的样本（携带任务字段，供跨维度统计）
    const samples = sessions
      .map((s) => ({ task: s.task, rec: s.task ? recMap.get(s.id) : undefined }))
      .filter((x): x is { task: Task; rec: ActionRecord } => !!x.task && !!x.rec);

    if (samples.length === 0) {
      return `你累计创建了 ${sessions.length} 个任务，但还没有记录执行反馈，开始记录真实行为吧。`;
    }

    const rateOf = (list: typeof samples) =>
      Math.round((list.filter((x) => x.rec.isExecute).length / list.length) * 100);

    const sentences: string[] = [];

    // 1) 整体执行率
    sentences.push(`你累计 ${sessions.length} 个任务，${samples.length} 次已反馈，整体执行率 ${rateOf(samples)}%`);

    // 2) 同类任务（含未反馈计数，累计 ≥3 次才提）
    const sameAll = sessions.filter((s) => s.task?.category === currentCategory);
    const sameSamples = samples.filter((x) => x.task.category === currentCategory);
    if (sameAll.length >= 3) {
      let t = `其中${categoryLabel}类任务 ${sameAll.length} 次`;
      if (sameSamples.length > 0) {
        t += `，已反馈 ${sameSamples.length} 次、执行率 ${rateOf(sameSamples)}%`;
      }
      sentences.push(t);
    }

    // 3) 跨维度规律：每组样本 ≥2 且执行率差 ≥25pp 才算显著，按差异取 top3
    const insights: { diff: number; text: string }[] = [];
    const compareDim = (
      name: string,
      hi: (t: Task) => boolean,
      lo: (t: Task) => boolean,
      hiLabel: string,
      loLabel: string,
    ) => {
      const gHi = samples.filter((x) => hi(x.task));
      const gLo = samples.filter((x) => lo(x.task));
      if (gHi.length < 2 || gLo.length < 2) return;
      const rHi = rateOf(gHi);
      const rLo = rateOf(gLo);
      const diff = rHi - rLo;
      if (Math.abs(diff) < 25) return;
      const text =
        diff > 0
          ? `${name}${hiLabel}时执行率 ${rHi}%，明显高于${loLabel}时的 ${rLo}%`
          : `${name}${loLabel}时执行率 ${rLo}%，明显高于${hiLabel}时的 ${rHi}%`;
      insights.push({ diff: Math.abs(diff), text });
    };

    compareDim('意愿', (t) => t.willScore >= 7, (t) => t.willScore <= 4, '高(≥7)', '低(≤4)');
    compareDim('精力', (t) => t.energyScore >= 7, (t) => t.energyScore <= 4, '充沛(≥7)', '不足(≤4)');
    compareDim('重要度', (t) => t.importance >= 8, (t) => t.importance <= 4, '高(≥8)', '低(≤4)');
    compareDim(
      '预计耗时',
      (t) => (t.expectCostMin ?? 0) >= 60,
      (t) => !!t.expectCostMin && t.expectCostMin < 60,
      '长(≥60分钟)',
      '短(<60分钟)',
    );

    // 「接受建议却没真正执行」规律
    const accepted = samples.filter((x) => x.rec.userAcceptSuggest);
    const acceptedNotDone = accepted.filter((x) => !x.rec.isExecute);
    if (accepted.length >= 3 && acceptedNotDone.length >= 2) {
      insights.push({
        diff: 100,
        text: `接受过 ${accepted.length} 次建议，其中 ${acceptedNotDone.length} 次没有真正执行，容易“答应下来却不动手”`,
      });
    }

    if (insights.length > 0) {
      const top = insights
        .sort((a, b) => b.diff - a.diff)
        .slice(0, 3)
        .map((i) => i.text);
      sentences.push(`行为规律：${top.join('；')}`);
    }

    return `${sentences.join('；')}。`;
  }

  /** 查询会话并校验属于当前用户 */
  private async findOwnedSession(userId: number, sessionId: number): Promise<TaskSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: { task: true },
    });
    if (!session || !session.task) {
      throw new NotFoundException('会话不存在');
    }
    if (session.task.userId !== userId) {
      throw new ForbiddenException('无权访问该会话');
    }
    return session;
  }

  /** TaskSession 实体 → 前端 AgentSessionRes */
  private toSessionRes(
    s: TaskSession,
    parsedCards?: string[],
    answer?: string | null,
    dynamicSummary?: string,
  ) {
    const tarotCards =
      parsedCards ?? (s.tarotCards ? (JSON.parse(s.tarotCards) as string[]) : undefined);
    return {
      sessionId: s.id,
      agentSuggestIndex: s.agentSuggestIndex,
      conclusion: s.conclusion,
      persuadeMode: s.persuadeMode,
      persuadeText: s.persuadeText,
      minAction: s.minAction,
      taroCard: s.taroCard ?? undefined,
      tarotCards,
      answerBook: answer !== undefined ? answer ?? undefined : s.answerBook ?? undefined,
      historySummary: dynamicSummary ?? s.historySummary,
    };
  }

  /** 实体组装 → 前端 HistoryDetail */
  private toHistoryDetail(s: TaskSession, record: ActionRecord | null, dynamicSummary?: string) {
    return {
      session: this.toSessionRes(s, undefined, undefined, dynamicSummary),
      task: {
        taskContent: s.task.taskContent,
        category: s.task.category,
        willScore: s.task.willScore,
        energyScore: s.task.energyScore,
        importance: s.task.importance,
        expectCostMin: s.task.expectCostMin,
        deadline: s.task.deadline,
        location: s.task.location,
        enableTarot: s.task.enableTarot,
        enableAnswerBook: s.task.enableAnswerBook,
        extraContext: s.task.extraContext,
      },
      record: record ? this.toRecordRes(record) : null,
      createdAt: s.createdAt.toISOString(),
    };
  }

  /** ActionRecord 实体 → 前端 ActionRecord */
  private toRecordRes(r: ActionRecord) {
    return {
      recordId: r.id,
      sessionId: r.sessionId,
      userAcceptSuggest: r.userAcceptSuggest,
      isExecute: r.isExecute,
      actualCostMin: r.actualCostMin,
      executeResult: r.executeResult ?? '',
      feedbackComment: r.feedbackComment ?? '',
      agentReply: r.agentReply ?? '',
      createdAt: r.createdAt.toISOString(),
    };
  }
}
