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
import { encryptedTransformer } from '../../common/crypto/field-crypto';

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

  /** 做出决定时是否选择加入计划表（用于待办被删后区分「从未加入」和「加入后被删」） */
  @Column({ type: 'boolean', default: false })
  addToTodo: boolean;

  /** 是否执行 */
  @Column({ type: 'boolean' })
  isExecute: boolean;

  /** 实际耗时（分钟） */
  @Column({ type: 'int' })
  actualCostMin: number;

  /** 执行结果/备注（加密存储） */
  @Column({ type: 'text', nullable: true, transformer: encryptedTransformer })
  executeResult: string;

  /** 用户对本次建议的可选评论/想说的话（反馈时填写，可空；加密存储，密文膨胀故用 text） */
  @Column({ type: 'text', nullable: true, transformer: encryptedTransformer })
  feedbackComment: string | null;

  /** Agent 收到用户决定（接受/拒绝/是否入计划表/评论）后的二次回复（可空；加密存储，密文膨胀故用 text） */
  @Column({ type: 'text', nullable: true, transformer: encryptedTransformer })
  agentReply: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
