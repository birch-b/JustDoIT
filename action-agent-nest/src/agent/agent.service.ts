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
  ) {}

  /** 创建会话：保存任务 → 计算建议 → 神秘加成 → 保存会话 */
  async createSession(userId: number, dto: CreateSessionDto) {
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
    });
    const savedTask = await this.taskRepo.save(task);

    // 2. 调 DeepSeek LLM 生成建议（失败时 fallback 到规则计算）
    const advice = await this.generateAdvice(dto);
    const { agentSuggestIndex, conclusion, persuadeMode, persuadeText, minAction } = advice;

    // 3. 神秘加成：答案之书
    let answerBook: string | null = null;
    if (dto.enableAnswerBook !== false) {
      answerBook = await this.answerBookService.ask(dto.taskContent);
    }

    // 4. 神秘加成：塔罗牌（第三方失败时本地随机兜底）
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

    // 5. 保存会话（historySummary 在读取时动态生成，不存固定值）
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

    // 返回前动态算一次（给 SessionResult 页面展示）
    const historySummary = await this.buildHistorySummary(userId, dto.category);
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

  /** 提交/更新行为反馈（按会话 upsert，校验归属） */
  async submitRecord(userId: number, dto: ActionRecordDto) {
    await this.findOwnedSession(userId, dto.sessionId);

    let record = await this.recordRepo.findOne({ where: { sessionId: dto.sessionId } });
    if (record) {
      record.userAcceptSuggest = dto.userAcceptSuggest;
      record.isExecute = dto.isExecute;
      record.actualCostMin = dto.actualCostMin;
      record.executeResult = dto.executeResult ?? '';
    } else {
      record = this.recordRepo.create({
        sessionId: dto.sessionId,
        userAcceptSuggest: dto.userAcceptSuggest,
        isExecute: dto.isExecute,
        actualCostMin: dto.actualCostMin,
        executeResult: dto.executeResult ?? '',
      });
    }
    const saved = await this.recordRepo.save(record);
    return this.toRecordRes(saved);
  }

  /** 删除会话记录：删关联待办 → 删反馈 → 删会话 → 删任务（含归属校验） */
  async deleteSession(userId: number, sessionId: number) {
    const session = await this.findOwnedSession(userId, sessionId);
    const taskId = session.task.id;

    // 由该会话加入计划表的待办一并删除
    await this.todoService.deleteBySession(sessionId);
    // 显式按顺序删除，不依赖外键级联时序
    await this.recordRepo.delete({ sessionId });
    await this.sessionRepo.delete(sessionId);
    await this.taskRepo.delete(taskId);

    return { success: true };
  }

  /** 生成建议：优先 DeepSeek LLM，失败 fallback 到规则计算 */
  private async generateAdvice(dto: CreateSessionDto) {
    const llm = await this.llmService.generateAdvice(dto);
    if (llm) {
      return llm;
    }
    return this.computeAdviceByRule(dto);
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

  /** 动态生成历史行为摘要：查询用户真实会话 → 统计同类任务执行情况 */
  private async buildHistorySummary(userId: number, currentCategory: string): Promise<string> {
    // 取该用户最近 50 个会话（不含刚创建的）
    const sessions = await this.sessionRepo.find({
      relations: { task: true },
      where: { task: { userId } },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    if (sessions.length === 0) {
      return '这是你的第一个任务，开启行动之旅吧。';
    }

    // 同类任务（category 相同）
    const sameCategory = sessions.filter((s) => s.task?.category === currentCategory);
    const compareList = sameCategory.length >= 3 ? sameCategory : sessions; // 同类不足 3 条则看全部

    const sessionIds = compareList.map((s) => s.id);
    const records = await this.recordRepo.find({ where: { sessionId: In(sessionIds) } });
    const hasFeedback = compareList.map((s) => records.find((r) => r.sessionId === s.id)).filter(Boolean) as ActionRecord[];
    const executedCount = hasFeedback.filter((r) => r.isExecute).length;
    const totalWithFeedback = hasFeedback.length;

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

    if (sameCategory.length >= 3) {
      // 有足够多的同类任务 → 聚焦同类
      if (totalWithFeedback === 0) {
        return `你有 ${sameCategory.length} 次${categoryLabel}类任务尚未记录执行反馈，开始记录吧。`;
      }
      const delayed = totalWithFeedback - executedCount;
      const suffix = delayed === 0 ? '全部执行' : delayed === 1 ? '1 次推迟后补做' : `${delayed} 次推迟后补做`;
      return `你过去 ${sameCategory.length} 次${categoryLabel}类任务中，${totalWithFeedback} 次已反馈，${executedCount} 次执行，${suffix}。`;
    } else {
      // 同类太少 → 看整体
      if (totalWithFeedback === 0) {
        return `你累计创建了 ${sessions.length} 个任务，开始记录执行反馈吧。`;
      }
      const rate = Math.round((executedCount / totalWithFeedback) * 100);
      return `你累计 ${sessions.length} 个任务，${totalWithFeedback} 次已反馈，执行率 ${rate}%。`;
    }
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
      createdAt: r.createdAt.toISOString(),
    };
  }
}
