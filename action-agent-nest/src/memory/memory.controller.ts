// 用户记忆接口：全部需要登录，类级 JwtAuthGuard 守门
// GET    /api/memory       列出当前用户全部记忆
// POST   /api/memory        新建一条
// PATCH  /api/memory/:id    修改一条（仅本人）
// DELETE /api/memory/:id    删除一条（仅本人）
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MemoryService } from './memory.service';
import { LlmMemoryService } from './llm-memory.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('memory')
@UseGuards(JwtAuthGuard)
export class MemoryController {
  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmMemoryService: LlmMemoryService,
  ) {}

  @Get()
  async list(@GetUser('userId') userId: number) {
    return this.memoryService.list(userId);
  }

  // 统计页底部综合论述：LLM 把全部记忆揉成一段整体画像；无记忆/LLM 失败时 summary 为 null
  @Get('summary')
  async summary(@GetUser('userId') userId: number): Promise<{ summary: string | null }> {
    const summary = await this.llmMemoryService.getOverallSummary(userId);
    return { summary };
  }

  // 关键词页"探索手册"：chapters/advice/question 三段式复盘；同时返回更新节奏信息
  // 攒够 5 条新的「有反馈的纠结」才会重写，refresh=1 才强制重写（10 分钟节流）
  @Get('insight')
  async insight(
    @GetUser('userId') userId: number,
    @Query('refresh') refresh?: string,
  ) {
    return this.llmMemoryService.getSelfInsight(userId, refresh === '1');
  }

  @Post()
  async create(
    @GetUser('userId') userId: number,
    @Body() dto: CreateMemoryDto,
  ) {
    return this.memoryService.create(userId, dto);
  }

  @Patch(':id')
  async update(
    @GetUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMemoryDto,
  ) {
    return this.memoryService.update(userId, id, dto);
  }

  @Delete(':id')
  async remove(
    @GetUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.memoryService.remove(userId, id);
  }
}
