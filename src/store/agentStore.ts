// Pinia 仓库：纯数据容器，所有业务规则由后端决定
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
import { agentApi } from "@/api/agentApi";
import { useUserStore } from "@/store/userStore";

interface PersistedSession {
  session: AgentSessionRes;
  task: TaskCreateReq;
  record: ActionRecord | null;
  createdAt: string;
}

interface State {
  sessions: PersistedSession[];
  loading: boolean;
}

const PERSUADE_MODES: PersuadeMode[] = [
  "温柔劝说模式",
  "激将模式",
  "理性分析模式",
  "塔罗模式",
];

export const useAgentStore = defineStore("agent", {
  state: (): State => ({
    sessions: [],
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
    /** 清空数据（未登录时调用，保证访客看不到任何会话） */
    resetSessions() {
      this.sessions = [];
    },

    /** 拉取当前用户历史会话列表；失败则清空（UI 已有空状态） */
    async loadSessions(): Promise<void> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        this.resetSessions();
        return;
      }
      this.loading = true;
      try {
        const list = await agentApi.listSessions();
        this.sessions = (list ?? []).map((d) => ({
          session: d.session,
          task: d.task,
          record: d.record,
          createdAt: d.createdAt,
        }));
      } catch {
        this.resetSessions();
      } finally {
        this.loading = false;
      }
    },

    /** 创建会话：纯调后端，失败抛出由调用方处理 */
    async createSession(task: TaskCreateReq): Promise<AgentSessionRes> {
      const session = await agentApi.createSession(task);
      this.sessions.unshift({
        session,
        task: { ...task },
        record: null,
        createdAt: new Date().toISOString(),
      });
      return session;
    },

    /** 历史详情：优先缓存，否则拉取后端 */
    async fetchHistory(sessionId: number): Promise<HistoryDetail | undefined> {
      const cached = this.sessions.find(
        (s) => s.session.sessionId === sessionId
      );
      if (cached) {
        return {
          session: cached.session,
          task: cached.task,
          record: cached.record,
          createdAt: cached.createdAt,
        };
      }
      try {
        const detail = await agentApi.getHistory(sessionId);
        this.sessions.unshift({
          session: detail.session,
          task: detail.task,
          record: detail.record,
          createdAt: detail.createdAt,
        });
        return detail;
      } catch {
        return undefined;
      }
    },

    /** 提交行为反馈 */
    async submitRecord(req: ActionRecordReq): Promise<ActionRecord | undefined> {
      try {
        const record = await agentApi.submitActionRecord(req);
        const target = this.sessions.find(
          (s) => s.session.sessionId === req.sessionId
        );
        if (target) target.record = record;
        return record;
      } catch {
        return undefined;
      }
    },

    /** 取会话+任务（接受建议加入计划表时需要任务原文） */
    getSessionWithTask(sessionId: number) {
      return this.sessions.find((s) => s.session.sessionId === sessionId);
    },

    /** 删除会话记录：调后端成功后移除本地缓存 */
    async deleteSession(sessionId: number): Promise<boolean> {
      await agentApi.deleteSession(sessionId);
      this.sessions = this.sessions.filter(
        (s) => s.session.sessionId !== sessionId
      );
      return true;
    },
  },
});
