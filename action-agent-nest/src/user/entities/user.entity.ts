//Entity：类映射 MySQL 数据表，属性映射字段
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class User {
  /** 用户主键ID，自增 */
  @PrimaryGeneratedColumn()
  id: number;

  /** 用户名，唯一，最大50字符 */
  @Column({ unique: true, length: 50 })
  username: string;

  /** 邮箱，唯一 */
  @Column({ unique: true, length: 100 })
  email: string;

  /** bcrypt加密后的密码，不存明文 */
  @Column({ length: 100 })
  password: string;

  /** 个人简介，可空，最大200字符 */
  @Column({ type: 'varchar', length: 200, nullable: true })
  bio: string | null;

  /** 用户冷启动偏好问卷数据（JSON：兴趣/纠结点/决策风格/价值观/补充），未填为 null */
  @Column({ type: 'simple-json', nullable: true })
  preference: Record<string, unknown> | null;

  /** 角色：user / admin，默认 user；admin 可访问后台管理 */
  @Column({ type: 'varchar', length: 10, default: 'user' })
  role: string;

  /** 创建时间，自动写入 */
  @CreateDateColumn()
  createAt: Date;
}
