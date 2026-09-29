import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AgentController } from './agent.controller';
import { TodoController } from './todo.controller';
import { AgentService } from './agent.service';
import { TodoService } from './todo.service';
import { AnswerBookService } from './answerbook.service';
import { TarotService } from './tarot.service';
import { WeatherService } from './weather.service';
import { LlmModule } from './llm.module';
import { MemoryModule } from '../memory/memory.module';
import { Task } from './entities/task.entity';
import { TaskSession } from './entities/task-session.entity';
import { ActionRecord } from './entities/action-record.entity';
import { Todo } from './entities/todo.entity';

@Module({
  // PassportModule 让模块内的 JwtAuthGuard 能解析 AuthModuleOptions
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([Task, TaskSession, ActionRecord, Todo]),
    // 3.3：AgentService 注入 MemoryService，创建会话时读取用户长期记忆
    MemoryModule,
    // LlmService 移入共享 LlmModule（3.5 MemoryModule 也要用）
    LlmModule,
  ],
  controllers: [AgentController, TodoController],
  providers: [AgentService, TodoService, AnswerBookService, TarotService, WeatherService],
})
export class AgentModule {}
