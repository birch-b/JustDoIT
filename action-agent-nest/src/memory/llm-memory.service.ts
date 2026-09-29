// 3.5 LLM 记忆提炼服务：从用户长期行为中让 LLM 提炼"稳定偏好"，按 memoryKey upsert 回 user_memory
// 与 3.4 的分工：3.4 规则引擎按事实即时修正受管记忆；3.5 由 LLM 从事实中发现值得记住的东西
// 设计要点：
// - 反馈写入后异步触发（fire-and-forget），不阻塞接口返回；内存节流 10 分钟，避免频繁调 LLM
// - 样本下限 + prompt 严格约束防过度推断；输出经白名单校验后才入库，最多 3 条/次
// - 只写 memoryKey 非空的行（按 key upsert），手动记忆与 3.4 受管记忆一律不动
// - 任何失败只记日志，绝不影响主流程
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserMemory } from './entities/user-memory.entity';
import { TaskSession } from '../agent/entities/task-session.entity';
import { ActionRecord } from '../agent/entities/action-record.entity';
import { LlmService } from '../agent/llm.service';
import { buildInsightPrompt, buildMemorySummaryPrompt, LlmMemoryInsight } from './memory-insight.prompt';
import { MEMORY_TYPES } from './dto/create-memory.dto';

/** 行为样本少于该数不调 LLM（证据不足，防过度推断） */
const MIN_SAMPLES_FOR_LLM = 5;
/** 同一用户两次提炼的最小间隔（内存节流，重启即重置） */
const THROTTLE_MS = 10 * 60 * 1000;
/** 单次最多提炼条数（prompt 同步约束，这里做硬校验） */
const MAX_INSIGHTS_PER_RUN = 3;
/** memoryKey 受管记忆的存量上限，超出时回收最旧的（防止长期漂移累积） */
const MAX_LLM_MEMORIES = 12;
const AGGREGATE_LIMIT = 50;
/** key 规范：小写字母开头的 snake_case */
const KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;
/** keyword 规范：3~5 个汉字（LLM 偶发不返回时允许为 null，记忆本体仍保留） */
const KEYWORD_PATTERN = /^[\u4e00-\u9fa5]{3,5}$/;
const VALUE_MAX_LEN = 200;

const CATEGORY_LABELS: Record<string, string> = {
  work: '工作',
  study: '学习',
  life: '生活',
  shopping: '购物',
  health: '健康',
  social: '社交',
  other: '其他',
};

/** 字符 bigram Dice 相似度：中文短句去重的轻量实现 */
function diceSimilarity(a: string, b: string): number {
  const grams = (s: string) => {
    const clean = s.replace(/\s+/g, '');
    const set = new Set<string>();
    for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
    return set;
  };
  const A = grams(a);
  const B = grams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/** 综合论述单次生成结果上限（与 prompt 的 70~150 字对齐，留余量） */
const SUMMARY_MAX_LEN = 200;
/** 综合论述缓存有效期：统计页频繁打开也不重复调 LLM；记忆内容变化时哈希失效立即重算 */
const SUMMARY_TTL_MS = 30 * 60 * 1000;

interface SummaryCacheEntry {
  hash: string;
  text: string;
  at: number;
}

@Injectable()
export class LlmMemoryService {
  private readonly logger = new Logger(LlmMemoryService.name);
  /** userId → 上次提炼时间戳 */
  private readonly lastRunAt = new Map<number, number>();
  /** userId → 综合论述缓存（内存级，重启即重置） */
  private readonly summaryCache = new Map<number, SummaryCacheEntry>();

  constructor(
    @InjectRepository(UserMemory)
    private readonly memoryRepo: Repository<UserMemory>,
    @InjectRepository(TaskSession)
    private readonly sessionRepo: Repository<TaskSession>,
    @InjectRepository(ActionRecord)
    private readonly recordRepo: Repository<ActionRecord>,
    private readonly llmService: LlmService,
  ) {}

  /**
   * 节流入口：行为反馈写入后调用。间隔内重复调用直接跳过；先占位再执行，防止并发重复提炼。
   * 内部全量 try/catch，调用方可 fire-and-forget。
   */
  async maybeExtractFromBehavior(userId: number): Promise<void> {
    const now = Date.now();
    const last = this.lastRunAt.get(userId) ?? 0;
    if (now - last < THROTTLE_MS) return;
    this.lastRunAt.set(userId, now);
    try {
      const { stored, llmCount, reason } = await this.extractAndStore(userId);
      if (reason === 'insufficient_samples') {
        this.logger.log(`用户 ${userId} 记忆提炼跳过：行为样本不足 ${MIN_SAMPLES_FOR_LLM} 条，未调用 LLM`);
      } else {
        this.logger.log(
          `用户 ${userId} 记忆提炼完成：LLM 返回 ${llmCount} 条，去重后入库 ${stored} 条`,
        );
      }
    } catch (e) {
      this.logger.error(`LLM 记忆提炼失败: ${(e as Error).message}`);
    }
  }

  /**
   * 统计页综合论述：把用户全部记忆交给 LLM 揉成一段整体画像（区别于前端只取 top1 单侧面）。
   * - 无记忆 → null（前端显示引导文案）
   * - 记忆内容/数量未变且 30 分钟内生成过 → 用缓存，避免反复调 LLM
   * - LLM 失败 → null，由前端兜底回 top1 记忆原文
   */
  async getOverallSummary(userId: number): Promise<string | null> {
    const memories = await this.memoryRepo.find({ where: { userId } });
    if (!memories.length) return null;

    // 缓存键：记忆 id+内容+置信度+keyword 的指纹，任何一条变化都重新生成
    const hash = memories
      .map((m) => `${m.id}:${m.content}:${m.confidence}:${m.keyword ?? ''}`)
      .sort()
      .join('|');
    const cached = this.summaryCache.get(userId);
    const now = Date.now();
    if (cached && cached.hash === hash && now - cached.at < SUMMARY_TTL_MS) {
      return cached.text;
    }

    const raw = await this.llmService.chatJson(buildMemorySummaryPrompt(memories), 0.6);
    const text = typeof raw?.summary === 'string' ? raw.summary.replace(/\s+/g, ' ').trim() : '';
    if (!text) return null;

    const clipped = text.slice(0, SUMMARY_MAX_LEN);
    this.summaryCache.set(userId, { hash, text: clipped, at: now });
    return clipped;
  }

  /** 提炼主流程：聚合行为 → 调 LLM → 校验 → 按 key upsert → 回收超限；返回入库条数与 LLM 原始条数 */
  async extractAndStore(userId: number): Promise<{
    stored: number;
    llmCount: number;
    reason?: 'insufficient_samples';
  }> {
    // 1. 聚合最近行为流水（会话 + 反馈），样本不足直接跳过，省一次 LLM 调用
    const sessions = await this.sessionRepo.find({
      relations: { task: true },
      where: { task: { userId } },
      order: { createdAt: 'DESC' },
      take: AGGREGATE_LIMIT,
    });
    const records = sessions.length
      ? await this.recordRepo.find({
          where: { sessionId: In(sessions.map((s) => s.id)) },
        })
      : [];
    const recMap = new Map(records.map((r) => [r.sessionId, r]));
    const behaviorLines = sessions
      .map((s) => {
        const rec = s.task ? recMap.get(s.id) : undefined;
        return s.task && rec ? this.toBehaviorLine(s.task, rec) : null;
      })
      .filter((x): x is string => !!x);
    if (behaviorLines.length < MIN_SAMPLES_FOR_LLM) {
      return { stored: 0, llmCount: 0, reason: 'insufficient_samples' };
    }

    // 2. 已有记忆一并交给 LLM，prompt 要求主题相同时复用原 key
    const existing = await this.memoryRepo.find({ where: { userId } });

    // 3. 调 LLM 提炼（temperature 低一些，输出更稳定）；失败/解析失败返回 null
    const raw = await this.llmService.chatJson(
      buildInsightPrompt(behaviorLines, existing),
      0.2,
    );
    const insights = this.validateInsights(raw);
    if (!insights.length) return { stored: 0, llmCount: 0 };

    // 4. 服务端兜底去重：与任一【不同 key 的】已有记忆内容高度相似（字符 bigram Dice ≥ 0.6）丢弃，
    //    防止 LLM 用新 key 输出与 3.4 受管记忆语义重复的记忆。
    //    注意：同 key 是"更新已有记忆"（prompt 第 4 条要求复用 key 改写 value/keyword），
    //    新 value 与旧 content 必然相似，绝不能参与相似度去重，否则老记忆永远无法被改写。
    const existingKeys = new Set(existing.filter((m) => m.memoryKey).map((m) => m.memoryKey));
    const similarToOtherKey = (key: string, value: string) =>
      existing.some((m) => m.memoryKey !== key && diceSimilarity(value, m.content) >= 0.6);
    const deduped = insights.filter(
      (i) => existingKeys.has(i.key) || !similarToOtherKey(i.key, i.value),
    );

    // 5. 按 memoryKey upsert（只碰 memoryKey 受管行）
    const existingByKey = new Map(
      existing.filter((m) => m.memoryKey).map((m) => [m.memoryKey as string, m]),
    );
    let stored = 0;
    for (const insight of deduped) {
      const target = existingByKey.get(insight.key);
      if (target) {
        if (
          target.content !== insight.value ||
          Number(target.confidence) !== insight.confidence ||
          target.keyword !== insight.keyword
        ) {
          target.content = insight.value;
          target.confidence = insight.confidence;
          // LLM 返回合法 keyword 才覆盖；本次未返回则保留旧值
          if (insight.keyword) target.keyword = insight.keyword;
          await this.memoryRepo.save(target);
          stored++;
        }
      } else {
        const created = this.memoryRepo.create({
          userId,
          memoryType: insight.memoryType,
          content: insight.value,
          keyword: insight.keyword,
          confidence: insight.confidence,
          memoryKey: insight.key,
        });
        await this.memoryRepo.save(created);
        existingByKey.set(insight.key, created);
        stored++;
      }
    }

    // 6. 存量上限回收：memoryKey 受管记忆超过上限时删最旧的（按 updatedAt）
    const managed = await this.memoryRepo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    const llmManaged = managed.filter((m) => m.memoryKey);
    for (const stale of llmManaged.slice(MAX_LLM_MEMORIES)) {
      await this.memoryRepo.delete({ id: stale.id, userId });
    }
    return { stored, llmCount: insights.length };
  }

  /** Task + ActionRecord → 一行行为流水（紧凑单行，喂给 LLM） */
  private toBehaviorLine(
    task: { category: string; willScore: number; energyScore: number; importance: number; expectCostMin: number | null; deadline: Date | string | null; taskContent: string },
    rec: ActionRecord,
  ): string {
    const label = CATEGORY_LABELS[task.category] ?? task.category;
    const deadline = task.deadline ? new Date(task.deadline).toISOString().slice(0, 10) : '无';
    const cost = task.expectCostMin ? `${task.expectCostMin}分钟` : '未指定';
    const accept = rec.userAcceptSuggest ? '是' : '否';
    const execute = rec.isExecute ? '是' : '否';
    const actual = rec.isExecute && rec.actualCostMin ? `（实际${rec.actualCostMin}分钟）` : '';
    const content = task.taskContent.length > 20 ? `${task.taskContent.slice(0, 20)}…` : task.taskContent;
    let line = `${label} | 「${content}」 | 意愿${task.willScore} 精力${task.energyScore} 重要度${task.importance} | 预计${cost} 截止${deadline} | 接受建议:${accept} 真正执行:${execute}${actual}`;
    // 用户评论是弱辅助证据：帮助理解行为背后的原因/约束（如拒绝理由、身体状况），截断 60 字。
    // 注意：绝不附 agentReply——模型自己的话不能回灌成"用户事实"，防止自我强化。
    const comment = rec.feedbackComment?.trim();
    if (comment) {
      line += ` | 留言:${comment.length > 60 ? `${comment.slice(0, 60)}…` : comment}`;
    }
    return line;
  }

  /** 校验 LLM 输出：非法字段逐条丢弃，同 key 去重，最多保留 MAX_INSIGHTS_PER_RUN 条 */
  private validateInsights(raw: Record<string, unknown> | null): LlmMemoryInsight[] {
    if (!raw || !Array.isArray(raw.memories)) return [];
    const seen = new Set<string>();
    const valid: LlmMemoryInsight[] = [];
    for (const item of raw.memories) {
      if (valid.length >= MAX_INSIGHTS_PER_RUN) break;
      if (!item || typeof item !== 'object') continue;
      const key = typeof item.key === 'string' ? item.key.trim() : '';
      const memoryType = typeof item.memoryType === 'string' ? item.memoryType : '';
      const value = typeof item.value === 'string' ? item.value.trim() : '';
      const rawKeyword = typeof item.keyword === 'string' ? item.keyword.trim() : '';
      const confidence = Number(item.confidence);
      if (!KEY_PATTERN.test(key) || seen.has(key)) continue;
      if (!MEMORY_TYPES.includes(memoryType)) continue;
      if (!value || value.length > VALUE_MAX_LEN) continue;
      if (!Number.isFinite(confidence)) continue;
      // keyword 不合法只置空，不丢弃整条（content 仍可用于统计页底部总结）
      const keyword = KEYWORD_PATTERN.test(rawKeyword) ? rawKeyword : null;
      seen.add(key);
      valid.push({
        key,
        memoryType,
        value,
        keyword,
        confidence: Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100,
        reason: typeof item.reason === 'string' ? item.reason : undefined,
      });
    }
    return valid;
  }
}
