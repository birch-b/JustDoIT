// 后台管理接口（全部需要管理员权限）
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpsertAnnouncementDto } from './dto/upsert-announcement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** 站点总览 GET /api/admin/overview */
  @Get('overview')
  overview() {
    return this.adminService.overview();
  }

  /** 用户列表 GET /api/admin/users */
  @Get('users')
  users() {
    return this.adminService.userList();
  }

  /** 反馈列表 GET /api/admin/feedbacks */
  @Get('feedbacks')
  feedbacks() {
    return this.adminService.feedbackList();
  }

  /** 公告全量列表（管理用）GET /api/admin/announcements */
  @Get('announcements')
  announcements() {
    return this.adminService.listAllAnnouncements();
  }

  /** 新建公告 POST /api/admin/announcements */
  @Post('announcements')
  createAnnouncement(@Body() dto: UpsertAnnouncementDto) {
    return this.adminService.createAnnouncement(dto);
  }

  /** 编辑公告 PATCH /api/admin/announcements/:id */
  @Patch('announcements/:id')
  updateAnnouncement(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertAnnouncementDto,
  ) {
    return this.adminService.updateAnnouncement(id, dto);
  }

  /** 删除公告 DELETE /api/admin/announcements/:id */
  @Delete('announcements/:id')
  deleteAnnouncement(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteAnnouncement(id);
  }
}
