<script setup lang="ts">
// 顶部导航栏
// - >= 1024px (lg)：横向展开，默认打开
// - < 1024px：点击汉堡按钮后改为竖向下拉面板，默认收起
import { onBeforeUnmount, onMounted, ref, computed } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useUserStore } from "@/store/userStore";
import { useAgentStore } from "@/store/agentStore";
import NoticeBell from "@/components/layout/NoticeBell.vue";

const NARROW_BREAKPOINT = 1024; // 小于此宽度时，展开菜单改为竖向下拉
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const agentStore = useAgentStore();

const isNarrow = ref(
  typeof window !== "undefined" ? window.innerWidth < NARROW_BREAKPOINT : false,
);
// 宽屏默认展开；窄屏默认收起
const expanded = ref(!isNarrow.value);

function syncViewport() {
  const narrow = window.innerWidth < NARROW_BREAKPOINT;
  if (narrow !== isNarrow.value) {
    isNarrow.value = narrow;
    // 切换到窄屏时自动收起，避免残留横向展开状态
    if (narrow) expanded.value = false;
  }
}
onMounted(() => {
  if (!userStore.currentUser) userStore.init();
  window.addEventListener("resize", syncViewport);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", syncViewport);
});

// 窄屏（竖向菜单）：点击导航后自动收起；宽屏保持展开
function closeIfNarrow() {
  if (isNarrow.value) expanded.value = false;
}

const links = [
  { to: "/", cn: "首页", en: "Home" },
  { to: "/task-create", cn: "新的纠结", en: "New" },
  { to: "/stats", cn: "统计", en: "Stats" },
  { to: "/keywords", cn: "自我探索", en: "Self" },
];

const authLinks = computed(() => {
  const list = [{ to: "/profile", cn: "个人中心", en: "Profile" }];
  if (userStore.currentUser?.role === "admin") {
    list.push({ to: "/admin", cn: "管理", en: "Admin" });
  }
  return list;
});
function toggle() {
  expanded.value = !expanded.value;
}
function logout() {
  userStore.logout();
  agentStore.resetSessions();
  router.push("/login");
  expanded.value = false;
}
</script>
<template>
  <nav class="sticky top-0 z-30 overflow-x-clip border-b-sketch border-sketch-line/30 bg-sketch-bg/80 backdrop-blur-sm">
    <div class="mx-auto max-w-7xl px-4 py-3 md:px-6 relative">
      <div class="flex min-w-0 items-center">
        <!-- 品牌区（始终显示，靠左） -->
        <RouterLink to="/" class="flex items-center gap-2 shrink-0" @click="closeIfNarrow">
          <svg width="22" height="22" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="16" class="sketch-stroke" stroke-width="1.8" />
            <line x1="20" y1="20" x2="20" y2="8" class="sketch-stroke" stroke-width="1.8" />
            <line x1="20" y1="20" x2="28" y2="20" class="sketch-stroke" stroke-width="1.8" />
            <circle cx="20" cy="20" r="2.5" fill="#634442" />
          </svg>
          <div class="leading-tight">
            <p class="text-lg font-light tracking-wide">JUST DO IT</p>
            <p class="text-[12px] font-light text-sketch-lineSub tracking-widest">
              拍板大王
            </p>
          </div>
        </RouterLink>

        <!-- 右侧区 -->
        <div class="ml-auto flex min-w-0 flex-1 items-center justify-end">
          <!-- ============ 宽屏：横向展开 ============ -->
          <div
            v-if="!isNarrow"
            class="nav-menu flex min-w-0 items-center gap-3 overflow-x-auto overflow-y-hidden transition-all duration-700 md:gap-7 md:overflow-x-hidden"
            :style="{
              maxWidth: expanded ? '100%' : '0px',
              opacity: expanded ? '1' : '0',
              marginRight: expanded ? '2rem' : '0',
            }"
            style="transition-timing-function: cubic-bezier(0.53, 0, 0.15, 1.3);"
          >
            <div class="flex shrink-0 items-center gap-3 md:gap-7">
              <RouterLink
                v-for="l in links"
                :key="l.to"
                :to="l.to"
                class="group flex flex-col items-center whitespace-nowrap"
                :class="route.path === l.to ? 'opacity-100' : 'opacity-60 hover:opacity-100'"
              >
                <span class="text-base md:text-lg font-light">{{ l.cn }}</span>
                <span
                  class="mt-1 h-px bg-sketch-accent transition-all duration-300"
                  :class="route.path === l.to ? 'w-6' : 'w-0 group-hover:w-4'"
                />
              </RouterLink>

              <RouterLink
                v-for="l in authLinks"
                v-if="userStore.isLoggedIn"
                :key="l.to"
                :to="l.to"
                class="group flex flex-col items-center whitespace-nowrap"
                :class="route.path === l.to ? 'opacity-100' : 'opacity-60 hover:opacity-100'"
              >
                <span class="text-base md:text-lg font-light">{{ l.cn }}</span>
                <span
                  class="mt-1 h-px bg-sketch-accent transition-all duration-300"
                  :class="route.path === l.to ? 'w-6' : 'w-0 group-hover:w-4'"
                />
              </RouterLink>

              <div class="ml-1 flex shrink-0 items-center gap-2 sketch-border-l pl-2 md:ml-2 md:gap-3 md:pl-4">
                <template v-if="userStore.isLoggedIn">
                  <span class="text-sm font-light text-sketch-lineSub whitespace-nowrap">
                    {{ userStore.currentUser?.username }}
                  </span>
                  <button
                    class="text-xs text-sketch-lineSub hover:text-sketch-line whitespace-nowrap"
                    @click="logout"
                  >
                    退出
                  </button>
                </template>
                <RouterLink
                  v-else
                  to="/login"
                  class="group flex flex-col items-center opacity-60 hover:opacity-100 whitespace-nowrap"
                  :class="route.path === '/login' ? 'opacity-100' : ''"
                >
                  <span class="text-base md:text-lg font-light">登录</span>
                  <span
                    class="mt-1 h-px bg-sketch-accent transition-all duration-300"
                    :class="route.path === '/login' ? 'w-6' : 'w-0 group-hover:w-4'"
                  />
                </RouterLink>
              </div>
            </div>
          </div>

          <!-- 小铃铛：公告 + 意见反馈（仅登录后可见） -->
          <NoticeBell v-if="userStore.isLoggedIn" class="mr-1" />

          <!-- 展开/收起按钮 -->
          <button
            class="flex items-center justify-center w-10 h-10 shrink-0 hover:bg-sketch-hover transition-colors"
            @click="toggle"
            aria-label="toggle menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <line
                x1="4" y1="7" x2="20" y2="7"
                class="sketch-stroke transition-all duration-300"
                :style="expanded ? 'transform: translateY(5px) rotate(45deg);' : ''"
                style="transform-box: fill-box; transform-origin: center;"
                stroke-width="1.8" stroke-linecap="round"
              />
              <line
                x1="4" y1="12" x2="20" y2="12"
                class="sketch-stroke transition-all duration-300"
                :style="expanded ? 'opacity: 0;' : ''"
                stroke-width="1.8" stroke-linecap="round"
              />
              <line
                x1="4" y1="17" x2="20" y2="17"
                class="sketch-stroke transition-all duration-300"
                :style="expanded ? 'transform: translateY(-5px) rotate(-45deg);' : ''"
                style="transform-box: fill-box; transform-origin: center;"
                stroke-width="1.8" stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- ============ 窄屏：竖向下拉面板（占据文档流，推开下方内容） ============ -->
      <transition name="nav-drop">
        <div
          v-if="isNarrow && expanded"
          class="nav-dropdown-wrap"
        >
          <div class="nav-dropdown flex flex-col border-t border-sketch-line/20 px-2 pb-2 pt-1">
            <RouterLink
              v-for="l in links"
              :key="l.to"
              :to="l.to"
              class="flex items-center justify-between px-3 py-2.5 text-left rounded-sm transition-colors"
              :class="route.path === l.to ? 'bg-sketch-accent/10 text-sketch-line' : 'text-sketch-lineSub hover:bg-sketch-hover'"
              @click="closeIfNarrow"
            >
              <span class="text-base font-light">{{ l.cn }}</span>
            </RouterLink>

            <RouterLink
              v-for="l in authLinks"
              v-if="userStore.isLoggedIn"
              :key="l.to"
              :to="l.to"
              class="flex items-center justify-between px-3 py-2.5 text-left rounded-sm transition-colors"
              :class="route.path === l.to ? 'bg-sketch-accent/10 text-sketch-line' : 'text-sketch-lineSub hover:bg-sketch-hover'"
              @click="closeIfNarrow"
            >
              <span class="text-base font-light">{{ l.cn }}</span>
            </RouterLink>

            <!-- 分隔线 -->
            <div class="my-1 h-px bg-sketch-line/20" />

            <!-- 用户入口 -->
            <template v-if="userStore.isLoggedIn">
              <div class="flex items-center justify-between px-3 py-2">
                <span class="text-sm font-light text-sketch-lineSub">
                  {{ userStore.currentUser?.username }}
                </span>
                <button
                  class="text-xs text-sketch-lineSub hover:text-sketch-line"
                  @click="logout"
                >
                  退出
                </button>
              </div>
            </template>
            <RouterLink
              v-else
              to="/login"
              class="flex items-center justify-between px-3 py-2.5 text-left rounded-sm transition-colors"
              :class="route.path === '/login' ? 'bg-sketch-accent/10 text-sketch-line' : 'text-sketch-lineSub hover:bg-sketch-hover'"
              @click="closeIfNarrow"
            >
              <span class="text-base font-light">登录</span>
            </RouterLink>
          </div>
        </div>
      </transition>
    </div>
  </nav>
</template>

<style scoped>
.nav-menu {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.nav-menu::-webkit-scrollbar {
  display: none;
}

/* 竖向下拉面板：高度从 0 展开到内容实际高度，撑开文档流推开下方内容
   用 grid-template-rows: 0fr → 1fr，比 max-height 更精确无延迟 */
.nav-dropdown-wrap {
  display: grid;
  grid-template-rows: 1fr;
}
.nav-dropdown-wrap > * {
  overflow: hidden;
}
.nav-drop-enter-active,
.nav-drop-leave-active {
  transition: grid-template-rows 0.3s cubic-bezier(0.53, 0, 0.15, 1.3);
}
.nav-drop-enter-from,
.nav-drop-leave-to {
  grid-template-rows: 0fr;
}
.nav-drop-enter-to,
.nav-drop-leave-from {
  grid-template-rows: 1fr;
}
</style>
