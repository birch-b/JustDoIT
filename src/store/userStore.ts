// Pinia 用户仓库：对接后端注册/登录，管理 JWT token 与当前用户
import { defineStore } from "pinia";
import { userApi, type AuthRes } from "@/api/userApi";
import { useAgentStore } from "@/store/agentStore";
import { useTodoStore } from "@/store/todoStore";

export interface UserInfo {
  id?: number;
  username: string;
  email: string;
  bio?: string;       // 后端暂无此字段，本地维护
  createdAt?: string; // 后端注册/登录响应未返回，展示时容错
}

interface State {
  currentUser: UserInfo | null;
  token: string | null;
  lastActiveAt: number; // 最近一次活跃时间戳（毫秒），滑动过期依据
}

const CURRENT_KEY = "jdi_current_user";
const DEFAULT_BIO = "这个人很懒，什么都没留下。";
/** 登录滑动过期时长：连续 24 小时未进入系统则登录过期，需重新登录 */
const IDLE_EXPIRE_MS = 24 * 60 * 60 * 1000;

export const useUserStore = defineStore("user", {
  state: (): State => ({
    currentUser: null,
    token: null,
    lastActiveAt: 0,
  }),

  getters: {
    isLoggedIn(state): boolean {
      return state.currentUser !== null && !!state.token;
    },
  },

  actions: {
    /** 初始化：从 localStorage 恢复登录态（兼容旧 mock 格式：直接存 user） */
    init() {
      try {
        const raw = localStorage.getItem(CURRENT_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          token?: string;
          user?: UserInfo;
          lastActiveAt?: number;
        } | UserInfo;
        if ("token" in parsed && parsed.token) {
          const lastActiveAt =
            typeof parsed.lastActiveAt === "number" ? parsed.lastActiveAt : 0;
          // 超过 24 小时未活跃（或旧数据无时间戳）：登录已过期，清除本地登录态
          if (Date.now() - lastActiveAt > IDLE_EXPIRE_MS) {
            this.clearAuth();
            return;
          }
          this.token = parsed.token;
          this.currentUser = parsed.user ?? null;
          this.lastActiveAt = lastActiveAt;
        } else {
          // 旧格式：直接是 user 对象（无 token，视为失效需重新登录）
          this.clearAuth();
        }
      } catch {
        this.clearAuth();
      }
    },

    /** 清除本地登录态（不重置业务数据） */
    clearAuth() {
      this.currentUser = null;
      this.token = null;
      this.lastActiveAt = 0;
      localStorage.removeItem(CURRENT_KEY);
    },

    /** 将当前登录态持久化到 localStorage */
    persistAuth() {
      if (!this.token || !this.currentUser) return;
      localStorage.setItem(
        CURRENT_KEY,
        JSON.stringify({
          token: this.token,
          user: this.currentUser,
          lastActiveAt: this.lastActiveAt,
        }),
      );
    },

    /**
     * 路由跳转时调用：超过 24 小时未活跃则登出（踢回登录页），
     * 否则刷新活跃时间戳实现滑动过期。返回当前是否仍处于登录态。
     */
    checkActivity(): boolean {
      if (!this.isLoggedIn) return false;
      if (Date.now() - this.lastActiveAt > IDLE_EXPIRE_MS) {
        this.logout();
        return false;
      }
      this.lastActiveAt = Date.now();
      this.persistAuth();
      return true;
    },

    /** 保存后端返回的 token + user */
    setAuth(res: AuthRes) {
      const user: UserInfo = {
        id: res.user.id,
        username: res.user.username,
        email: res.user.email,
        bio: DEFAULT_BIO,
      };
      this.token = res.token;
      this.currentUser = user;
      this.lastActiveAt = Date.now();
      this.persistAuth();
    },

    /** 注册（需邮箱验证码，成功后端直接签发 token，等同于自动登录） */
    async register(payload: {
      username: string;
      email: string;
      password: string;
      code: string;
    }): Promise<{ ok: boolean; msg: string }> {
      try {
        const res = await userApi.register(payload);
        this.setAuth(res);
        return { ok: true, msg: "注册成功" };
      } catch (e) {
        return { ok: false, msg: (e as Error).message };
      }
    },

    /** 登录（account 支持用户名或邮箱，后端字段名为 username） */
    async login(payload: {
      account: string;
      password: string;
    }): Promise<{ ok: boolean; msg: string }> {
      try {
        const res = await userApi.login({
          username: payload.account,
          password: payload.password,
        });
        this.setAuth(res);
        return { ok: true, msg: "登录成功" };
      } catch (e) {
        return { ok: false, msg: (e as Error).message };
      }
    },

    /** 退出登录：清登录态 + 清空业务数据内存（数据均在后端） */
    logout() {
      this.clearAuth();
      // store 在 action 运行时才实例化，静态 import 不会产生循环依赖问题
      useAgentStore().resetSessions();
      useTodoStore().resetTodos();
    },

    /**
     * 更新个人资料
     * 注意：后端暂无资料更新接口，bio 等修改仅在本地生效，
     * 用户名/邮箱本地修改不会同步到后端（下次登录恢复为后端数据）
     */
    updateProfile(payload: {
      username?: string;
      email?: string;
      bio?: string;
    }): { ok: boolean; msg: string } {
      if (!this.currentUser) return { ok: false, msg: "未登录" };

      const updated: UserInfo = { ...this.currentUser, ...payload };
      this.currentUser = updated;
      this.persistAuth();
      return { ok: true, msg: "资料已更新（本地生效）" };
    },
  },
});
