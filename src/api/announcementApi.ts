// 用户端公告 API + 访问上报
import { authRequest } from "@/api/http";

export interface AnnouncementItem {
  type: "new" | "improve" | "fix";
  text: string;
}

export interface Announcement {
  id: number;
  title: string;
  date: string;
  items: AnnouncementItem[];
  createdAt: string;
}

export const ANNOUNCEMENT_TYPE_LABEL: Record<AnnouncementItem["type"], string> = {
  new: "新增",
  improve: "优化",
  fix: "修复",
};

/** 拉取公告：GET /api/announcements（后端只返回最近 7 天；接口公开，这里复用 authRequest 无妨） */
export function getAnnouncements() {
  return authRequest<Announcement[]>("/api/announcements");
}

/** 访问上报：每会话一次，尽力而为，静默失败 */
export function trackVisit() {
  const raw = localStorage.getItem("jdi_current_user");
  let token: string | null = null;
  try {
    token = raw ? (JSON.parse(raw)?.token ?? null) : null;
  } catch {
    token = null;
  }
  if (token) {
    authRequest("/api/track/visit", { method: "POST" }).catch(() => {});
  } else {
    fetch("/api/track/visit", { method: "POST" }).catch(() => {});
  }
}
