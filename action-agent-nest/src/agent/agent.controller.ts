import { Body, Controller, Delete, Get, HttpException, HttpStatus, Ip, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AnswerBookService } from './answerbook.service';
import { TarotService, TarotResult } from './tarot.service';
import { WeatherService, WeatherInfo } from './weather.service';
import { CityService, CityGroup } from './city.service';
import { PlaceService, PlaceItem } from './place.service';
import { AgentService } from './agent.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ActionRecordDto } from './dto/action-record.dto';
import { BatchDeleteSessionsDto } from './dto/batch-delete-sessions.dto';
import { ImportGuestSessionsDto } from './dto/import-guest-sessions.dto';
import { GuestCheckinReplyDto, GuestFeedbackReplyDto } from './dto/guest-feedback-reply.dto';
import { TodoService } from './todo.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

// ── 游客 LLM 接口限流：每 IP 每日 30 次（内存滑动窗口，单实例部署够用）──
// 覆盖 创建会话/反馈二次回复/打卡回应 三个公开接口，共享同一额度挡住刷接口的滥用；登录接口不受影响
const GUEST_RATE_LIMIT = 30;
const GUEST_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const guestRateMap = new Map<string, number[]>();

function checkGuestRate(ip: string): boolean {
  const now = Date.now();
  const hits = (guestRateMap.get(ip) ?? []).filter((t) => now - t < GUEST_RATE_WINDOW_MS);
  if (hits.length >= GUEST_RATE_LIMIT) {
    guestRateMap.set(ip, hits);
    return false;
  }
  hits.push(now);
  guestRateMap.set(ip, hits);
  return true;
}

@Controller('agent')
export class AgentController {
  constructor(
    private readonly answerBookService: AnswerBookService,
    private readonly tarotService: TarotService,
    private readonly weatherService: WeatherService,
    private readonly cityService: CityService,
    private readonly placeService: PlaceService,
    private readonly agentService: AgentService,
    private readonly todoService: TodoService,
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

  /**
   * 地点搜索：GET /api/agent/place-search?keyword=xxx[&lat=&lng=][&city=]
   * 有坐标（WGS84）时按距离排序；无坐标但有城市时只搜该市；公开接口，失败时 data 为 null
   */
  @Get('place-search')
  async placeSearch(
    @Query('keyword') keyword: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('city') city?: string,
  ): Promise<{ code: number; data: PlaceItem[] | null }> {
    const data = await this.placeService.search(
      keyword ?? '',
      lat !== undefined ? Number(lat) : undefined,
      lng !== undefined ? Number(lng) : undefined,
      city,
    );
    return { code: 0, data };
  }

  /** 创建会话：POST /api/agent/session/create（需登录） */
  @UseGuards(JwtAuthGuard)
  @Post('session/create')
  async createSession(@GetUser('userId') userId: number, @Body() dto: CreateSessionDto) {
    return this.agentService.createSession(userId, dto);
  }

  /**
   * 游客创建会话：POST /api/agent/session/guest-create（公开，每 IP 每日 10 次）
   * 只算不存库，sessionId 由前端本地发号；游客数据全部存在浏览器
   */
  @Post('session/guest-create')
  async createGuestSession(@Ip() ip: string, @Body() dto: CreateSessionDto) {
    if (!checkGuestRate(ip)) {
      throw new HttpException(
        '游客体验次数已用完（每日 30 次），登录后可无限使用',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.agentService.createGuestSession(dto);
  }

  /**
   * 游客反馈二次回复：POST /api/agent/session/guest-reply（公开，共享限流）
   * 会话不落库，上下文由前端随请求带回，LLM 失败返回兜底文案
   */
  @Post('session/guest-reply')
  async guestFeedbackReply(@Ip() ip: string, @Body() dto: GuestFeedbackReplyDto) {
    if (!checkGuestRate(ip)) {
      throw new HttpException(
        '游客体验次数已用完（每日 30 次），登录后可无限使用',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.agentService.guestFeedbackReply(dto);
  }

  /**
   * 游客打卡回应：POST /api/agent/session/guest-checkin-reply（公开，共享限流）
   * 待办不落库，仅按 任务内容+打卡感受 生成一句回应
   */
  @Post('session/guest-checkin-reply')
  async guestCheckinReply(@Ip() ip: string, @Body() dto: GuestCheckinReplyDto) {
    if (!checkGuestRate(ip)) {
      throw new HttpException(
        '游客体验次数已用完（每日 30 次），登录后可无限使用',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const reply = await this.todoService.generateCheckinReply(
      dto.taskContent,
      dto.category,
      (dto.comment ?? '').trim(),
    );
    return { reply };
  }

  /**
   * 游客会话导入：POST /api/agent/session/import（需登录）
   * 登录成功后前端把浏览器本地会话原样写入当前用户名下，返回新旧 ID 映射
   */
  @UseGuards(JwtAuthGuard)
  @Post('session/import')
  async importGuestSessions(
    @GetUser('userId') userId: number,
    @Body() dto: ImportGuestSessionsDto,
  ) {
    return this.agentService.importGuestSessions(userId, dto);
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
