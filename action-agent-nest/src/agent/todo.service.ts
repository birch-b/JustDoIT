// 待办计划表 CRUD：所有操作均校验归属
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Todo } from './entities/todo.entity';
import { ActionRecord } from './entities/action-record.entity';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

@Injectable()
export class TodoService {
  constructor(
    @InjectRepository(Todo)
    private readonly todoRepo: Repository<Todo>,
    @InjectRepository(ActionRecord)
    private readonly recordRepo: Repository<ActionRecord>,
  ) {}

  /** 当前用户未归档待办（未完成在前，同组内新的在前） */
  async list(userId: number) {
    const todos = await this.todoRepo.find({
      where: { userId, archived: false },
      order: { createdAt: 'DESC' },
    });
    return todos.map((t) => this.toRes(t));
  }

  /** 归档列表：仅返回已完成且已归档的待办 */
  async listArchived(userId: number) {
    const todos = await this.todoRepo.find({
      where: { userId, archived: true },
      order: { createdAt: 'DESC' },
    });
    return todos.map((t) => this.toRes(t));
  }

  async create(userId: number, dto: CreateTodoDto) {
    const todo = this.todoRepo.create({
      userId,
      taskContent: dto.taskContent,
      category: dto.category,
      deadline: dto.deadline ?? null,
      sessionId: dto.sessionId ?? null,
      done: dto.done ?? false,
      completedAt: dto.done && dto.completedAt ? new Date(dto.completedAt) : null,
    });
    const saved = await this.todoRepo.save(todo);
    // 带会话的待办落库即视为「加入过计划表」：待办日后被删时，
    // 历史详情能正确显示「该待办已删除」而非「没有进入计划表」（旧记录回填漏网的兜底）
    if (saved.sessionId) {
      try {
        await this.recordRepo.update({ sessionId: saved.sessionId }, { addToTodo: true });
      } catch {
        // 标记失败不影响待办创建本身
      }
    }
    return this.toRes(saved);
  }

  /** 勾选/取消勾选完成 */
  async update(userId: number, id: number, dto: UpdateTodoDto) {
    const todo = await this.getOwned(userId, id);
    if (typeof dto.done === 'boolean') {
      todo.done = dto.done;
      todo.completedAt = dto.done ? new Date() : null;
    }
    const saved = await this.todoRepo.save(todo);
    return this.toRes(saved);
  }

  /** 移出计划表：物理删除 todo 记录，但关联的 session 不受影响 */
  async remove(userId: number, id: number) {
    const todo = await this.getOwned(userId, id);
    await this.todoRepo.delete(todo.id);
    return { success: true };
  }

  /** 归档单条（标记为已归档，数据保留） */
  async archive(userId: number, id: number) {
    const todo = await this.getOwned(userId, id);
    todo.archived = true;
    const saved = await this.todoRepo.save(todo);
    return this.toRes(saved);
  }

  /** 归档全部已完成（原「一键清除」改为归档而非删除） */
  async clearDone(userId: number) {
    await this.todoRepo.update(
      { userId, done: true, archived: false },
      { archived: true },
    );
    return { success: true };
  }

  /** 会话删除时，连带删除由该会话加入计划表的待办 */
  async deleteBySession(sessionId: number) {
    await this.todoRepo.delete({ sessionId });
  }

  /** 批量：按多个会话 id 一次性删除关联待办 */
  async deleteBySessions(sessionIds: number[]) {
    if (!sessionIds.length) return;
    await this.todoRepo.delete({ sessionId: In(sessionIds) });
  }

  private async getOwned(userId: number, id: number): Promise<Todo> {
    const todo = await this.todoRepo.findOne({ where: { id } });
    if (!todo) throw new NotFoundException('待办不存在');
    if (todo.userId !== userId) throw new ForbiddenException('无权操作该待办');
    return todo;
  }

  private toRes(t: Todo) {
    return {
      id: t.id,
      taskContent: t.taskContent,
      category: t.category,
      deadline: t.deadline,
      done: t.done,
      archived: t.archived,
      sessionId: t.sessionId,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
    };
  }
}
