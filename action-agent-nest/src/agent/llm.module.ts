// 共享 LLM 模块：把 LlmService 导出给 AgentModule（生成建议）与 MemoryModule（3.5 提炼记忆），
// 避免两个业务模块互相 import 造成循环依赖
import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';

@Module({
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
