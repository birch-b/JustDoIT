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

  @Delete('clear-done')
  clearDone(@GetUser('userId') userId: number) {
    return this.todoService.clearDone(userId);
  }

  @Delete(':id')
  remove(
    @GetUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.todoService.remove(userId, id);
  }
}
