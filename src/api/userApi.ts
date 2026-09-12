// 用户接口封装层：注册 / 登录对接后端 NestJS（/api 由 Vite 代理到 3000）
const BASE_URL = "/api/user";

/** 后端返回的用户信息 */
export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

/** 注册/登录成功响应 */
export interface AuthRes {
  token: string;
  user: AuthUser;
}

/** 统一 POST：失败时抛出带后端 message 的 Error */
async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("无法连接服务器，请确认后端已启动");
  }

  const data = (await res.json().catch(() => null)) as
    | (T & { message?: string | string[] })
    | null;

  if (!res.ok) {
    const msg = data?.message;
    throw new Error(
      Array.isArray(msg) ? msg.join("；") : msg || "请求失败，请稍后重试",
    );
  }
  return data as T;
}

export const userApi = {
  /** 注册：POST /api/user/register */
  register(payload: { username: string; email: string; password: string }) {
    return post<AuthRes>("/register", payload);
  },

  /** 登录：POST /api/user/login（username 字段支持用户名或邮箱） */
  login(payload: { username: string; password: string }) {
    return post<AuthRes>("/login", payload);
  },
};
