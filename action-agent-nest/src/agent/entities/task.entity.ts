// 任务表：用户提交的决策输入
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity()
export class Task {
  /** 任务主键ID */
  @PrimaryGeneratedColumn()
  id: number;

  /** 关联用户 */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  /** 任务内容 */
  @Column({ type: 'text' })
  taskContent: string;

  /** 纠结分类：work工作 / study学习 / life生活琐事 / shopping消费购物 / health健康 / social社交 / other其他 */
  @Column({ type: 'varchar', length: 20, default: 'other' })
  category: string;

  /** 主观意愿 1-10 */
  @Column({ type: 'int' })
  willScore: number;

  /** 当前精力 1-10 */
  @Column({ type: 'int' })
  energyScore: number;

  /** 重要度 1-10 */
  @Column({ type: 'int' })
  importance: number;

  /** 预计耗时（分钟，可空——快速纠结如吃饭/剪头发不需要） */
  @Column({ type: 'int', nullable: true })
  expectCostMin: number | null;

  /** 截止时间（可空——生活类纠结没有ddl） */
  @Column({ type: 'varchar', length: 50, nullable: true })
  deadline: string | null;

  /** 地点 */
  @Column({ type: 'varchar', length: 100, default: '' })
  location: string;

  /** 是否启用塔罗模式（抽 1 张） */
  @Column({ type: 'boolean', default: false })
  enableTarot: boolean;

  /** 是否启用答案之书 */
  @Column({ type: 'boolean', default: true })
  enableAnswerBook: boolean;

  /** 补充条件（可选：一句话描述不全时的背景/约束，空字符串表示无补充） */
  @Column({ type: 'varchar', length: 500, default: '' })
  extraContext: string;

  /** 今日天气·城市（勾选天气加成时填写，如 Wuhan/武汉） */
  @Column({ type: 'varchar', length: 50, nullable: true })
  weatherCity: string | null;

  /** 今日天气·摘要（如"小雨 · 22℃（体感21℃） · 湿度70% · 东风 8km/h"） */
  @Column({ type: 'varchar', length: 200, nullable: true })
  weatherText: string | null;

  /** 用户对今日天气的打分 1-10（越低越不喜欢/越受天气影响） */
  @Column({ type: 'int', nullable: true })
  weatherScore: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
