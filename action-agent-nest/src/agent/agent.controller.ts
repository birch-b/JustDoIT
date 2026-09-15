import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AnswerBookService } from './answerbook.service';
import { TarotService, TarotResult } from './tarot.service';
import { AgentService } from './agent.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ActionRecordDto } from './dto/action-record.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly answerBookService: AnswerBookService,
    private readonly tarotService: TarotService,
    private readonly agentService: AgentService,
  ) {}

  /**
   * 答案之书：GET /api/agent/answer-book?question=xxx
   * 公开接口，返回随机一句神谕回答
   */
  @Get('answer-book')
  async answerBook(@Query('question') question: string) {
    const answer = await this.answerBookService.ask(question || '');
    return { code: 0, data: { answer } };
  }

  /**
   * 塔罗牌：POST /api/agent/tarot  body: { topicId?: number }
   * 公开接口，抽 1 张牌
   */
  @Post('tarot')
  async tarot(@Body('topicId') topicId?: number): Promise<{ code: number; data: TarotResult | null }> {
    const result = await this.tarotService.draw(topicId ?? 5);
    return { code: 0, data: result };
  }

  /** 创建会话：POST /api/agent/session/create（需登录） */
  @UseGuards(JwtAuthGuard)
  @Post('session/create')
  async createSession(@GetUser('userId') userId: number, @Body() dto: CreateSessionDto) {
    return this.agentService.createSession(userId, dto);
  }

  /** 历史会话列表：GET /api/agent/sessions（需登录） */
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async listSessions(@GetUser('userId') userId: number) {
    return this.agentService.listSessions(userId);
  }

  /** 会话详情：GET /api/agent/session/:id（需登录，校验归属） */
  @UseGuards(JwtAuthGuard)
  @Get('session/:id')
  async getSession(
    @GetUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.agentService.getSession(userId, id);
  }

  /** 历史详情：GET /api/agent/history/:id（需登录，校验归属） */
  @UseGuards(JwtAuthGuard)
  @Get('history/:id')
  async getHistory(
    @GetUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.agentService.getHistory(userId, id);
  }

  /** 提交行为反馈：POST /api/agent/action/record（需登录，校验归属） */
  @UseGuards(JwtAuthGuard)
  @Post('action/record')
  async submitRecord(
    @GetUser('userId') userId: number,
    @Body() dto: ActionRecordDto,
  ) {
    return this.agentService.submitRecord(userId, dto);
  }

  /** 删除会话记录：DELETE /api/agent/session/:id（需登录，校验归属） */
  @UseGuards(JwtAuthGuard)
  @Delete('session/:id')
  async deleteSession(
    @GetUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.agentService.deleteSession(userId, id);
  }
}
