// 游客模式本地存储：会话与待办全部落在浏览器 localStorage，不触达后端数据库
// 与旧版 LEGACY key（jdi_todos，登录后一次性迁移的格式）隔离，互不影响
// 本地 ID 一律用负数（从 -1 自减），避免与后端自增 ID 冲突；登录迁移时由后端重新发号
import type { AgentSessionRes, TaskCreateReq, ActionRecord, TodoItem } from "@/types";

const SESSIONS_KEY = "jdi_guest_sessions";
const TODOS_KEY = "jdi_guest_todos";

export interface GuestSessionRecord {
  session: AgentSessionRes;
  task: TaskCreateReq;
  record: ActionRecord | null;
  createdAt: string;
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, list: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // 隐私模式/超限：静默失败，内存数据仍在，刷新后丢失由横幅文案兜底提示
  }
}

/** 本地负数自减 ID：取现有最小值再减 1（无数据时从 -1 开始） */
function nextId(items: { id?: number; sessionId?: number | null }[]): number {
  let min = 0;
  for (const it of items) {
    const id = it.id ?? it.sessionId ?? 0;
    if (id < min) min = id;
  }
  return min - 1;
}

export const guestStorage = {
  loadSessions(): GuestSessionRecord[] {
    return read<GuestSessionRecord>(SESSIONS_KEY);
  },
  saveSessions(list: GuestSessionRecord[]): void {
    write(SESSIONS_KEY, list);
  },
  /** 生成下一个本地会话 ID（负数） */
  nextSessionId(): number {
    const list = read<GuestSessionRecord>(SESSIONS_KEY);
    return nextId(list.map((s) => ({ sessionId: s.session.sessionId })));
  },

  loadTodos(): TodoItem[] {
    return read<TodoItem>(TODOS_KEY);
  },
  saveTodos(list: TodoItem[]): void {
    write(TODOS_KEY, list);
  },
  nextTodoId(): number {
    return nextId(read<TodoItem>(TODOS_KEY));
  },

  /** 清空全部游客数据（登录迁移成功后调用） */
  clearAll(): void {
    localStorage.removeItem(SESSIONS_KEY);
    localStorage.removeItem(TODOS_KEY);
  },
};
