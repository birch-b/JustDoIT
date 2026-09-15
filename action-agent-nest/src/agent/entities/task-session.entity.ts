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

  /** 结论（中文） */
  @Column({ type: 'varchar', length: 100 })
  conclusion: string;

  /** 劝说模式 */
  @Column({ type: 'varchar', length: 20 })
  persuadeMode: string;

  /** 劝说文案 */
  @Column({ type: 'text' })
  persuadeText: string;

  /** 最小行动 */
  @Column({ type: 'text' })
  minAction: string;

  /** 塔罗牌（可为空） */
  @Column({ type: 'varchar', length: 50, nullable: true })
  taroCard: string | null;

  /** 塔罗牌完整文案列表（JSON 字符串，如 ["愚人 · 正位"]，可为空） */
  @Column({ type: 'text', nullable: true })
  tarotCards: string | null;

  /** 答案之书的回答（可为空） */
  @Column({ type: 'varchar', length: 500, nullable: true })
  answerBook: string | null;

  /** 历史行为摘要（读时动态生成，列仅兼容老数据保留） */
  @Column({ type: 'text', nullable: true })
  historySummary: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
