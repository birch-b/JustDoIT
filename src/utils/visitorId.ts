// 浏览器游客标识：首次访问生成 uuid 存 localStorage，用于后台区分「谁在临时访问」
// 与登录态无关：注册登录后仍保留，游客数据迁移时不需要它（迁移靠本地会话内容）
const KEY = "jdi_visitor_id";
let fallback = "";

/** 取（或懒生成）当前浏览器的游客标识；localStorage 不可用时退化为内存临时值 */
export function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    if (!fallback) {
      fallback = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return fallback;
  }
}
