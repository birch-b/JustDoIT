// 待办计划表 CRUD：所有操作均校验归属
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Todo } from './entities/todo.entity';
import { ActionRecord } from './entities/action-record.entity';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { ReflectTodoDto } from './dto/reflect-todo.dto';
import { buildCheckinReplyPrompt } from './agent.prompt';
import { LlmService } from './llm.service';

/** 无截止时间时的默认询问间隔：24h */
const DEFAULT_CHECKIN_MS = 24 * 60 * 60 * 1000;
/** 打卡回应的 LLM 失败兜底文案 */
const CHECKIN_REPLY_FALLBACK = '记下了，又拍板又落地，这就很了不起。下次纠结，还来找大王聊。';

@Injectable()
export class TodoService {
  constructor(
    @InjectRepository(Todo)
    private readonly todoRepo: Repository<Todo>,
    @InjectRepository(ActionRecord)
    private readonly recordRepo: Repository<ActionRecord>,
    private readonly llm: LlmService,
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
    const now = new Date();
    const todo = this.todoRepo.create({
      userId,
      taskContent: dto.taskContent,
      category: dto.category,
      deadline: dto.deadline ?? null,
      sessionId: dto.sessionId ?? null,
      done: dto.done ?? false,
      completedAt: dto.done && dto.completedAt ? new Date(dto.completedAt) : null,
      // 「做了吗」询问时间：有截止时间 → 时长的 1/3；没有 → 24h 后
      checkinDueAt: dto.done ? null : this.nextCheckinDueAt(now, dto.deadline ?? null),
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
      // 完成即不再询问「做了吗」
      if (dto.done) todo.checkinDueAt = null;
    }
    const saved = await this.todoRepo.save(todo);
    return this.toRes(saved);
  }

  /**
   * 完成打卡：标记完成 + 存用户可选感受 + LLM 生成回应。
   * 回复失败不阻塞打卡，返回固定兜底文案。
   */
  async reflect(userId: number, id: number, dto: ReflectTodoDto) {
    const todo = await this.getOwned(userId, id);
    const comment = (dto.comment ?? '').trim().slice(0, 500);
    todo.done = true;
    if (!todo.completedAt) todo.completedAt = new Date();
    todo.checkinDueAt = null;
    todo.reflectionComment = comment || null;
    todo.reflectionReply = await this.generateCheckinReply(
      todo.taskContent,
      todo.category,
      comment,
    );
    const saved = await this.todoRepo.save(todo);
    return this.toRes(saved);
  }

  /** 答了「还没」（或忽略询问卡）：顺延到下一个询问点，开启新一轮 */
  async postpone(userId: number, id: number) {
    const todo = await this.getOwned(userId, id);
    const now = new Date();
    todo.lastCheckinAt = now;
    if (!todo.done) {
      todo.checkinDueAt = this.nextCheckinDueAt(now, todo.deadline);
    }
    const saved = await this.todoRepo.save(todo);
    return this.toRes(saved);
  }

  /** 计算下次询问时间：有未来截止时间就定在截止时刻，否则 24h */
  private nextCheckinDueAt(from: Date, deadline: string | null): Date {
    const dl = deadline ? new Date(deadline) : null;
    if (dl && !isNaN(dl.getTime()) && dl.getTime() > from.getTime()) {
      return dl;
    }
    return new Date(from.getTime() + DEFAULT_CHECKIN_MS);
  }

  private async generateCheckinReply(
    taskContent: string,
    category: string,
    comment: string,
  ): Promise<string> {
    try {
      const messages = buildCheckinReplyPrompt({ taskContent, category, comment });
      const text = await this.llm.chatText(messages, 0.7);
      return text || CHECKIN_REPLY_FALLBACK;
    } catch {
      return CHECKIN_REPLY_FALLBACK;
    }
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
      reflectionComment: t.reflectionComment,
      reflectionReply: t.reflectionReply,
      checkinDueAt: t.checkinDueAt ? t.checkinDueAt.toISOString() : null,
      lastCheckinAt: t.lastCheckinAt ? t.lastCheckinAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
    };
  }
}
