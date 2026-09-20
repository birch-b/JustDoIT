// 用户记忆模块：CRUD 接口 + JWT 鉴权；exports MemoryService 供 3.3 AgentModule 注入使用
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { UserMemory } from './entities/user-memory.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([UserMemory]),
  ],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
