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
  UseGuards,
} from '@nestjs/common';
import { MemoryService } from './memory.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('memory')
@UseGuards(JwtAuthGuard)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  async list(@GetUser('userId') userId: number) {
    return this.memoryService.list(userId);
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
