// 网站访问记录表：前端每会话进入时上报一条，用于统计访问量与活跃时间
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('visit')
export class Visit {
  @PrimaryGeneratedColumn()
  id: number;

  /** 登录用户的 userId；匿名访问为 null */
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  /** 浏览器游客标识（前端 localStorage 生成）；用于区分具体是哪位游客 */
  @Column({ type: 'varchar', length: 64, nullable: true })
  visitorId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
