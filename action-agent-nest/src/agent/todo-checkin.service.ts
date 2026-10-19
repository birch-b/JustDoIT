// 定时「做了吗」询问：每 30 分钟扫描到期未完成的待办，发一封提醒邮件。
// 站内询问卡由前端进入首页时按 checkinDueAt 判断，这里只负责邮件与频率控制。
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import * as cron from 'node-cron';
import { Todo } from './entities/todo.entity';
import { User } from '../user/entities/user.entity';
import { MailService } from '../user/mail.service';

@Injectable()
export class TodoCheckinService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TodoCheckinService.name);
  private task: cron.ScheduledTask | null = null;

  constructor(
    @InjectRepository(Todo)
    private readonly todoRepo: Repository<Todo>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mail: MailService,
  ) {}

  onModuleInit() {
    // 每 30 分钟跑一次（:07/:37，错开整点）；启动 20 秒后先补跑一轮，重启也能尽快发出
    this.task = cron.schedule('7,37 * * * *', () => void this.scan());
    const warmup = setTimeout(() => void this.scan(), 20_000);
    warmup.unref();
  }
  onModuleDestroy() {
    void this.task?.stop();
  }

  /**
   * 扫描到期待办：本轮（lastCheckinAt < checkinDueAt）只发一封，发完记录 lastCheckinAt。
   * checkinDueAt 不动：站内询问卡继续按它追问，直到用户答「做了/还没」才顺延。
   */
  private async scan() {
    try {
      const todos = await this.todoRepo.find({
        where: { done: false, archived: false, checkinDueAt: LessThanOrEqual(new Date()) },
      });
      for (const todo of todos) {
        if (
          todo.lastCheckinAt &&
          todo.checkinDueAt &&
          todo.lastCheckinAt.getTime() >= todo.checkinDueAt.getTime()
        ) {
          continue; // 本轮已问过，避免重复轰炸
        }
        const user = await this.userRepo.findOne({ where: { id: todo.userId } });
        if (!user?.email) continue;
        try {
          await this.mail.sendCheckinMail(user.email, user.username, todo.taskContent);
        } catch (e) {
          this.logger.warn(`做了吗邮件发送失败 todo#${todo.id}: ${(e as Error).message}`);
        }
        await this.todoRepo.update(todo.id, { lastCheckinAt: new Date() });
      }
    } catch (e) {
      this.logger.error(`做了吗扫描失败: ${(e as Error).message}`);
    }
  }
}
