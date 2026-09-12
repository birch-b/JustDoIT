import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AnswerBookService } from './answerbook.service';
import { TarotService } from './tarot.service';
import { Task } from './entities/task.entity';
import { TaskSession } from './entities/task-session.entity';
import { ActionRecord } from './entities/action-record.entity';
import { Todo } from './entities/todo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskSession, ActionRecord, Todo])],
  controllers: [AgentController],
  providers: [AgentService, AnswerBookService, TarotService],
})
export class AgentModule {}
