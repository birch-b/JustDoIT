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

  /** 提交人 userId；游客提交为 null（配合 visitorId 识别是谁） */
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  /** 游客浏览器标识；登录用户提交时为 null */
  @Column({ type: 'varchar', length: 64, nullable: true })
  visitorId: string | null;

  /** 反馈内容，最多 1000 字（DTO 层校验） */
  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
