// Todo 待办接口封装层：全部走后端 /api/todos（JWT 鉴权）
import type { TodoItem, TaskCategory } from "@/types";
import { authRequest } from "./http";

const BASE_URL = "/api/todos";

export interface TodoCreateReq {
  taskContent: string;
  category: TaskCategory;
  deadline?: string | null;
  sessionId?: number | null;
  /** 仅本地老数据迁移时使用 */
  done?: boolean;
  completedAt?: string | null;
}

export const todoApi = {
  /** GET /todos：当前用户未归档待办 */
  list(): Promise<TodoItem[]> {
    return authRequest<TodoItem[]>(`${BASE_URL}`);
  },

  /** GET /todos/archived：归档列表 */
  listArchived(): Promise<TodoItem[]> {
    return authRequest<TodoItem[]>(`${BASE_URL}/archived`);
  },

  /** POST /todos：新增待办 */
  create(req: TodoCreateReq): Promise<TodoItem> {
    return authRequest<TodoItem>(`${BASE_URL}`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /** PATCH /todos/:id：勾选/取消勾选 */
  toggle(id: number, done: boolean): Promise<TodoItem> {
    return authRequest<TodoItem>(`${BASE_URL}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ done }),
    });
  },

  /** POST /todos/:id/reflect：完成打卡（可选感受，Agent 生成回应） */
  reflect(id: number, comment: string): Promise<TodoItem> {
    return authRequest<TodoItem>(`${BASE_URL}/${id}/reflect`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    });
  },

  /** POST /todos/:id/postpone：答了「还没」/忽略询问，顺延到下一个询问点 */
  postpone(id: number): Promise<TodoItem> {
    return authRequest<TodoItem>(`${BASE_URL}/${id}/postpone`, {
      method: "POST",
    });
  },

  /** PATCH /todos/:id/archive：归档单条 */
  archive(id: number): Promise<TodoItem> {
    return authRequest<TodoItem>(`${BASE_URL}/${id}/archive`, {
      method: "PATCH",
    });
  },

  /** DELETE /todos/:id：移出计划表（物理删除 todo，关联 session 不受影响） */
  remove(id: number): Promise<{ success: boolean }> {
    return authRequest<{ success: boolean }>(`${BASE_URL}/${id}`, {
      method: "DELETE",
    });
  },

  /** DELETE /todos/clear-done：归档全部已完成 */
  clearDone(): Promise<{ success: boolean }> {
    return authRequest<{ success: boolean }>(`${BASE_URL}/clear-done`, {
      method: "DELETE",
    });
  },
};
