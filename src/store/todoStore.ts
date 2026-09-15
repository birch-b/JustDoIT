// To Do List 待办仓库：数据源为后端 MySQL；
// 首次登录时把旧版本 localStorage 里的待办一次性迁移到后端
import { defineStore } from "pinia";
import type { TodoItem, TaskCategory, ActionRecordReq } from "@/types";
import { todoApi, type TodoCreateReq } from "@/api/todoApi";
import { agentApi } from "@/api/agentApi";
import { useUserStore } from "./userStore";
import { useAgentStore } from "./agentStore";

const LEGACY_STORAGE_KEY = "jdi_todos";

interface State {
  list: TodoItem[];
  loaded: boolean;
}

export const useTodoStore = defineStore("todo", {
  state: (): State => ({
    list: [],
    loaded: false,
  }),
  getters: {
    pendingList(state) {
      return state.list
        .filter((t) => !t.done)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    doneList(state) {
      return state.list
        .filter((t) => t.done)
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
      this.loaded = false;
    },

    /** 拉取后端待办；未登录直接清空 */
    async loadTodos(): Promise<void> {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        this.resetTodos();
        return;
      }
      try {
        const list = await todoApi.list();
        this.list = list ?? [];
        this.loaded = true;
        // 旧版本 localStorage 待办：按 sessionId/内容去重后迁移
        await this.migrateLegacyTodos(this.list);
      } catch {
        this.list = [];
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

    /** 删除单条 */
    async removeTodo(id: number): Promise<void> {
      const prev = this.list;
      this.list = this.list.filter((t) => t.id !== id);
      try {
        await todoApi.remove(id);
      } catch {
        this.list = prev; // 失败回滚
      }
    },

    /** 一键清除已完成 */
    async clearDone(): Promise<void> {
      const prev = this.list;
      this.list = this.list.filter((t) => !t.done);
      try {
        await todoApi.clearDone();
      } catch {
        this.list = prev;
      }
    },
  },
});
