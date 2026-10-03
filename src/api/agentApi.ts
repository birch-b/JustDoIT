// Agent 接口封装层：会话/历史/反馈走真实后端（JWT 鉴权）
// 网络连不通时由 agentStore 走本地 mock 兜底；答案之书/塔罗牌为公开接口
import type {
  TaskCreateReq,
  AgentSessionRes,
  ActionRecordReq,
  ActionRecord,
  SessionCardItem,
  HistoryDetail,
  WeatherInfo,
  CityGroup,
  StatsData,
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

  /** 统计聚合：GET /agent/stats（需登录，后端聚合避免前端拉全量） */
  getStats(): Promise<StatsData> {
    return authRequest<StatsData>(`${BASE_URL}/stats`);
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

  /** 批量删除会话：DELETE /agent/sessions，body { ids }（需登录，逐个校验归属） */
  batchDeleteSessions(ids: number[]): Promise<{ success: boolean; deleted: number }> {
    return authRequest<{ success: boolean; deleted: number }>(`${BASE_URL}/sessions`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
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

  /**
   * 今日天气：GET /api/agent/weather?city=武汉
   * 公开接口；未配置 key/城市无效/网络失败时返回 null，由前端提示且不阻塞提交
   */
  async fetchWeather(city: string): Promise<WeatherInfo | null> {
    try {
      const res = await fetch(`/api/agent/weather?city=${encodeURIComponent(city)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { code: number; data: WeatherInfo | null };
      return data?.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * 自动定位查天气：GET /api/agent/weather?lat=&lng=
   * 浏览器 WGS84 经纬度 → 后端百度逆地理转城市 → whyta 天气；任一环失败返回 null
   */
  async fetchWeatherByCoords(lat: number, lng: number): Promise<WeatherInfo | null> {
    try {
      const res = await fetch(`/api/agent/weather?lat=${lat}&lng=${lng}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { code: number; data: WeatherInfo | null };
      return data?.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * 全国城市列表（省→市两级）：GET /api/agent/cities
   * mxnzp 凭证缺失/第三方失败时返回 null，调用方回退内置城市
   */
  async fetchCityGroups(): Promise<CityGroup[] | null> {
    try {
      const res = await fetch("/api/agent/cities");
      if (!res.ok) return null;
      const data = (await res.json()) as { code: number; data: CityGroup[] | null };
      return Array.isArray(data?.data) && data.data.length > 0 ? data.data : null;
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
    category: d.task.category,
    agentSuggestIndex: d.session.agentSuggestIndex,
    conclusion: d.session.conclusion,
    persuadeMode: d.session.persuadeMode,
    createdAt: d.createdAt,
    hasFeedback: d.record !== null,
  };
}

export default agentApi;
