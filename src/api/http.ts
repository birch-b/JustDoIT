// 需登录的接口统一请求封装：自动带 Bearer token，401 抛出特殊错误，业务错误透传后端 message
const AUTH_STORAGE_KEY = "jdi_current_user";

/** 401/未带 token 时抛出，调用方可据此跳登录 */
export class UnauthorizedError extends Error {
  constructor(message = "未登录或登录已过期") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function readToken(): string {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? "";
  } catch {
    return "";
  }
}

/** 带鉴权头的 JSON 请求 */
export async function authRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = readToken();
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new Error("无法连接服务器，请确认后端已启动");
  }

  if (res.status === 401) {
    throw new UnauthorizedError();
  }

  const data = (await res.json().catch(() => null)) as
    | (T & { message?: string | string[] })
    | null;

  if (!res.ok) {
    const msg = data?.message;
    throw new Error(
      Array.isArray(msg) ? msg.join("；") : msg || `请求失败 ${res.status}`,
    );
  }
  return data as T;
}
