// 待办计划表接口：/api/todos（全部需要登录）
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
import { TodoService } from './todo.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { ReflectTodoDto } from './dto/reflect-todo.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('todos')
@UseGuards(JwtAuthGuard)
export class TodoController {
  constructor(private readonly todoService: TodoService) {}

  @Get()
  list(@GetUser('userId') userId: number) {
    return this.todoService.list(userId);
  }

  /** 归档列表：仅返回已完成且已归档的待办 */
  @Get('archived')
  listArchived(@GetUser('userId') userId: number) {
    return this.todoService.listArchived(userId);
  }

  @Post()
  create(@GetUser('userId') userId: number, @Body() dto: CreateTodoDto) {
    return this.todoService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @GetUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTodoDto,
  ) {
    return this.todoService.update(userId, id, dto);
  }

  /** 完成打卡：标记完成 + 可选感受 + Agent 回应 */
  @Post(':id/reflect')
  reflect(
    @GetUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReflectTodoDto,
  ) {
    return this.todoService.reflect(userId, id, dto);
  }

  /** 答了「还没」/忽略询问：顺延到下一个询问点 */
  @Post(':id/postpone')
  postpone(
    @GetUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.todoService.postpone(userId, id);
  }

  /** 归档单条 */
  @Patch(':id/archive')
  archive(
    @GetUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.todoService.archive(userId, id);
  }

  /** 归档全部已完成（原「一键清除」改为归档而非删除） */
  @Delete('clear-done')
  clearDone(@GetUser('userId') userId: number) {
    return this.todoService.clearDone(userId);
  }

  /** 移出计划表：物理删除 todo 记录 */
  @Delete(':id')
  remove(
    @GetUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.todoService.remove(userId, id);
  }
}
