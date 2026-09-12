// 待办计划表：用户接受建议后加入的 to do list
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity()
export class Todo {
  /** 待办主键ID */
  @PrimaryGeneratedColumn()
  id: number;

  /** 关联用户 */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  /** 待办内容 */
  @Column({ type: 'text' })
  taskContent: string;

  /** 纠结分类：work/study/life/shopping/health/social/other */
  @Column({ type: 'varchar', length: 20, default: 'other' })
  category: string;

  /** 截止时间（可空） */
  @Column({ type: 'varchar', length: 50, nullable: true })
  deadline: string | null;

  /** 是否已完成 */
  @Column({ type: 'boolean', default: false })
  done: boolean;

  /** 关联的会话ID（可空——也可手动添加待办） */
  @Column({ type: 'int', nullable: true })
  sessionId: number | null;

  /** 完成时间 */
  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
