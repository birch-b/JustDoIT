// Agent 会话表：Agent 给出的建议结果
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Task } from './task.entity';
import { encryptedTransformer } from '../../common/crypto/field-crypto';

@Entity()
export class TaskSession {
  /** 会话主键ID */
  @PrimaryGeneratedColumn()
  id: number;

  /** 关联任务（1对1） */
  @OneToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column()
  taskId: number;

  /** 行动指数 0-100 */
  @Column({ type: 'int' })
  agentSuggestIndex: number;

  /** 结论（中文；加密存储，密文膨胀故用 text） */
  @Column({ type: 'text', transformer: encryptedTransformer })
  conclusion: string;

  /** 劝说模式 */
  @Column({ type: 'varchar', length: 20 })
  persuadeMode: string;

  /** 劝说文案（加密存储） */
  @Column({ type: 'text', transformer: encryptedTransformer })
  persuadeText: string;

  /** 最小行动（加密存储） */
  @Column({ type: 'text', transformer: encryptedTransformer })
  minAction: string;

  /** 塔罗牌（可为空） */
  @Column({ type: 'varchar', length: 50, nullable: true })
  taroCard: string | null;

  /** 塔罗牌完整文案列表（JSON 字符串，如 ["愚人 · 正位"]，可为空） */
  @Column({ type: 'text', nullable: true })
  tarotCards: string | null;

  /** 塔罗牌一句话解析（LLM 结合任务生成，可为空；加密存储，密文膨胀故用 text） */
  @Column({ type: 'text', nullable: true, transformer: encryptedTransformer })
  tarotReading: string | null;

  /** 答案之书的回答（可为空；加密存储，密文膨胀故用 text） */
  @Column({ type: 'text', nullable: true, transformer: encryptedTransformer })
  answerBook: string | null;

  /** 答案之书一句话解读（LLM 顺着随机答案的意象写，圆回主结论，可为空；加密存储，密文膨胀故用 text） */
  @Column({ type: 'text', nullable: true, transformer: encryptedTransformer })
  answerBookReading: string | null;

  /** 历史行为摘要（读时动态生成，列仅兼容老数据保留） */
  @Column({ type: 'text', nullable: true })
  historySummary: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
