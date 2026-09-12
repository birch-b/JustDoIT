// Agent 接口封装层
// Mock 模式由 store 模拟后端返回；后端就绪后切换 useMock = false 即可请求真实接口
import type {
  TaskCreateReq,
  AgentSessionRes,
  ActionRecordReq,
  ActionRecord,
} from "@/types";

// 是否使用 mock（后端未就绪时为 true）
const USE_MOCK = true;

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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`请求失败 ${res.status}`);
  }
  return (await res.json()) as T;
}

export const agentApi = {
  /** 创建会话：POST /agent/session/create */
  async createSession(req: TaskCreateReq): Promise<AgentSessionRes> {
    if (USE_MOCK) {
      // 真实接口就绪后删除此分支，落入下方 request 调用
      throw new Error("mock 模式请走 store.agentStore.createMockSession");
    }
    return request<AgentSessionRes>("/session/create", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /** 获取会话详情：GET /agent/session/:id */
  async getSession(sessionId: number): Promise<AgentSessionRes> {
    if (USE_MOCK) {
      throw new Error("mock 模式请走 store.agentStore.getMockSession");
    }
    return request<AgentSessionRes>(`/session/${sessionId}`);
  },

  /** 提交行为反馈：POST /agent/action/record */
  async submitActionRecord(req: ActionRecordReq): Promise<ActionRecord> {
    if (USE_MOCK) {
      throw new Error("mock 模式请走 store.agentStore.submitMockRecord");
    }
    return request<ActionRecord>("/action/record", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /** 获取历史详情：GET /agent/history/:id */
  async getHistory(sessionId: number): Promise<unknown> {
    if (USE_MOCK) {
      throw new Error("mock 模式请走 store.agentStore.getMockHistory");
    }
    return request(`/history/${sessionId}`);
  },

  /**
   * 答案之书：GET /api/agent/answer-book?question=xxx
   * 后端已就绪，直接调真实接口；失败返回 null，由前端兜底 mock
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
   * 未配置有效 key 时后端返回 data: null，由前端兜底 mock
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

export default agentApi;
