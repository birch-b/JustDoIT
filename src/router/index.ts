// vue-router 4 路由配置
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useUserStore } from "@/store/userStore";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "dashboard",
    component: () => import("@/views/Dashboard.vue"),
    meta: { title: "JUST DO IT | 试一下呢" },
  },
  {
    path: "/task-create",
    name: "task-create",
    component: () => import("@/views/TaskCreate.vue"),
    meta: { title: "新的纠结 | New Decision", requiresAuth: true },
  },
  {
    path: "/session/:id",
    name: "session",
    component: () => import("@/views/SessionResult.vue"),
    meta: { title: "Agent 结果 | Agent Result", requiresAuth: true },
    props: true,
  },
  {
    // 历史详情已合并进会话页，旧链接永久重定向
    path: "/history/:id",
    redirect: (to) => ({ name: "session", params: { id: to.params.id } }),
  },
  {
    path: "/stats",
    name: "stats",
    component: () => import("@/views/Stats.vue"),
    meta: { title: "个人统计 | Stats", requiresAuth: true },
  },
  {
    path: "/login",
    name: "login",
    component: () => import("@/views/Login.vue"),
    meta: { title: "登录 | Login" },
  },
  {
    path: "/register",
    name: "register",
    component: () => import("@/views/Register.vue"),
    meta: { title: "注册 | Register" },
  },
  {
    path: "/forgot-password",
    name: "forgot-password",
    component: () => import("@/views/ForgotPassword.vue"),
    meta: { title: "找回密码 | Reset Password" },
  },
  {
    path: "/profile",
    name: "profile",
    component: () => import("@/views/Profile.vue"),
    meta: { title: "个人中心 | Profile", requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

// 登录守卫：除首页 / 登录 / 注册 / 忘记密码外，所有页面都需要登录
router.beforeEach((to) => {
  const userStore = useUserStore();
  if (!userStore.currentUser) userStore.init();
  // 滑动过期：超过 24 小时未活跃则登出，否则刷新活跃时间戳
  const loggedIn = userStore.checkActivity();
  if (to.meta.requiresAuth && !loggedIn) {
    // 未登录/登录过期：带 redirect 回跳地址跳登录页，登录后原路返回
    return { name: "login", query: { redirect: to.fullPath } };
  }
  // 已登录用户访问登录/注册/找回密码页，跳转到个人中心
  if (
    (to.name === "login" || to.name === "register" || to.name === "forgot-password") &&
    userStore.isLoggedIn
  ) {
    return { name: "profile" };
  }
});

router.afterEach((to) => {
  const title = to.meta.title as string | undefined;
  if (title) document.title = title;
});

export default router;
