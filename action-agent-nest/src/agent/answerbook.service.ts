// 答案之书 API 封装：调用 uapis.cn 获取随机神秘答案
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AnswerBookService {
  private readonly logger = new Logger(AnswerBookService.name);
  private readonly baseUrl = 'https://uapis.cn/api/v1/answerbook/ask';

  /**
   * 向答案之书提问，返回随机答案
   * @param question 用户的问题（任务内容）
   * @returns 答案之书的回答，失败时返回兜底文案
   */
  async ask(question: string): Promise<string> {
    try {
      const url = `${this.baseUrl}?question=${encodeURIComponent(question)}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        throw new Error(`答案之书请求失败: ${res.status}`);
      }
      const data = (await res.json()) as { question: string; answer: string };
      return data.answer;
    } catch (err) {
      this.logger.error(`答案之书调用失败: ${(err as Error).message}`);
      // 兜底随机答案，保证流程不中断
      const fallbacks = [
        '一切都会好起来',
        '现在不是最好的时机',
        '跟随你的内心',
        '再等等看',
        '答案就在你心中',
        '勇敢去做',
      ];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  }
}
