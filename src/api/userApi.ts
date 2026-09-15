// 用户接口封装层：注册 / 登录对接后端 NestJS（/api 由 Vite 代理到 3000）
import { authRequest } from "./http";

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
  /** 发送邮箱验证码：type=register 注册 / type=reset 找回密码（状态字段，后端据此区分场景） */
  sendCode(payload: { email: string; type: "register" | "reset" }) {
    return post<{ message: string }>("/send-code", payload);
  },

  /** 注册：POST /api/user/register（需邮箱验证码） */
  register(payload: {
    username: string;
    email: string;
    password: string;
    code: string;
  }) {
    return post<AuthRes>("/register", payload);
  },

  /** 登录：POST /api/user/login（username 字段支持用户名或邮箱） */
  login(payload: { username: string; password: string }) {
    return post<AuthRes>("/login", payload);
  },

  /** 忘记密码-重置密码：POST /api/user/reset-password（需 reset 类型邮箱验证码） */
  resetPassword(payload: { email: string; code: string; newPassword: string }) {
    return post<{ message: string }>("/reset-password", payload);
  },

  /** 发送注销账户验证码：POST /api/user/send-delete-code（需登录，发往绑定邮箱） */
  sendDeleteCode() {
    return authRequest<{ message: string }>(`${BASE_URL}/send-delete-code`, {
      method: "POST",
    });
  },

  /** 注销账户：POST /api/user/delete-account（需登录 + delete 类型邮箱验证码） */
  deleteAccount(code: string) {
    return authRequest<{ message: string }>(`${BASE_URL}/delete-account`, {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },
};
