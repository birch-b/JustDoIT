// To Do List 待办仓库：mock 阶段用 localStorage 持久化
import { defineStore } from "pinia";
import type { TodoItem, TaskCategory } from "@/types";

const STORAGE_KEY = "jdi_todos";

function loadTodos(): TodoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TodoItem[]) : [];
  } catch {
    return [];
  }
}

function saveTodos(list: TodoItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const useTodoStore = defineStore("todo", {
  state: () => {
    const list = loadTodos() as TodoItem[];
    // 从已加载数据推导下一个 id，避免刷新后 id 冲突
    const maxId = list.reduce((m, t) => Math.max(m, t.id), 0);
    return {
      list,
      nextId: maxId + 1,
    };
  },
  getters: {
    pendingList(state) {
      return state.list.filter((t) => !t.done).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    doneList(state) {
      return state.list.filter((t) => t.done).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    pendingCount(state) {
      return state.list.filter((t) => !t.done).length;
    },
  },
  actions: {
    addTodo(params: {
      taskContent: string;
      category: TaskCategory;
      deadline?: string | null;
      sessionId?: number | null;
    }) {
      const item: TodoItem = {
        id: this.nextId++,
        taskContent: params.taskContent,
        category: params.category,
        deadline: params.deadline || null,
        done: false,
        sessionId: params.sessionId ?? null,
        createdAt: new Date().toISOString(),
      };
      this.list.push(item);
      saveTodos(this.list);
    },
    toggleDone(id: number) {
      const item = this.list.find((t) => t.id === id);
      if (item) {
        item.done = !item.done;
        // 标记完成时记录时间，取消完成时清空
        item.completedAt = item.done ? new Date().toISOString() : null;
        saveTodos(this.list);
      }
    },
    removeTodo(id: number) {
      this.list = this.list.filter((t) => t.id !== id);
      saveTodos(this.list);
    },
    clearDone() {
      this.list = this.list.filter((t) => !t.done);
      saveTodos(this.list);
    },
  },
});
