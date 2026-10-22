// 后台管理 API（需管理员权限）
import { authRequest } from "@/api/http";
import type { Announcement, AnnouncementItem } from "@/api/announcementApi";

const BASE = "/api/admin";

export interface AdminOverview {
  totalUsers: number;
  totalVisits: number;
  todayVisits: number;
  todayActiveUsers: number;
  activeUsers: { username: string; lastActiveAt: string }[];
}

export interface AdminFeedbackItem {
  id: number;
  username: string;
  content: string;
  createdAt: string;
}

export interface UpsertAnnouncementPayload {
  title: string;
  date: string;
  items: AnnouncementItem[];
}

export interface AdminUserItem {
  id: number;
  username: string;
  email: string;
  registeredAt: string;
  lastActiveAt: string | null;
  status: "active" | "quiet" | "never";
}

export const ADMIN_USER_STATUS_LABEL: Record<AdminUserItem["status"], string> = {
  active: "活跃",
  quiet: "沉默",
  never: "未活跃",
};

export const adminApi = {
  overview() {
    return authRequest<AdminOverview>(`${BASE}/overview`);
  },
  users() {
    return authRequest<AdminUserItem[]>(`${BASE}/users`);
  },
  feedbacks() {
    return authRequest<AdminFeedbackItem[]>(`${BASE}/feedbacks`);
  },
  announcements() {
    return authRequest<Announcement[]>(`${BASE}/announcements`);
  },
  createAnnouncement(payload: UpsertAnnouncementPayload) {
    return authRequest<Announcement>(`${BASE}/announcements`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateAnnouncement(id: number, payload: UpsertAnnouncementPayload) {
    return authRequest<Announcement>(`${BASE}/announcements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteAnnouncement(id: number) {
    return authRequest<{ ok: boolean }>(`${BASE}/announcements/${id}`, {
      method: "DELETE",
    });
  },
};
