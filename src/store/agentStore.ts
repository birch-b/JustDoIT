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
import { isNetworkError, sleep } from "@/api/http";
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
  /** 最近一次列表加载是否失败（区分「真空」与「加载失败」，供页面显示重试） */
  loadError: boolean;
  /** 后端聚合的统计数据（GET /agent/stats），未加载时为 null */
  statsData: StatsData | null;
}

const PERSUADE_MODES: PersuadeMode[] = [
  "温柔劝说模式",
  "激将模式",
  "理性分析模式",
];

export const useAgentStore = defineStore("agent", {
  state: (): State => ({
    sessions: [],
    loading: false,
    loadError: false,
    statsData: null,
  }),

  getters: {
    /** 首页卡片列表 */
    cardList(state): SessionCardItem[] {
      return [...state.sessions]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((s) => ({
          sessionId: s.session.sessionId,
          taskContent: s.task.taskContent,
          category: s.task.category,
          agentSuggestIndex: s.session.agentSuggestIndex,
          conclusion: s.session.conclusion,
          persuadeMode: s.session.persuadeMode,
          createdAt: s.createdAt,
          hasFeedback: s.record !== null,
        }));
    },

    /** 统计数据：优先用后端聚合（loadStats 加载后），否则回退到本地计算 */
    stats(state): StatsData {
      if (state.statsData) return state.statsData;
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
      this.statsData = null;
      this.loadError = false;
    },

    /** 拉取后端聚合的统计数据（GET /agent/stats）；网络故障自动重试，最终失败回退本地计算 */
    async loadStats(): Promise<void> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        this.statsData = null;
        return;
      }
      const delays = [700, 1500];
      for (let attempt = 0; ; attempt++) {
        try {
          this.statsData = await agentApi.getStats();
          return;
        } catch (e) {
          if (isNetworkError(e) && attempt < delays.length) {
            await sleep(delays[attempt]);
            continue;
          }
          this.statsData = null;
          return;
        }
      }
    },

    /**
     * 拉取当前用户历史会话列表。
     * 网络故障（后端重启等）自动等待重试两次；最终失败只置 loadError，
     * 不清空已有缓存，页面据此显示「重试」而非误判为空账号。
     */
    async loadSessions(): Promise<void> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        this.resetSessions();
        return;
      }
      this.loading = true;
      this.loadError = false;
      const delays = [700, 1500];
      for (let attempt = 0; ; attempt++) {
        try {
          const list = await agentApi.listSessions();
          this.sessions = (list ?? []).map((d) => ({
            session: d.session,
            task: d.task,
            record: d.record,
            createdAt: d.createdAt,
          }));
          this.loadError = false;
          break;
        } catch (e) {
          if (isNetworkError(e) && attempt < delays.length) {
            await sleep(delays[attempt]);
            continue;
          }
          // 最终失败：保留已有数据，标记错误供页面重试
          this.loadError = true;
          break;
        }
      }
      this.loading = false;
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

    /** 批量删除会话：成功后一次性移除本地缓存，返回删除条数 */
    async batchDeleteSessions(ids: number[]): Promise<number> {
      if (!ids.length) return 0;
      const res = await agentApi.batchDeleteSessions(ids);
      const idSet = new Set(ids);
      this.sessions = this.sessions.filter(
        (s) => !idSet.has(s.session.sessionId)
      );
      return res.deleted;
    },
  },
});
