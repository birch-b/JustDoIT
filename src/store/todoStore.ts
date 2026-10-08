// To Do List 待办仓库：数据源为后端 MySQL；
// 首次登录时把旧版本 localStorage 里的待办一次性迁移到后端
import { defineStore } from "pinia";
import type { TodoItem, TaskCategory, ActionRecordReq } from "@/types";
import { todoApi, type TodoCreateReq } from "@/api/todoApi";
import { agentApi } from "@/api/agentApi";
import { isNetworkError, sleep } from "@/api/http";
import { useUserStore } from "./userStore";
import { useAgentStore } from "./agentStore";

const LEGACY_STORAGE_KEY = "jdi_todos";

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
     * 拉取后端待办；未登录直接清空。
     * 网络故障自动等待重试两次；最终失败保留旧数据并置 loadError，
     * 不再把「连不上服务器」误显示成「还没有待办」。
     */
    async loadTodos(): Promise<void> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        this.resetTodos();
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

    /** 新增待办（接受建议时调用） */
    async addTodo(params: {
      taskContent: string;
      category: TaskCategory;
      deadline?: string | null;
      sessionId?: number | null;
    }): Promise<TodoItem | null> {
      try {
        const todo = await todoApi.create(params);
        this.list.unshift(todo);
        return todo;
      } catch {
        return null;
      }
    },

    /** 勾选/取消勾选：乐观更新本地 + PATCH 后端 + 同步会话执行状态 */
    async toggleDone(id: number): Promise<void> {
      const item = this.list.find((t) => t.id === id);
      if (!item) return;
      const nextDone = !item.done;
      // 乐观更新
      item.done = nextDone;
      item.completedAt = nextDone ? new Date().toISOString() : null;

      try {
        const updated = await todoApi.toggle(id, nextDone);
        Object.assign(item, updated);
      } catch {
        // 失败回滚
        item.done = !nextDone;
        item.completedAt = nextDone ? null : new Date().toISOString();
        return;
      }

      // 带 sessionId 的待办：同步后端 ActionRecord.isExecute
      if (item.sessionId) {
        try {
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
          const record = await agentApi.submitActionRecord(req);
          if (cached) cached.record = record;
        } catch {
          // 反馈同步失败不影响待办勾选本身
        }
      }
    },

    /** 移出计划表：物理删除 todo，关联 session 不受影响 */
    async removeTodo(id: number): Promise<void> {
      const prev = this.list;
      this.list = this.list.filter((t) => t.id !== id);
      try {
        await todoApi.remove(id);
      } catch {
        this.list = prev; // 失败回滚
      }
    },

    /** 删除归档记录：物理删除，关联 session 不受影响 */
    async removeArchived(id: number): Promise<void> {
      const prev = this.archivedItems;
      this.archivedItems = this.archivedItems.filter((t) => t.id !== id);
      try {
        await todoApi.remove(id);
      } catch {
        this.archivedItems = prev; // 失败回滚
      }
    },

    /** 归档单条：从 list 移到 archivedItems */
    async archiveTodo(id: number): Promise<void> {
      const item = this.list.find((t) => t.id === id);
      if (!item) return;
      const prev = this.list;
      this.list = this.list.filter((t) => t.id !== id);
      try {
        const updated = await todoApi.archive(id);
        this.archivedItems.unshift(updated);
      } catch {
        this.list = prev; // 失败回滚
      }
    },

    /** 归档全部已完成：list 中已完成项移到 archivedItems */
    async clearDone(): Promise<void> {
      const prevList = this.list;
      const prevArchived = this.archivedItems;
      const toArchive = this.list.filter((t) => t.done && !t.archived);
      this.list = this.list.filter((t) => !(t.done && !t.archived));
      this.archivedItems = [...toArchive, ...this.archivedItems];
      try {
        await todoApi.clearDone();
      } catch {
        this.list = prevList;
        this.archivedItems = prevArchived;
      }
    },

    /** 拉取归档记录 */
    async loadArchived(): Promise<void> {
      try {
        this.archivedItems = (await todoApi.listArchived()) ?? [];
      } catch {
        this.archivedItems = [];
      }
    },
  },
});
