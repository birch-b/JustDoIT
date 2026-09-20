// 用户长期记忆表：从历史行为中提炼的偏好/规律/画像，喂给 LLM 做个性化建议
// 第三步 3.1 建表；3.2 落地 CRUD；3.3+ 喂给 Prompt / 自动提炼
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity()
export class UserMemory {
  /** 记忆主键ID */
  @PrimaryGeneratedColumn()
  id: number;

  /** 关联用户 */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  /** 记忆类型：preference偏好 / behavior行为规律 / pattern跨任务规律 / goal目标 */
  @Column({ type: 'varchar', length: 30 })
  memoryType: string;

  /** 记忆内容（自然语言短句，如"对耗时超 60 分钟的任务容易拖延"） */
  @Column({ type: 'varchar', length: 500 })
  content: string;

  /** 置信度 0.00-1.00，反映该记忆可信程度，随行为更新动态调整 */
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.5 })
  confidence: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
