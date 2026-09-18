// 与 Nest 后端接口契约完全对齐的 TS 类型定义

// 劝说模式枚举（塔罗牌/答案之书是附加选项，不属于劝说模式）
export type PersuadeMode =
  | "温柔劝说模式"
  | "激将模式"
  | "理性分析模式";

// 纠结分类
export type TaskCategory =
  | "work"      // 工作
  | "study"     // 学习
  | "life"      // 生活琐事
  | "shopping"  // 消费购物
  | "health"    // 健康
  | "social"    // 社交
  | "other";    // 其他

// 创建任务请求体
export interface TaskCreateReq {
  taskContent: string;
  category: TaskCategory;
  willScore: number;
  energyScore: number;
  importance: number;
  expectCostMin?: number | null;  // 可空
  deadline?: string | null;        // 可空
  location: string;
  enableTarot: boolean;        // 塔罗牌（抽 1 张）
  enableAnswerBook: boolean;   // 答案之书
}

// 待办项
export interface TodoItem {
  id: number;
  taskContent: string;
  category: TaskCategory;
  deadline?: string | null;
  done: boolean;
  sessionId?: number | null;
  completedAt?: string | null;
  createdAt: string;
}

// Agent 会话返回结果
export interface AgentSessionRes {
  sessionId: number;
  agentSuggestIndex: number;
  conclusion: string;
  persuadeMode: PersuadeMode;
  persuadeText: string;
  minAction: string;
  taroCard?: string;
  /** 塔罗牌（单张，如 "愚人 · 正位"） */
  tarotCards?: string[];
  /** 答案之书的回答 */
  answerBook?: string;
  historySummary: string;
}

// 用户提交行为反馈
export interface ActionRecordReq {
  sessionId: number;
  userAcceptSuggest: boolean;
  isExecute: boolean;
  actualCostMin: number;
  executeResult: string;
}

// 用户行为记录（持久化后回显用）
export interface ActionRecord extends ActionRecordReq {
  recordId: number;
  createdAt: string;
}

// 历史会话卡片条目（首页列表用）
export interface SessionCardItem {
  sessionId: number;
  taskContent: string;
  agentSuggestIndex: number;
  conclusion: string;
  persuadeMode: PersuadeMode;
  createdAt: string;
  hasFeedback: boolean;
}

// 历史详情（包含任务输入 + agent 输出 + 反馈记录）
export interface HistoryDetail {
  session: AgentSessionRes;
  task: TaskCreateReq;
  record: ActionRecord | null;
  createdAt: string;
}

// 统计维度数据
export interface StatsData {
  totalSessions: number;
  executedCount: number;
  acceptRate: number;
  modeDistribution: Record<PersuadeMode, number>;
  willVsComplete: { willScore: number; completed: boolean }[];
}
