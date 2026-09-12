// 用户行为记录表：用户对 Agent 建议的真实反馈
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { TaskSession } from './task-session.entity';

@Entity()
export class ActionRecord {
  /** 记录主键ID */
  @PrimaryGeneratedColumn()
  id: number;

  /** 关联会话（1对1） */
  @OneToOne(() => TaskSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: TaskSession;

  @Column()
  sessionId: number;

  /** 是否接受建议 */
  @Column({ type: 'boolean' })
  userAcceptSuggest: boolean;

  /** 是否执行 */
  @Column({ type: 'boolean' })
  isExecute: boolean;

  /** 实际耗时（分钟） */
  @Column({ type: 'int' })
  actualCostMin: number;

  /** 执行结果/备注 */
  @Column({ type: 'text', nullable: true })
  executeResult: string;

  @CreateDateColumn()
  createdAt: Date;
}
