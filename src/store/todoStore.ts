// To Do List 待办仓库：登录用户数据源为后端 MySQL；游客数据源为浏览器 localStorage；
// 首次登录时把旧版本 localStorage 里的待办一次性迁移到后端
import { defineStore } from "pinia";
import type { TodoItem, TaskCategory, ActionRecordReq } from "@/types";
import { todoApi, type TodoCreateReq } from "@/api/todoApi";
import { agentApi } from "@/api/agentApi";
import { isNetworkError, sleep } from "@/api/http";
import { useUserStore } from "./userStore";
import { useAgentStore } from "./agentStore";
import { guestStorage } from "@/utils/guestStorage";

const LEGACY_STORAGE_KEY = "jdi_todos";

/** 游客持久化：active + archived 合并为一个数组写回（archived 标志区分） */
function persistGuest(list: TodoItem[], archivedItems: TodoItem[]): void {
  guestStorage.saveTodos([...list, ...archivedItems]);
}

interface State {
  list: TodoItem[];
  /** 归档记录（已完成且已归档，与 list 分离避免 getter 冲突） */
  archivedItems: TodoItem[];
  loaded: boolean;
  /** 最近一次加载是否失败（网络故障），供页面显示重试 */
  loadError: boolean;
}

export const useTodoStore = defineStore("todo", {
  state: (): State => ({
    list: [],
    archivedItems: [],
    loaded: false,
    loadError: false,
  }),
  getters: {
    pendingList(state) {
      return state.list
        .filter((t) => !t.done)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    doneList(state) {
      return state.list
        .filter((t) => t.done && !t.archived)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    /** 归档记录（已完成且已归档，独立数组） */
    archivedList(state) {
      return state.archivedItems
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    pendingCount(state) {
      return state.list.filter((t) => !t.done).length;
    },
  },
  actions: {
    /** 登出时清空内存（数据都在后端） */
    resetTodos() {
      this.list = [];
      this.archivedItems = [];
      this.loaded = false;
      this.loadError = false;
    },

    /**
     * 拉取后端待办；游客读浏览器本地。
     * 网络故障自动等待重试两次；最终失败保留旧数据并置 loadError，
     * 不再把「连不上服务器」误显示成「还没有待办」。
     */
    async loadTodos(): Promise<void> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        // 游客：从浏览器本地恢复（active 与 archived 按标志位拆开）
        const all = guestStorage.loadTodos();
        this.list = all.filter((t) => !t.archived);
        this.archivedItems = all.filter((t) => t.archived);
        this.loaded = true;
        this.loadError = false;
        return;
      }
      this.loadError = false;
      const delays = [700, 1500];
      for (let attempt = 0; ; attempt++) {
        try {
          const list = await todoApi.list();
          this.list = list ?? [];
          this.loaded = true;
          // 旧版本 localStorage 待办：按 sessionId/内容去重后迁移
          await this.migrateLegacyTodos(this.list);
          this.loadError = false;
          return;
        } catch (e) {
          if (isNetworkError(e) && attempt < delays.length) {
            await sleep(delays[attempt]);
            continue;
          }
          this.loadError = true;
          return;
        }
      }
    },

    /**
     * 迁移老的本地待办：
     * - 带 sessionId 的：后端不存在同 sessionId 待办时才迁移
     * - 手动待办（无 sessionId）：按内容去重
     * 全部处理完（或后端已有等价数据）后删除本地 key
     */
    async migrateLegacyTodos(serverTodos: TodoItem[]): Promise<void> {
      let legacy: TodoItem[] = [];
      try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        legacy = raw ? (JSON.parse(raw) as TodoItem[]) : [];
      } catch {
        legacy = [];
      }
      if (legacy.length === 0) return;

      const exists = (t: TodoItem) =>
        serverTodos.some(
          (s) =>
            (t.sessionId && s.sessionId === t.sessionId) ||
            (!t.sessionId && s.taskContent === t.taskContent)
        );

      for (const t of legacy) {
        if (exists(t)) continue;
        const req: TodoCreateReq = {
          taskContent: t.taskContent,
          category: t.category,
          deadline: t.deadline ?? null,
          sessionId: t.sessionId ?? null,
          done: t.done,
          completedAt: t.completedAt ?? null,
        };
        try {
          const created = await todoApi.create(req);
          this.list.push(created);
        } catch {
          // 单条失败则中断迁移，保留本地数据下次再试
          return;
        }
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    },

    /** 新增待办（接受建议时调用）；游客写本地 */
    async addTodo(params: {
      taskContent: string;
      category: TaskCategory;
      deadline?: string | null;
      sessionId?: number | null;
    }): Promise<TodoItem | null> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        const todo: TodoItem = {
          id: guestStorage.nextTodoId(),
          taskContent: params.taskContent,
          category: params.category,
          deadline: params.deadline ?? null,
          done: false,
          archived: false,
          sessionId: params.sessionId ?? null,
          createdAt: new Date().toISOString(),
        };
        this.list.unshift(todo);
        persistGuest(this.list, this.archivedItems);
        return todo;
      }
      try {
        const todo = await todoApi.create(params);
        this.list.unshift(todo);
        return todo;
      } catch {
        return null;
      }
    },

    /** 勾选/取消勾选：乐观更新本地 + PATCH 后端 + 同步会话执行状态；游客全本地 */
    async toggleDone(id: number): Promise<void> {
      const item = this.list.find((t) => t.id === id);
      if (!item) return;
      const nextDone = !item.done;
      const userStore = useUserStore();

      // 乐观更新
      item.done = nextDone;
      item.completedAt = nextDone ? new Date().toISOString() : null;

      if (userStore.isLoggedIn) {
        try {
          const updated = await todoApi.toggle(id, nextDone);
          Object.assign(item, updated);
        } catch {
          // 失败回滚
          item.done = !nextDone;
          item.completedAt = nextDone ? null : new Date().toISOString();
          return;
        }
      } else {
        persistGuest(this.list, this.archivedItems);
      }

      // 带 sessionId 的待办：同步会话 ActionRecord.isExecute（登录走后端，游客走本地）
      if (item.sessionId) {
        const agentStore = useAgentStore();
        const cached = agentStore.getSessionWithTask(item.sessionId);
        const existingRecord = cached?.record;
        const req: ActionRecordReq = {
          sessionId: item.sessionId,
          userAcceptSuggest: existingRecord?.userAcceptSuggest ?? item.done,
          isExecute: item.done,
          actualCostMin: existingRecord?.actualCostMin ?? 0,
          executeResult: existingRecord?.executeResult ?? "",
        };
        // store 内部按登录态分流；失败不影响待办勾选本身
        await agentStore.submitRecord(req);
      }
    },

    /** 完成打卡：标记完成 + 可选感受 + Agent 回应（替代直接勾完成）；游客不生成回应 */
    async reflectDone(id: number, comment: string): Promise<TodoItem> {
      const item = this.list.find((t) => t.id === id);
      const userStore = useUserStore();

      // 游客：本地标记完成 + 存感受 + 公开接口拿打卡回应；失败降级为空
      if (!userStore.isLoggedIn) {
        const res = item
          ? await agentApi.guestCheckinReply({
              taskContent: item.taskContent,
              category: item.category,
              comment: comment.trim(),
            })
          : null;
        const updated: TodoItem = {
          ...(item as TodoItem),
          done: true,
          completedAt: new Date().toISOString(),
          reflectionComment: comment || null,
          reflectionReply: res?.reply ?? null,
        };
        if (item) Object.assign(item, updated);
        persistGuest(this.list, this.archivedItems);
        if (updated.sessionId) {
          const agentStore = useAgentStore();
          const cached = agentStore.getSessionWithTask(updated.sessionId);
          const existingRecord = cached?.record;
          await agentStore.submitRecord({
            sessionId: updated.sessionId,
            userAcceptSuggest: existingRecord?.userAcceptSuggest ?? true,
            isExecute: true,
            actualCostMin: existingRecord?.actualCostMin ?? 0,
            executeResult: existingRecord?.executeResult ?? "",
          });
        }
        return updated;
      }

      const updated = await todoApi.reflect(id, comment);
      if (item) Object.assign(item, updated);

      // 带 sessionId 的待办：同步后端 ActionRecord.isExecute（与 toggleDone 一致）
      if (updated.sessionId) {
        try {
          const agentStore = useAgentStore();
          const cached = agentStore.getSessionWithTask(updated.sessionId);
          const existingRecord = cached?.record;
          const req: ActionRecordReq = {
            sessionId: updated.sessionId,
            userAcceptSuggest: existingRecord?.userAcceptSuggest ?? true,
            isExecute: true,
            actualCostMin: existingRecord?.actualCostMin ?? 0,
            executeResult: existingRecord?.executeResult ?? "",
          };
          const record = await agentApi.submitActionRecord(req);
          if (cached) cached.record = record;
        } catch {
          // 反馈同步失败不影响打卡本身
        }
      }
      return updated;
    },

    /** 答了「还没」/忽略询问：顺延到下一个询问点；游客本地顺延一天 */
    async postponeCheckin(id: number): Promise<void> {
      const item = this.list.find((t) => t.id === id);
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        if (item) {
          const next = new Date();
          next.setDate(next.getDate() + 1);
          item.lastCheckinAt = new Date().toISOString();
          item.checkinDueAt = next.toISOString();
          persistGuest(this.list, this.archivedItems);
        }
        return;
      }
      const updated = await todoApi.postpone(id);
      if (item) Object.assign(item, updated);
    },

    /** 移出计划表：物理删除 todo，关联 session 不受影响；游客本地删除 */
    async removeTodo(id: number): Promise<void> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        this.list = this.list.filter((t) => t.id !== id);
        persistGuest(this.list, this.archivedItems);
        return;
      }
      const prev = this.list;
      this.list = this.list.filter((t) => t.id !== id);
      try {
        await todoApi.remove(id);
      } catch {
        this.list = prev; // 失败回滚
      }
    },

    /** 删除归档记录：物理删除，关联 session 不受影响；游客本地删除 */
    async removeArchived(id: number): Promise<void> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        this.archivedItems = this.archivedItems.filter((t) => t.id !== id);
        persistGuest(this.list, this.archivedItems);
        return;
      }
      const prev = this.archivedItems;
      this.archivedItems = this.archivedItems.filter((t) => t.id !== id);
      try {
        await todoApi.remove(id);
      } catch {
        this.archivedItems = prev; // 失败回滚
      }
    },

    /** 归档单条：从 list 移到 archivedItems；游客本地移动 */
    async archiveTodo(id: number): Promise<void> {
      const item = this.list.find((t) => t.id === id);
      if (!item) return;
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        item.archived = true;
        this.list = this.list.filter((t) => t.id !== id);
        this.archivedItems.unshift(item);
        persistGuest(this.list, this.archivedItems);
        return;
      }
      const prev = this.list;
      this.list = this.list.filter((t) => t.id !== id);
      try {
        const updated = await todoApi.archive(id);
        this.archivedItems.unshift(updated);
      } catch {
        this.list = prev; // 失败回滚
      }
    },

    /** 归档全部已完成：list 中已完成项移到 archivedItems；游客本地移动 */
    async clearDone(): Promise<void> {
      const prevList = this.list;
      const prevArchived = this.archivedItems;
      const toArchive = this.list.filter((t) => t.done && !t.archived);
      this.list = this.list.filter((t) => !(t.done && !t.archived));
      this.archivedItems = [...toArchive, ...this.archivedItems];
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        toArchive.forEach((t) => (t.archived = true));
        persistGuest(this.list, this.archivedItems);
        return;
      }
      try {
        await todoApi.clearDone();
      } catch {
        this.list = prevList;
        this.archivedItems = prevArchived;
      }
    },

    /** 拉取归档记录；游客从本地派生（loadTodos 已拆分，这里兜底保证一致） */
    async loadArchived(): Promise<void> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        this.archivedItems = guestStorage.loadTodos().filter((t) => t.archived);
        return;
      }
      try {
        this.archivedItems = (await todoApi.listArchived()) ?? [];
      } catch {
        this.archivedItems = [];
      }
    },
  },
});
