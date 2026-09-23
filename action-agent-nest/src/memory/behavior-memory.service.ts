// 3.4 行为记忆规则引擎：从 action_record 聚合统计，按任务类别确定性地对齐用户长期记忆
// 设计要点：
// - 不使用 LLM / 不加表字段；每次反馈后重算该类别统计并 reconcile，天然幂等
// - 单次行为不产生记忆：每类至少 MIN_SAMPLES 个已反馈样本，且比率达到倾向性阈值
// - confidence 随样本量与倾向强度增长，钳制 0~1；对立行为使比率回归中性 → 降置信/翻转/删除
// - 固定文案模板作为"受管记忆"命名空间，按 content 去重：更新优先于新建
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserMemory } from './entities/user-memory.entity';
import { TaskSession } from '../agent/entities/task-session.entity';
import { ActionRecord } from '../agent/entities/action-record.entity';
import { Task } from '../agent/entities/task.entity';

const CATEGORY_LABELS: Record<string, string> = {
  work: '工作',
  study: '学习',
  life: '生活',
  shopping: '购物',
  health: '健康',
  social: '社交',
  other: '其他',
};

/** 每类最少已反馈样本数，低于此不生成任何记忆（防止单次行为形成结论） */
const MIN_SAMPLES = 3;
const RATE_HIGH = 0.7;
const RATE_LOW = 0.3;
/** 接受倾向：10 个同向样本证据度拉满；执行是更强信号，6 个样本即拉满 */
const EVIDENCE_FULL_ACCEPT = 10;
const EVIDENCE_FULL_EXECUTE = 6;
const AGGREGATE_LIMIT = 200;
/** 无 deadline：接受后超过 7 天仍未执行视为放弃；有 deadline：deadline 后再给 2 天宽限 */
const ABANDON_GRACE_DAYS = 7;
const DEADLINE_GRACE_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

// 受管记忆模板：content 由类别标签确定，type 固定；reconcile 时据此识别受管行
interface MemoryTemplate {
  memoryType: 'behavior' | 'pattern';
  /** pos=高比率文案，neg=低比率文案 */
  pos: (label: string) => string;
  neg: (label: string) => string;
}

const TEMPLATES: MemoryTemplate[] = [
  {
    // 接受建议倾向
    memoryType: 'behavior',
    pos: (l) => `${l}类任务你通常愿意接受建议`,
    neg: (l) => `${l}类任务你通常不愿意接受建议`,
  },
  {
    // 接受后是否真正执行
    memoryType: 'pattern',
    pos: (l) => `${l}类任务接受建议后通常能真正执行`,
    neg: (l) => `${l}类任务容易“接受建议却没真正执行”`,
  },
];

/** 所有可能的受管文案 → 记忆类型（用于识别受管行 & 新建时确定类型） */
const MANAGED_CONTENT_TYPE = new Map<string, string>();
for (const label of Object.values(CATEGORY_LABELS)) {
  for (const t of TEMPLATES) {
    MANAGED_CONTENT_TYPE.set(t.pos(label), t.memoryType);
    MANAGED_CONTENT_TYPE.set(t.neg(label), t.memoryType);
  }
}

@Injectable()
export class BehaviorMemoryService {
  private readonly logger = new Logger(BehaviorMemoryService.name);

  constructor(
    @InjectRepository(UserMemory)
    private readonly memoryRepo: Repository<UserMemory>,
    @InjectRepository(TaskSession)
    private readonly sessionRepo: Repository<TaskSession>,
    @InjectRepository(ActionRecord)
    private readonly recordRepo: Repository<ActionRecord>,
  ) {}

  /**
   * 反馈写入后、或会话/反馈被删除后调用：重算指定类别的接受/执行统计，对齐受管记忆。
   * 幂等，可对同一会话重复调用；样本归零会回收该类别全部受管记忆。
   * 任何异常只记日志，不影响调用方主流程。
   */
  async syncFromFeedback(userId: number, category: string): Promise<void> {
    try {
      const label = CATEGORY_LABELS[category] ?? category;

      const sessions = await this.sessionRepo.find({
        relations: { task: true },
        where: { task: { userId, category } },
        order: { createdAt: 'DESC' },
        take: AGGREGATE_LIMIT,
      });

      // 即使会话已全部删除也要继续：期望集为空 → 回收该类别的受管记忆
      const records = sessions.length
        ? await this.recordRepo.find({
            where: { sessionId: In(sessions.map((s) => s.id)) },
          })
        : [];
      const recMap = new Map(records.map((r) => [r.sessionId, r]));
      const samples = sessions
        .map((s) => ({ task: s.task, rec: recMap.get(s.id) }))
        .filter((x): x is { task: Task; rec: ActionRecord } => !!x.task && !!x.rec);
      // 期望状态：受管文案 → confidence；不在 map 中的受管文案应被回收
      const desired = new Map<string, number>();

      // 槽 1：接受建议倾向（分母 = 全部已反馈）
      const acceptRate = samples.length
        ? this.clampConfidence(
            samples.filter((x) => x.rec.userAcceptSuggest).length / samples.length,
            samples.length,
            EVIDENCE_FULL_ACCEPT,
          )
        : null;
      this.pushDesired(desired, TEMPLATES[0], label, acceptRate, samples.length);

      // 槽 2：接受后实际执行倾向（执行是比接受更强的信号）
      // 时间窗口（方案 A）：isExecute=false 不立即视为放弃——
      //   · 窗口内（接受未满 7 天 / 未过 deadline+2 天）= 还没开始，踢出分母，不误伤
      //   · 超过宽限窗口仍未执行 = 视为放弃，计入负面证据
      // 已见分晓的样本（已执行 + 已放弃）才进入执行率分母
      const nowMs = Date.now();
      const accepted = samples.filter((x) => x.rec.userAcceptSuggest);
      const resolved = accepted.filter(
        (x) => x.rec.isExecute || this.isAbandoned(x.task, x.rec.createdAt, nowMs),
      );
      const executeRate = resolved.length
        ? this.clampConfidence(
            resolved.filter((x) => x.rec.isExecute).length / resolved.length,
            resolved.length,
            EVIDENCE_FULL_EXECUTE,
          )
        : null;
      this.pushDesired(desired, TEMPLATES[1], label, executeRate, resolved.length);

      await this.reconcile(userId, label, desired);
    } catch (e) {
      this.logger.error(`行为记忆同步失败: ${(e as Error).message}`);
    }
  }

  /**
   * 判断"接受后未执行"是否已过宽限窗口（视为放弃）：
   * 有合法 deadline → 当前时间超过 deadline + 2 天；否则 → 距今接受超过 7 天。
   */
  private isAbandoned(task: Task, acceptedAt: Date, nowMs: number): boolean {
    const deadlineMs = task.deadline ? new Date(task.deadline).getTime() : NaN;
    if (!Number.isNaN(deadlineMs)) {
      return nowMs > deadlineMs + DEADLINE_GRACE_DAYS * DAY_MS;
    }
    return nowMs - new Date(acceptedAt).getTime() > ABANDON_GRACE_DAYS * DAY_MS;
  }

  /** 样本足够且比率达阈值时，把对应文案与置信度放入期望表 */
  private pushDesired(
    desired: Map<string, number>,
    tpl: MemoryTemplate,
    label: string,
    confidence: number | null,
    sampleSize: number,
  ) {
    if (sampleSize < MIN_SAMPLES || confidence === null) return;
    // confidence 为正取高比率文案，为负取低比率文案（绝对值即置信度）
    const content = confidence > 0 ? tpl.pos(label) : tpl.neg(label);
    desired.set(content, Math.abs(confidence));
  }

  /**
   * 比率 → 带方向的置信度：正值=高比率倾向，负值=低比率倾向，null=中性不建记忆。
   * confidence = 0.5 + 0.5 × 倾向强度 × 证据度；样本越少置信越低（单次行为不可能强结论）。
   */
  private clampConfidence(
    rate: number | null,
    sampleSize: number,
    evidenceFullAt: number,
  ): number | null {
    if (rate === null || (rate > RATE_LOW && rate < RATE_HIGH)) return null;
    const value = this.strengthConfidence(rate, sampleSize, evidenceFullAt);
    return rate >= RATE_HIGH ? value : -value;
  }

  /** 无方向置信度（始终为正）：0.5 + 0.5 × 倾向强度 × 证据度 */
  private strengthConfidence(rate: number, sampleSize: number, evidenceFullAt: number): number {
    const strength = Math.min(1, Math.abs(rate - 0.5) * 2);
    const evidence = Math.min(sampleSize, evidenceFullAt) / evidenceFullAt;
    return Math.round((0.5 + 0.5 * strength * evidence) * 100) / 100;
  }

  /**
   * 用期望状态对齐用户【指定类别】的受管记忆：更新 / 翻转（删旧建新）/ 回收 / 新建。
   * 仅处理该类别 4 条模板文案对应的行，其他类别与非受管（手动/3.5 生成）记忆一律不动。全程限定 userId。
   */
  private async reconcile(
    userId: number,
    label: string,
    desired: Map<string, number>,
  ): Promise<void> {
    // 当前类别的受管命名空间（2 槽 × 正反 2 条）
    const scopedContents = new Set<string>();
    const scopedTypeOf = new Map<string, string>();
    for (const t of TEMPLATES) {
      for (const text of [t.pos(label), t.neg(label)]) {
        scopedContents.add(text);
        scopedTypeOf.set(text, t.memoryType);
      }
    }

    const existing = await this.memoryRepo.find({ where: { userId } });
    const existingByContent = new Map(existing.map((m) => [m.content, m]));

    // 1) 该类别已有受管记忆：期望中保留则更新置信度，不在期望中（翻转/回归中性/样本归零）则删除
    for (const mem of existing) {
      if (!scopedContents.has(mem.content)) continue;
      const wanted = desired.get(mem.content);
      if (wanted === undefined) {
        await this.memoryRepo.delete({ id: mem.id, userId });
      } else if (Number(mem.confidence) !== wanted) {
        mem.confidence = wanted;
        await this.memoryRepo.save(mem);
      }
    }

    // 2) 期望中但不存在的受管文案 → 新建（同文案已存在则跳过，杜绝重复）
    for (const [content, confidence] of desired) {
      if (existingByContent.has(content)) continue;
      const created = this.memoryRepo.create({
        userId,
        memoryType: scopedTypeOf.get(content) ?? MANAGED_CONTENT_TYPE.get(content) ?? 'behavior',
        content,
        confidence,
      });
      await this.memoryRepo.save(created);
    }
  }
}
