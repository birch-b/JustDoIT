// Agent 接口封装层：会话/历史/反馈走真实后端（JWT 鉴权）
// 网络连不通时由 agentStore 走本地 mock 兜底；答案之书/塔罗牌为公开接口
import type {
  TaskCreateReq,
  AgentSessionRes,
  ActionRecordReq,
  ActionRecord,
  SessionCardItem,
  HistoryDetail,
} from "@/types";
import { authRequest } from "./http";

const BASE_URL = "/api/agent";

/** 塔罗牌（后端真实返回结构） */
export interface TarotCardRes {
  cardName: string;
  orientation: string; // 正位 / 逆位
  keywords: string;
  description: string;
  advice: string;
  imageUrl: string;
}

export const agentApi = {
  /** 创建会话：POST /agent/session/create（需登录） */
  createSession(req: TaskCreateReq): Promise<AgentSessionRes> {
    return authRequest<AgentSessionRes>(`${BASE_URL}/session/create`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /** 获取会话详情：GET /agent/session/:id（需登录） */
  getSession(sessionId: number): Promise<AgentSessionRes> {
    return authRequest<AgentSessionRes>(`${BASE_URL}/session/${sessionId}`);
  },

  /** 历史会话列表：GET /agent/sessions（需登录，返回完整详情数组用于卡片+统计） */
  listSessions(): Promise<HistoryDetail[]> {
    return authRequest<HistoryDetail[]>(`${BASE_URL}/sessions`);
  },

  /** 提交行为反馈：POST /agent/action/record（需登录） */
  submitActionRecord(req: ActionRecordReq): Promise<ActionRecord> {
    return authRequest<ActionRecord>(`${BASE_URL}/action/record`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /** 获取历史详情：GET /agent/history/:id（需登录） */
  getHistory(sessionId: number): Promise<HistoryDetail> {
    return authRequest<HistoryDetail>(`${BASE_URL}/history/${sessionId}`);
  },

  /** 删除会话记录：DELETE /agent/session/:id（需登录，校验归属） */
  deleteSession(sessionId: number): Promise<{ success: boolean }> {
    return authRequest<{ success: boolean }>(`${BASE_URL}/session/${sessionId}`, {
      method: "DELETE",
    });
  },

  /**
   * 答案之书：GET /api/agent/answer-book?question=xxx
   * 公开接口；失败返回 null，由前端兜底 mock
   */
  async fetchAnswerBook(question: string): Promise<string | null> {
    try {
      const res = await fetch(
        `/api/agent/answer-book?question=${encodeURIComponent(question)}`
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { code: number; data: { answer: string } };
      return data?.data?.answer ?? null;
    } catch {
      return null;
    }
  },

  /**
   * 塔罗牌：POST /api/agent/tarot（单张）
   * 公开接口；未配置有效 key 时后端返回 data: null，由前端兜底 mock
   */
  async fetchTarot(topicId = 5): Promise<TarotCardRes[] | null> {
    try {
      const res = await fetch("/api/agent/tarot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { code: number; data: { cards: TarotCardRes[] } | null };
      return data?.data?.cards ?? null;
    } catch {
      return null;
    }
  },
};

/** 首页卡片列表由 HistoryDetail[] 映射得到 */
export function toCardItem(d: HistoryDetail): SessionCardItem {
  return {
    sessionId: d.session.sessionId,
    taskContent: d.task.taskContent,
    agentSuggestIndex: d.session.agentSuggestIndex,
    conclusion: d.session.conclusion,
    persuadeMode: d.session.persuadeMode,
    createdAt: d.createdAt,
    hasFeedback: d.record !== null,
  };
}

export default agentApi;
