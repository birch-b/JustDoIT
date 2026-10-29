// 公开接口：用户端公告 + 访问上报（公告无需登录，上报登录匿名均可）
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminService } from './admin.service';
import { TrackVisitDto } from './dto/track-visit.dto';
import { OptionalJwtGuard } from '../common/guards/optional-jwt.guard';

@Controller()
export class PublicController {
  constructor(private readonly adminService: AdminService) {}

  /** 用户端公告 GET /api/announcements（只返回最近 7 天） */
  @Get('announcements')
  announcements() {
    return this.adminService.listPublicAnnouncements();
  }

  /**
   * 访问上报 POST /api/track/visit
   * 登录用户带 userId；游客带 visitorId（后台据此区分「谁在临时访问」）
   */
  @UseGuards(OptionalJwtGuard)
  @Post('track/visit')
  trackVisit(@Req() req: Request, @Body() dto: TrackVisitDto) {
    const userId = (req.user as { userId: number } | null)?.userId ?? null;
    const visitorId = dto.visitorId?.trim() || null;
    return this.adminService.trackVisit(userId, visitorId);
  }
}
