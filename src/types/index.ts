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
  deadline: string | null;         // 可空（null = 未设置）
  location: string;
  enableTarot: boolean;        // 塔罗牌（抽 1 张）
  enableAnswerBook: boolean;   // 答案之书
  extraContext?: string;       // 补充条件（可选，一句话描述不全时补充背景/约束）
  enableWeather?: boolean;     // 今日天气加成（勾选后先查天气再打分）
  weatherCity?: string | null; // 天气·城市
  weatherText?: string | null; // 天气·摘要
  weatherScore?: number | null; // 对今日天气的打分 1-10
  itemPrice?: number | null; // 消费购物·商品价格（元）
  walletBalance?: number | null; // 消费购物·钱包余额（元）
  walletScore?: number | null; // 消费购物·钱包宽裕度 1-10
}

// 实时天气（GET /api/agent/weather 返回，未勾选天气时不涉及）
export interface WeatherInfo {
  city: string;
  weatherDesc: string;
  tempC: string;
  feelsLikeC: string;
  humidity: string;
  windText: string;
  summary: string;
}

// 省→市分组（GET /api/agent/cities 返回，第三方失败时前端回退内置城市）
export interface CityGroup {
  name: string;   // 省份展示名，如"河北""内蒙古"
  cities: string[];
}

// 待办项
export interface TodoItem {
  id: number;
  taskContent: string;
  category: TaskCategory;
  deadline?: string | null;
  done: boolean;
  /** 是否已归档（仅对已完成有意义；归档后不在计划表显示，数据保留） */
  archived: boolean;
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
  /** 塔罗牌一句话解析（LLM 结合任务生成） */
  tarotReading?: string;
  /** 答案之书的回答 */
  answerBook?: string;
  /** 答案之书一句话解读（LLM 顺着随机答案的意象圆回结论） */
  answerBookReading?: string;
  historySummary: string;
}

// 用户提交行为反馈
export interface ActionRecordReq {
  sessionId: number;
  userAcceptSuggest: boolean;
  isExecute: boolean;
  actualCostMin: number;
  executeResult: string;
  /** 可选评论（做出接受/拒绝决定时填写） */
  comment?: string;
  /** 接受后是否加入计划表 */
  addToTodo?: boolean;
  /** 是否需要 Agent 二次回复（仅决定反馈为 true，执行回写不带） */
  withReply?: boolean;
}

// 用户行为记录（持久化后回显用）
export interface ActionRecord extends ActionRecordReq {
  recordId: number;
  /** 提交时填写的评论 */
  feedbackComment?: string;
  /** Agent 对用户决定的二次回复 */
  agentReply?: string;
  createdAt: string;
}

// 历史会话卡片条目（首页列表用）
export interface SessionCardItem {
  sessionId: number;
  taskContent: string;
  category: TaskCategory;
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
