// 系统公告表：管理员在后台编辑，用户端铃铛只展示最近 7 天的
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export interface AnnouncementItem {
  type: 'new' | 'improve' | 'fix';
  text: string;
}

@Entity('announcement')
export class Announcement {
  @PrimaryGeneratedColumn()
  id: number;

  /** 公告标题，如「偏好问卷上线」 */
  @Column({ type: 'varchar', length: 50 })
  title: string;

  /** 显示用日期，格式 2026-10-22 */
  @Column({ type: 'varchar', length: 10 })
  date: string;

  /** 条目列表 JSON：[{type:'new'|'improve'|'fix', text}] */
  @Column({ type: 'simple-json' })
  items: AnnouncementItem[];

  @CreateDateColumn()
  createdAt: Date;
}
