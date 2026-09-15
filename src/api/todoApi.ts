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
  /** GET /todos：当前用户全部待办 */
  list(): Promise<TodoItem[]> {
    return authRequest<TodoItem[]>(`${BASE_URL}`);
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

  /** DELETE /todos/:id：删除单条 */
  remove(id: number): Promise<{ success: boolean }> {
    return authRequest<{ success: boolean }>(`${BASE_URL}/${id}`, {
      method: "DELETE",
    });
  },

  /** DELETE /todos/clear-done：一键清除已完成 */
  clearDone(): Promise<{ success: boolean }> {
    return authRequest<{ success: boolean }>(`${BASE_URL}/clear-done`, {
      method: "DELETE",
    });
  },
};
