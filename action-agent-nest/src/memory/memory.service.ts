// 用户记忆 CRUD：所有操作都按 userId 限定范围，PATCH/DELETE 走归属校验
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserMemory } from './entities/user-memory.entity';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';

@Injectable()
export class MemoryService {
  constructor(
    @InjectRepository(UserMemory)
    private readonly memoryRepo: Repository<UserMemory>,
  ) {}

  /** 列出当前用户全部记忆，按 updatedAt DESC */
  async list(userId: number) {
    return this.memoryRepo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  /** 新建一条记忆（confidence 缺省 0.5） */
  async create(userId: number, dto: CreateMemoryDto) {
    const memory = this.memoryRepo.create({
      userId,
      memoryType: dto.memoryType,
      content: dto.content,
      keyword: dto.keyword?.trim() || null,
      confidence: dto.confidence ?? 0.5,
    });
    return this.memoryRepo.save(memory);
  }

  /** 部分更新（仅更新 dto 中传的字段） */
  async update(userId: number, id: number, dto: UpdateMemoryDto) {
    const memory = await this.findOwned(userId, id);
    if (dto.memoryType !== undefined) memory.memoryType = dto.memoryType;
    if (dto.content !== undefined) memory.content = dto.content;
    if (dto.keyword !== undefined) memory.keyword = dto.keyword.trim() || null;
    if (dto.confidence !== undefined) memory.confidence = dto.confidence;
    return this.memoryRepo.save(memory);
  }

  /** 删除一条记忆 */
  async remove(userId: number, id: number) {
    const memory = await this.findOwned(userId, id);
    await this.memoryRepo.remove(memory);
    return { success: true };
  }

  /** 取一条记忆并校验归属：不存在 NotFound，他人记忆 Forbidden */
  private async findOwned(userId: number, id: number) {
    const memory = await this.memoryRepo.findOne({ where: { id } });
    if (!memory) throw new NotFoundException('记忆不存在');
    if (memory.userId !== userId) {
      throw new ForbiddenException('无权操作该记忆');
    }
    return memory;
  }
}
