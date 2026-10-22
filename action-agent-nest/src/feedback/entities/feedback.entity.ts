// 意见反馈表：用户在铃铛弹层提交的意见/建议
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('feedback')
export class Feedback {
  @PrimaryGeneratedColumn()
  id: number;

  /** 提交人 userId（必须登录才能反馈） */
  @Column()
  userId: number;

  /** 反馈内容，最多 1000 字（DTO 层校验） */
  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
