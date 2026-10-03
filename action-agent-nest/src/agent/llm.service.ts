// DeepSeek LLM 调用：OpenAI 兼容接口，强制返回 JSON。失败返回 null，由 AgentService fallback 到规则
import { Injectable, Logger } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { buildPrompt, LlmAdvice, LlmMessage, PersuadeMode } from './agent.prompt';

const VALID_MODES: PersuadeMode[] = [
  '温柔劝说模式',
  '激将模式',
  '理性分析模式',
];

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly baseUrl = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
  private readonly apiKey = process.env.LLM_API_KEY || '';
  private readonly model = process.env.LLM_MODEL || 'deepseek-chat';

  /** 调 DeepSeek 生成决策建议；key 未配置或调用失败返回 null（由 AgentService fallback） */
  async generateAdvice(
    dto: CreateSessionDto,
    historySummary?: string,
    memoryText?: string,
    extras?: {
      tarotCard?: string;
      answerBookText?: string;
      lastSession?: { taskContent: string; category: string; conclusion: string };
    },
  ): Promise<LlmAdvice | null> {
    const messages = buildPrompt(dto, historySummary, memoryText, extras);
    const parsed = (await this.chatJson(messages)) as LlmAdvice | null;
    if (!parsed) return null;
    // 字段校验：persuadeMode 必须是三个之一
    if (!VALID_MODES.includes(parsed.persuadeMode)) {
      this.logger.warn(`DeepSeek 返回未知 persuadeMode: ${parsed.persuadeMode}，降级为理性分析模式`);
      parsed.persuadeMode = '理性分析模式';
    }
    // 一致性兜底：shouldGo 缺失时按 index>=50 推断
    if (typeof parsed.shouldGo !== 'boolean') {
      parsed.shouldGo = parsed.agentSuggestIndex >= 50;
    }
    // 强制把 index 对齐到 shouldGo 同侧，保证前端 index>=50 的英文标签与中文结论一致
    let index = Math.max(0, Math.min(100, Math.round(parsed.agentSuggestIndex)));
    if (parsed.shouldGo && index < 55) index = 55;
    if (!parsed.shouldGo && index > 45) index = 45;
    parsed.agentSuggestIndex = index;
    return parsed;
  }

  /**
   * 通用 JSON 对话（3.5 提炼记忆复用）：key 未配置或任何失败返回 null，调用方自行兜底。
   * response_format 强制 json_object；temperature 可调（建议生成 0.7，提炼记忆 0.2 更稳定）。
   */
  async chatJson(
    messages: LlmMessage[],
    temperature = 0.7,
  ): Promise<Record<string, unknown> | null> {
    if (!this.apiKey || this.apiKey.includes('你的key')) {
      this.logger.warn('LLM_API_KEY 未配置或仍为占位符，跳过 LLM 调用');
      return null;
    }
    try {
      const resp = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          response_format: { type: 'json_object' },
          temperature,
        }),
      });
      if (!resp.ok) {
        this.logger.error(`DeepSeek API 返回 ${resp.status}: ${await resp.text()}`);
        return null;
      }
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.error('DeepSeek 返回内容为空');
        return null;
      }
      return JSON.parse(content) as Record<string, unknown>;
    } catch (e) {
      this.logger.error(`DeepSeek 调用失败: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * 通用纯文本对话（反馈后二次回复用）：不强制 JSON，返回模型的一句话文本。
   * key 未配置或任何失败返回 null，由调用方兜底。
   */
  async chatText(messages: LlmMessage[], temperature = 0.7): Promise<string | null> {
    if (!this.apiKey || this.apiKey.includes('你的key')) {
      this.logger.warn('LLM_API_KEY 未配置或仍为占位符，跳过 LLM 调用');
      return null;
    }
    try {
      const resp = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
        }),
      });
      if (!resp.ok) {
        this.logger.error(`DeepSeek API 返回 ${resp.status}: ${await resp.text()}`);
        return null;
      }
      const data = await resp.json();
      const content: unknown = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        this.logger.error('DeepSeek 文本返回为空');
        return null;
      }
      // 去掉可能的换行与多余空白，硬截断到 500 字，与存储上限对齐
      return content.replace(/\s+/g, ' ').trim().slice(0, 500);
    } catch (e) {
      this.logger.error(`DeepSeek 文本调用失败: ${(e as Error).message}`);
      return null;
    }
  }
}
