import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AnswerBookService } from './answerbook.service';
import { TarotService, TarotResult } from './tarot.service';
import { WeatherService, WeatherInfo } from './weather.service';
import { CityService, CityGroup } from './city.service';
import { AgentService } from './agent.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ActionRecordDto } from './dto/action-record.dto';
import { BatchDeleteSessionsDto } from './dto/batch-delete-sessions.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly answerBookService: AnswerBookService,
    private readonly tarotService: TarotService,
    private readonly weatherService: WeatherService,
    private readonly cityService: CityService,
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

  /**
   * 今日天气：
   *   GET /api/agent/weather?city=武汉          按城市查
   *   GET /api/agent/weather?lat=23.13&lng=113.26 先百度逆地理(WGS84)转城市再查
   * 公开接口；未配置 key/定位或查询失败时 data 为 null，由前端提示且不阻塞提交
   */
  @Get('weather')
  async weather(
    @Query('city') city?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ): Promise<{ code: number; data: WeatherInfo | null }> {
    let targetCity = (city ?? '').trim();
    if (!targetCity && lat !== undefined && lng !== undefined) {
      targetCity = (await this.weatherService.reverseGeocode(Number(lat), Number(lng))) ?? '';
    }
    const data = await this.weatherService.getWeather(targetCity);
    return { code: 0, data };
  }

  /**
   * 全国城市列表（省→市两级）：GET /api/agent/cities
   * 公开接口；未配置 mxnzp 凭证或第三方失败时 data 为 null，前端回退内置城市
   */
  @Get('cities')
  async cities(): Promise<{ code: number; data: CityGroup[] | null }> {
    const data = await this.cityService.getCityGroups();
    return { code: 0, data };
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

  /** 统计聚合：GET /api/agent/stats（需登录，后端聚合避免前端拉全量） */
  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getStats(@GetUser('userId') userId: number) {
    return this.agentService.getStats(userId);
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

  /** 批量删除：DELETE /api/agent/sessions，body { ids: number[] }（需登录，逐个校验归属） */
  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  async deleteSessions(
    @GetUser('userId') userId: number,
    @Body() dto: BatchDeleteSessionsDto,
  ) {
    return this.agentService.deleteSessions(userId, dto.ids);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('session/:id')
  async deleteSession(
    @GetUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.agentService.deleteSession(userId, id);
  }
}
