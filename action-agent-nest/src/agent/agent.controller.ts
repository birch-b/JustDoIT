import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AnswerBookService } from './answerbook.service';
import { TarotService, TarotResult } from './tarot.service';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly answerBookService: AnswerBookService,
    private readonly tarotService: TarotService,
  ) {}

  /**
   * 答案之书：GET /api/agent/answer-book?question=xxx
   * 返回随机一句神谕回答
   */
  @Get('answer-book')
  async answerBook(@Query('question') question: string) {
    const answer = await this.answerBookService.ask(question || '');
    return { code: 0, data: { answer } };
  }

  /**
   * 塔罗牌：POST /api/agent/tarot  body: { topicId?: number }
   * 抽 1 张牌
   */
  @Post('tarot')
  async tarot(@Body('topicId') topicId?: number): Promise<{ code: number; data: TarotResult | null }> {
    const result = await this.tarotService.draw(topicId ?? 5);
    return { code: 0, data: result };
  }
}
