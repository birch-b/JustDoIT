// Pinia 仓库：登录用户数据走后端；游客数据存浏览器 localStorage（guestStorage）
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
import { guestStorage } from "@/utils/guestStorage";

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
        // 游客：从浏览器本地恢复（无网络请求，loadError 恒为 false）
        this.sessions = guestStorage.loadSessions();
        this.loadError = false;
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

    /**
     * 创建会话：登录用户调需鉴权接口并落库；游客调匿名接口（后端只算不存），
     * 结果换本地负数 ID 后存浏览器。失败抛出由调用方处理。
     */
    async createSession(task: TaskCreateReq): Promise<AgentSessionRes> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        const res = await agentApi.createGuestSession(task);
        const session: AgentSessionRes = {
          ...res,
          sessionId: guestStorage.nextSessionId(),
        };
        this.sessions.unshift({
          session,
          task: { ...task },
          record: null,
          createdAt: new Date().toISOString(),
        });
        guestStorage.saveSessions(this.sessions);
        return session;
      }
      const session = await agentApi.createSession(task);
      this.sessions.unshift({
        session,
        task: { ...task },
        record: null,
        createdAt: new Date().toISOString(),
      });
      return session;
    },

    /** 历史详情：优先缓存；登录用户回退拉后端，游客只查本地 */
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
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        // 游客无后端可拉：尝试从本地存储恢复（应对刷新后内存丢失）
        const local = guestStorage.loadSessions().find(
          (s) => s.session.sessionId === sessionId
        );
        if (!local) return undefined;
        if (!this.sessions.some((s) => s.session.sessionId === sessionId)) {
          this.sessions.unshift(local);
        }
        return local;
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

    /** 提交行为反馈：登录走后端；游客本地更新 + 公开接口拿 LLM 二次回复（withReply 时） */
    async submitRecord(req: ActionRecordReq): Promise<ActionRecord | undefined> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        const target = this.sessions.find(
          (s) => s.session.sessionId === req.sessionId
        );
        if (!target) return undefined;
        // 与登录用户同源：做出决定时调公开接口生成二次回复；失败静默降级为空
        let agentReply = target.record?.agentReply;
        if (req.withReply) {
          const res = await agentApi.guestFeedbackReply({
            taskContent: target.task.taskContent,
            category: target.task.category,
            conclusion: target.session.conclusion,
            persuadeMode: target.session.persuadeMode,
            persuadeText: target.session.persuadeText,
            minAction: target.session.minAction,
            accepted: req.userAcceptSuggest,
            addToTodo: req.addToTodo === true,
            comment: req.comment?.trim() ?? "",
          });
          if (res?.reply) agentReply = res.reply;
        }
        const record: ActionRecord = {
          ...req,
          recordId: target.record?.recordId ?? -Date.now(),
          feedbackComment: req.comment,
          agentReply,
          createdAt: target.record?.createdAt ?? new Date().toISOString(),
        };
        target.record = record;
        guestStorage.saveSessions(this.sessions);
        return record;
      }
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

    /** 删除会话记录：登录调后端（级联删待办）；游客本地删除并同步清掉关联待办 */
    async deleteSession(sessionId: number): Promise<boolean> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        this.sessions = this.sessions.filter(
          (s) => s.session.sessionId !== sessionId
        );
        guestStorage.saveSessions(this.sessions);
        // 关联待办一并删除（对齐后端级联行为）
        guestStorage.saveTodos(
          guestStorage.loadTodos().filter((t) => t.sessionId !== sessionId)
        );
        return true;
      }
      await agentApi.deleteSession(sessionId);
      this.sessions = this.sessions.filter(
        (s) => s.session.sessionId !== sessionId
      );
      return true;
    },

    /** 批量删除会话：登录调后端；游客本地批量删除并同步清掉关联待办 */
    async batchDeleteSessions(ids: number[]): Promise<number> {
      if (!ids.length) return 0;
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        const idSet = new Set(ids);
        this.sessions = this.sessions.filter(
          (s) => !idSet.has(s.session.sessionId)
        );
        guestStorage.saveSessions(this.sessions);
        guestStorage.saveTodos(
          guestStorage.loadTodos().filter(
            (t) => !t.sessionId || !idSet.has(t.sessionId)
          )
        );
        return ids.length;
      }
      const res = await agentApi.batchDeleteSessions(ids);
      const idSet = new Set(ids);
      this.sessions = this.sessions.filter(
        (s) => !idSet.has(s.session.sessionId)
      );
      return res.deleted;
    },
  },
});
