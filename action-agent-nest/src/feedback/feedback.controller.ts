// 意见反馈接口：POST /api/feedback（登录用户与游客均可提交）
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { OptionalJwtGuard } from '../common/guards/optional-jwt.guard';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * 提交意见反馈 POST /api/feedback
   * 登录用户记 userId；游客记 visitorId（后台据 visitorId 识别是哪位游客）
   */
  @UseGuards(OptionalJwtGuard)
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateFeedbackDto) {
    const userId = (req.user as { userId: number } | null)?.userId ?? null;
    return this.feedbackService.create(userId, dto);
  }
}
