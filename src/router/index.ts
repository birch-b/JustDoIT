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
    meta: { title: "新的纠结 | New Decision" },
  },
  {
    path: "/session/:id",
    name: "session",
    component: () => import("@/views/SessionResult.vue"),
    meta: { title: "Agent 结果 | Agent Result" },
    props: true,
  },
  {
    path: "/history/:id",
    name: "history",
    component: () => import("@/views/HistoryDetail.vue"),
    meta: { title: "历史详情 | History" },
    props: true,
  },
  {
    path: "/stats",
    name: "stats",
    component: () => import("@/views/Stats.vue"),
    meta: { title: "个人统计 | Stats" },
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

// 登录守卫
router.beforeEach((to) => {
  const userStore = useUserStore();
  if (!userStore.currentUser) userStore.init();
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    return { name: "login" };
  }
  // 已登录用户访问登录/注册页，跳转到个人中心
  if (
    (to.name === "login" || to.name === "register") &&
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
