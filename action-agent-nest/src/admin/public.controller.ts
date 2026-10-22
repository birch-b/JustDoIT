// 公开接口：用户端公告 + 访问上报（无需管理员，公告无需登录，上报登录匿名均可）
import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminService } from './admin.service';
import { OptionalJwtGuard } from '../common/guards/optional-jwt.guard';

@Controller()
export class PublicController {
  constructor(private readonly adminService: AdminService) {}

  /** 用户端公告 GET /api/announcements（只返回最近 7 天） */
  @Get('announcements')
  announcements() {
    return this.adminService.listPublicAnnouncements();
  }

  /** 访问上报 POST /api/track/visit（登录用户带 userId，匿名也可） */
  @UseGuards(OptionalJwtGuard)
  @Post('track/visit')
  trackVisit(@Req() req: Request) {
    const userId = (req.user as { userId: number } | null)?.userId ?? null;
    return this.adminService.trackVisit(userId);
  }
}
