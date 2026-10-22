// 意见反馈接口：POST /api/feedback（需登录）
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /** 提交意见反馈 POST /api/feedback */
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @GetUser('userId') userId: number,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.create(userId, dto);
  }
}
