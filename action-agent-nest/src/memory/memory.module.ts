// 用户记忆模块：CRUD 接口 + JWT 鉴权；行为记忆规则引擎（3.4）；LLM 记忆提炼（3.5）
// exports 供 AgentModule 注入：MemoryService（3.3 读记忆）、BehaviorMemoryService（3.4 写记忆）、LlmMemoryService（3.5 写记忆）
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { BehaviorMemoryService } from './behavior-memory.service';
import { LlmMemoryService } from './llm-memory.service';
import { LlmModule } from '../agent/llm.module';
import { UserMemory } from './entities/user-memory.entity';
import { TaskSession } from '../agent/entities/task-session.entity';
import { ActionRecord } from '../agent/entities/action-record.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // 规则引擎需读取会话（拿 category）与行为反馈做聚合；同一实体可在多模块注册仓库
    TypeOrmModule.forFeature([UserMemory, TaskSession, ActionRecord]),
    // 3.5 记忆提炼复用共享 LlmService（避免与 AgentModule 循环依赖）
    LlmModule,
  ],
  controllers: [MemoryController],
  providers: [MemoryService, BehaviorMemoryService, LlmMemoryService],
  exports: [MemoryService, BehaviorMemoryService, LlmMemoryService],
})
export class MemoryModule {}
