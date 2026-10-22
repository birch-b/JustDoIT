// 后台管理服务：站点统计 / 反馈列表 / 公告 CRUD / 访问上报
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Feedback } from '../feedback/entities/feedback.entity';
import { Announcement } from './entities/announcement.entity';
import { Visit } from './entities/visit.entity';
import { UpsertAnnouncementDto } from './dto/upsert-announcement.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
    @InjectRepository(Visit)
    private readonly visitRepo: Repository<Visit>,
  ) {}

  /** 站点总览：用户数量 / 访问量 / 活跃时间 */
  async overview() {
    const totalUsers = await this.userRepo.count();
    const totalVisits = await this.visitRepo.count();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayVisits = await this.visitRepo.count({
      where: { createdAt: MoreThanOrEqual(todayStart) },
    });
    const todayActiveRaw = await this.visitRepo
      .createQueryBuilder('v')
      .select('COUNT(DISTINCT v.userId)', 'cnt')
      .where('v.createdAt >= :s', { s: todayStart })
      .andWhere('v.userId IS NOT NULL')
      .getRawOne<{ cnt: string }>();

    // 活跃用户（最近 20 个有访问记录的登录用户，按最后活跃倒序）
    const rows = await this.visitRepo
      .createQueryBuilder('v')
      .select('v.userId', 'userId')
      .addSelect('MAX(v.createdAt)', 'lastActiveAt')
      .where('v.userId IS NOT NULL')
      .groupBy('v.userId')
      .orderBy('lastActiveAt', 'DESC')
      .limit(20)
      .getRawMany<{ userId: number; lastActiveAt: Date }>();
    const ids = rows.map((r) => r.userId);
    const users = ids.length
      ? await this.userRepo.find({ where: { id: In(ids) } })
      : [];
    const nameMap = new Map(users.map((u) => [u.id, u.username]));
    const activeUsers = rows.map((r) => ({
      username: nameMap.get(r.userId) ?? `#${r.userId}`,
      lastActiveAt: r.lastActiveAt,
    }));

    return {
      totalUsers,
      totalVisits,
      todayVisits,
      todayActiveUsers: Number(todayActiveRaw?.cnt ?? 0),
      activeUsers,
    };
  }

  /** 用户列表：全部用户 + 最后活跃时间 + 状态（7天内有访问=活跃，更早=沉默，无记录=未活跃） */
  async userList() {
    const users = await this.userRepo.find({ order: { createAt: 'DESC' } });
    const rows = await this.visitRepo
      .createQueryBuilder('v')
      .select('v.userId', 'userId')
      .addSelect('MAX(v.createdAt)', 'lastActiveAt')
      .where('v.userId IS NOT NULL')
      .groupBy('v.userId')
      .getRawMany<{ userId: number; lastActiveAt: Date }>();
    const activeMap = new Map(rows.map((r) => [r.userId, r.lastActiveAt]));
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return users.map((u) => {
      const lastActiveAt = activeMap.get(u.id) ?? null;
      let status: 'active' | 'quiet' | 'never' = 'never';
      if (lastActiveAt) {
        status =
          new Date(lastActiveAt).getTime() >= weekAgo ? 'active' : 'quiet';
      }
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        registeredAt: u.createAt,
        lastActiveAt,
        status,
      };
    });
  }

  /** 反馈收集：倒序带用户名，最多 100 条 */
  async feedbackList() {
    const list = await this.feedbackRepo.find({
      order: { createdAt: 'DESC' },
      take: 100,
    });
    const ids = [...new Set(list.map((f) => f.userId))];
    const users = ids.length
      ? await this.userRepo.find({ where: { id: In(ids) } })
      : [];
    const nameMap = new Map(users.map((u) => [u.id, u.username]));
    return list.map((f) => ({
      id: f.id,
      username: nameMap.get(f.userId) ?? `#${f.userId}`,
      content: f.content,
      createdAt: f.createdAt,
    }));
  }

  /** 用户端公告：只返回最近 7 天的 */
  async listPublicAnnouncements() {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    return this.announcementRepo.find({
      where: { createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'DESC' },
    });
  }

  /** 管理端公告：全部（含超过 7 天的，便于复用编辑） */
  async listAllAnnouncements() {
    return this.announcementRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createAnnouncement(dto: UpsertAnnouncementDto) {
    const a = this.announcementRepo.create({
      title: dto.title.trim(),
      date: dto.date,
      items: dto.items.map((i) => ({ type: i.type, text: i.text.trim() })),
    });
    return this.announcementRepo.save(a);
  }

  async updateAnnouncement(id: number, dto: UpsertAnnouncementDto) {
    const a = await this.announcementRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('公告不存在');
    a.title = dto.title.trim();
    a.date = dto.date;
    a.items = dto.items.map((i) => ({ type: i.type, text: i.text.trim() }));
    return this.announcementRepo.save(a);
  }

  async deleteAnnouncement(id: number) {
    const res = await this.announcementRepo.delete(id);
    if (!res.affected) throw new NotFoundException('公告不存在');
    return { ok: true };
  }

  /** 访问上报：每会话一条，登录带 userId */
  async trackVisit(userId: number | null) {
    await this.visitRepo.save(this.visitRepo.create({ userId }));
    return { ok: true };
  }
}
