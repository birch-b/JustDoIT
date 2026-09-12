// Pinia 仓库：mock 阶段模拟后端，存储会话、历史与反馈记录
import { defineStore } from "pinia";
import type {
  TaskCreateReq,
  AgentSessionRes,
  ActionRecordReq,
  ActionRecord,
  SessionCardItem,
  HistoryDetail,
  PersuadeMode,
  StatsData,
} from "@/types";

interface PersistedSession {
  session: AgentSessionRes;
  task: TaskCreateReq;
  record: ActionRecord | null;
  createdAt: string;
}

interface State {
  sessions: PersistedSession[];
  nextSessionId: number;
  nextRecordId: number;
  loading: boolean;
}

const PERSUADE_MODES: PersuadeMode[] = [
  "温柔劝说模式",
  "激将模式",
  "理性分析模式",
  "塔罗模式",
];

const TAROT_CARDS = ["愚人", "魔术师", "女祭司", "皇后", "皇帝", "教皇", "恋人", "战车", "力量", "隐者", "命运之轮", "正义", "倒吊人", "死神", "节制", "恶魔", "塔", "星星", "月亮", "太阳"];

// 答案之书 mock 回答
const ANSWER_BOOK = [
  "一切都会好起来。",
  "答案会让你学会宽恕。",
  "现在就是最好的时机。",
  "相信你的直觉。",
  "再等等，风会来的。",
  "去做，结果比你想的好。",
  "放下执念，答案自现。",
  "是的，毫不犹豫。",
  "先照顾好自己。",
  "这件事值得你全力以赴。",
];

// 随机抽 n 张不重复的塔罗牌
function drawTarot(n: number): string[] {
  const pool = [...TAROT_CARDS];
  const result: string[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

// mock：根据任务输入简单推导行动指数与劝说模式
function buildMockSession(
  taskId: number,
  task: TaskCreateReq
): AgentSessionRes {
  // 行动指数：意愿、精力、重要度的加权，并加入轻微扰动
  const base =
    task.willScore * 5 + task.energyScore * 3 + task.importance * 2;
  const agentSuggestIndex = Math.max(
    5,
    Math.min(98, Math.round(base + (task.willScore - 5) * 2))
  );

  // 劝说模式选择
  let persuadeMode: PersuadeMode = "理性分析模式";
  if (task.enableTarot) {
    persuadeMode = "塔罗模式";
  } else if (agentSuggestIndex < 40) {
    persuadeMode = "激将模式";
  } else if (agentSuggestIndex < 70) {
    persuadeMode = "温柔劝说模式";
  }

  const shouldGo = agentSuggestIndex >= 50;
  const conclusion = shouldGo
    ? "去做，趁现在状态在线"
    : "暂缓，今天不建议强行做";

  const persuadeTextMap: Record<PersuadeMode, string> = {
    温柔劝说模式: "没关系，慢慢来。完成比完美更重要，先迈出第一步。",
    激将模式: "你不是一直说要做吗？现在退缩，下一秒就会后悔。",
    理性分析模式:
      "综合意愿、精力与重要度评估，当前行动收益高于拖延成本，建议执行。",
    塔罗模式: "牌面提示转机已至，行动本身即是答案。",
  };

  // 塔罗抽 1 张
  const tarotCards = task.enableTarot ? drawTarot(1) : undefined;

  return {
    sessionId: taskId,
    agentSuggestIndex,
    conclusion,
    persuadeMode,
    persuadeText: persuadeTextMap[persuadeMode],
    minAction: shouldGo
      ? `先做 5 分钟：${task.taskContent.slice(0, 12)}…`
      : "今天先记录下来，明天再启动。",
    taroCard: tarotCards ? tarotCards[0] : undefined,
    tarotCards,
    answerBook: task.enableAnswerBook
      ? ANSWER_BOOK[Math.floor(Math.random() * ANSWER_BOOK.length)]
      : undefined,
    historySummary: "你过去 3 次类似任务，2 次执行，1 次推迟后补做。",
  };
}

function nowStr(): string {
  return new Date().toISOString();
}

export const useAgentStore = defineStore("agent", {
  state: (): State => ({
    sessions: [],
    nextSessionId: 1,
    nextRecordId: 1,
    loading: false,
  }),

  getters: {
    /** 首页卡片列表 */
    cardList(state): SessionCardItem[] {
      return [...state.sessions]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((s) => ({
          sessionId: s.session.sessionId,
          taskContent: s.task.taskContent,
          agentSuggestIndex: s.session.agentSuggestIndex,
          conclusion: s.session.conclusion,
          persuadeMode: s.session.persuadeMode,
          createdAt: s.createdAt,
          hasFeedback: s.record !== null,
        }));
    },

    /** 统计数据 */
    stats(state): StatsData {
      const total = state.sessions.length;
      const executed = state.sessions.filter(
        (s) => s.record?.isExecute
      ).length;
      const accepted = state.sessions.filter(
        (s) => s.record?.userAcceptSuggest
      ).length;

      const modeDistribution = PERSUADE_MODES.reduce(
        (acc, m) => {
          acc[m] = state.sessions.filter(
            (s) => s.session.persuadeMode === m
          ).length;
          return acc;
        },
        {} as Record<PersuadeMode, number>
      );

      return {
        totalSessions: total,
        executedCount: executed,
        acceptRate: total ? Math.round((accepted / total) * 100) : 0,
        modeDistribution,
        willVsComplete: state.sessions
          .filter((s) => s.record)
          .map((s) => ({
            willScore: s.task.willScore,
            completed: Boolean(s.record?.isExecute),
          })),
      };
    },
  },

  actions: {
    /** mock：创建会话 */
    createMockSession(task: TaskCreateReq): AgentSessionRes {
      const sessionId = this.nextSessionId++;
      const session = buildMockSession(sessionId, task);
      this.sessions.push({
        session,
        task: { ...task },
        record: null,
        createdAt: nowStr(),
      });
      return session;
    },

    /** mock：取会话 */
    getMockSession(sessionId: number): AgentSessionRes | undefined {
      return this.sessions.find((s) => s.session.sessionId === sessionId)
        ?.session;
    },

    /** mock：取会话+任务（用于加入计划表等需要任务原文的场景） */
    getMockSessionWithTask(sessionId: number) {
      return this.sessions.find((s) => s.session.sessionId === sessionId);
    },

    /** mock：提交反馈 */
    submitMockRecord(req: ActionRecordReq): ActionRecord | undefined {
      const target = this.sessions.find(
        (s) => s.session.sessionId === req.sessionId
      );
      if (!target) return undefined;
      const record: ActionRecord = {
        ...req,
        recordId: this.nextRecordId++,
        createdAt: nowStr(),
      };
      target.record = record;
      return record;
    },

    /** mock：取历史详情 */
    getMockHistory(sessionId: number): HistoryDetail | undefined {
      const target = this.sessions.find(
        (s) => s.session.sessionId === sessionId
      );
      if (!target) return undefined;
      return {
        session: target.session,
        task: target.task,
        record: target.record,
        createdAt: target.createdAt,
      };
    },

    /** mock：注入示例数据，便于演示 */
    seedDemoData() {
      if (this.sessions.length > 0) return;
      const samples: TaskCreateReq[] = [
        {
          taskContent: "完成项目周报并同步给团队",
          category: "work",
          willScore: 8,
          energyScore: 6,
          importance: 9,
          expectCostMin: 45,
          deadline: "今日 18:00",
          location: "公司",
          enableTarot: false,
          enableAnswerBook: true,
        },
        {
          taskContent: "整理上周读书笔记",
          category: "study",
          willScore: 4,
          energyScore: 5,
          importance: 5,
          expectCostMin: 30,
          deadline: "今晚 22:00",
          location: "家",
          enableTarot: false,
          enableAnswerBook: false,
        },
        {
          taskContent: "给客户发跟进邮件",
          category: "work",
          willScore: 6,
          energyScore: 7,
          importance: 8,
          expectCostMin: 15,
          deadline: "今日 12:00",
          location: "公司",
          enableTarot: true,
          enableAnswerBook: true,
        },
      ];
      samples.forEach((t) => {
        const session = this.createMockSession(t);
        // 给第一条补一个反馈记录，方便历史/统计演示
        if (session.sessionId === 1) {
          this.submitMockRecord({
            sessionId: 1,
            userAcceptSuggest: true,
            isExecute: true,
            actualCostMin: 50,
            executeResult: "顺利完成，团队反馈良好",
          });
        }
      });
    },
  },
});
