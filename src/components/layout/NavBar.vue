<script setup lang="ts">
// 顶部导航栏：可收起/展开，弹性动画；桌面默认展开并保持，移动端默认收起
import { onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useUserStore } from "@/store/userStore";
import { useAgentStore } from "@/store/agentStore";
const MOBILE_BREAKPOINT = 768; // 与 Tailwind md 断点一致
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const agentStore = useAgentStore();

const isMobile = ref(
  typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false,
);
// 桌面默认展开；移动端默认收起
const expanded = ref(!isMobile.value);

function syncViewport() {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;
}
onMounted(() => {
  if (!userStore.currentUser) userStore.init();
  window.addEventListener("resize", syncViewport);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", syncViewport);
});

// 仅移动端：点击导航后自动收起；桌面保持展开
function closeIfMobile() {
  if (isMobile.value) expanded.value = false;
}
const links = [
  { to: "/", cn: "首页", en: "Home" },
  { to: "/task-create", cn: "新的纠结", en: "New" },
  { to: "/stats", cn: "统计", en: "Stats" },
  { to: "/keywords", cn: "关键词", en: "Keywords" },
];

const authLinks = [
  { to: "/profile", cn: "个人中心", en: "Profile" },
];
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
    <div class="mx-auto max-w-7xl px-4 py-3 md:px-6">
      <div class="flex min-w-0 items-center">
        <!-- 品牌区（始终显示，靠左） -->
        <RouterLink to="/" class="flex items-center gap-2 shrink-0" @click="closeIfMobile">
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

        <!-- ✅ 右侧区 flex-1 + min-w-0：菜单只占品牌以外的剩余空间，
             超出部分在导航条内部横滑，不会把整页/汉堡挤出屏幕 -->
        <div class="ml-auto flex min-w-0 flex-1 items-center justify-end">
          <!-- 可展开的菜单区：宽度=右侧剩余空间；窄屏内部横向滑动，宽屏内容放得下不滚动 -->
          <div
            class="nav-menu flex min-w-0 items-center gap-3 overflow-x-auto overflow-y-hidden transition-all duration-700 md:gap-7 md:overflow-x-hidden"
            :style="{
              maxWidth: expanded ? '100%' : '0px',
              opacity: expanded ? '1' : '0',
              marginRight: expanded ? (isMobile ? '0.5rem' : '2rem') : '0',
            }"
            style="transition-timing-function: cubic-bezier(0.53, 0, 0.15, 1.3);"
          >
            <!-- 链接区 -->
            <div class="flex shrink-0 items-center gap-3 md:gap-7">
              <RouterLink
                v-for="l in links"
                :key="l.to"
                :to="l.to"
                class="group flex flex-col items-center whitespace-nowrap"
                :class="route.path === l.to ? 'opacity-100' : 'opacity-60 hover:opacity-100'"
                @click="closeIfMobile"
              >
                <span class="text-base md:text-lg font-light">{{ l.cn }}</span>
                <span class="text-[12px] font-light text-sketch-lineSub font-en tracking-widest">
                  {{ l.en }}
                </span>
                <span
                  class="mt-1 h-px bg-sketch-accent transition-all duration-300"
                  :class="route.path === l.to ? 'w-6' : 'w-0 group-hover:w-4'"
                />
              </RouterLink>

              <!-- 登录后显示个人中心 -->
              <RouterLink
                v-for="l in authLinks"
                v-if="userStore.isLoggedIn"
                :key="l.to"
                :to="l.to"
                class="group flex flex-col items-center whitespace-nowrap"
                :class="route.path === l.to ? 'opacity-100' : 'opacity-60 hover:opacity-100'"
                @click="closeIfMobile"
              >
                <span class="text-base md:text-lg font-light">{{ l.cn }}</span>
                <span class="text-[12px] font-light text-sketch-lineSub font-en tracking-widest">
                  {{ l.en }}
                </span>
                <span
                  class="mt-1 h-px bg-sketch-accent transition-all duration-300"
                  :class="route.path === l.to ? 'w-6' : 'w-0 group-hover:w-4'"
                />
              </RouterLink>
              <!-- 用户入口 -->
              <div class="ml-1 flex shrink-0 items-center gap-2 sketch-border-l pl-2 md:ml-2 md:gap-3 md:pl-4">
                <template v-if="userStore.isLoggedIn">
                  <span class="text-sm font-light text-sketch-lineSub whitespace-nowrap">
                    {{ userStore.currentUser?.username }}
                  </span>
                  <button
                    class="text-xs text-sketch-lineSub hover:text-sketch-line  whitespace-nowrap"
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
                  @click="closeIfMobile"
                >
                  <span class="text-base md:text-lg font-light">登录</span>
                  <span class="text-[12px] font-light text-sketch-lineSub font-en tracking-widest">
                    Login
                  </span>
                  <span
                    class="mt-1 h-px bg-sketch-accent transition-all duration-300"
                    :class="route.path === '/login' ? 'w-6' : 'w-0 group-hover:w-4'"
                  />
                </RouterLink>
              </div>
            </div>
          </div>
          <!-- 展开/收起按钮 -->
          <button
            class="flex items-center justify-center w-10 h-10 shrink-0 hover:bg-sketch-hover transition-colors"
            @click="toggle"
            aria-label="toggle menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <!-- 三条线 → X 的动画 -->
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
    </div>
  </nav>
</template>

<style scoped>
/* 移动端菜单可横向滑动但不显示滚动条，保留触摸滚动能力 */
.nav-menu {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.nav-menu::-webkit-scrollbar {
  display: none;
}
</style>
