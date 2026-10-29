// 意见反馈服务：落库即可，运营侧直接查表
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './entities/feedback.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
  ) {}

  async create(userId: number | null, dto: CreateFeedbackDto) {
    const feedback = this.feedbackRepo.create({
      userId,
      visitorId: userId === null ? (dto.visitorId?.trim() || null) : null,
      content: dto.content.trim(),
    });
    await this.feedbackRepo.save(feedback);
    return { ok: true };
  }
}
