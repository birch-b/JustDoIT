<script setup lang="ts">
// 顶部导航栏：可收起/展开，弹性动画
import { ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useUserStore } from "@/store/userStore";
import { useAgentStore } from "@/store/agentStore";
import { onMounted } from "vue";
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const agentStore = useAgentStore();
const expanded = ref(true);
onMounted(() => {
  if (!userStore.currentUser) userStore.init();
});
const links = [
  { to: "/", cn: "首页", en: "Home" },
  { to: "/task-create", cn: "新的纠结", en: "New" },
  { to: "/stats", cn: "统计", en: "Stats" },
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
  <nav class="sticky top-0 z-30 border-b-sketch border-sketch-line/30 bg-sketch-bg/80 backdrop-blur-sm">
    <div class="mx-auto max-w-7xl px-4 py-3 md:px-6">
      <div class="flex items-center">
        <!-- 品牌区（始终显示，靠左） -->
        <RouterLink to="/" class="flex items-center gap-2 shrink-0" @click="expanded = false">
          <svg width="22" height="22" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="16" class="sketch-stroke" stroke-width="1.8" />
            <line x1="20" y1="20" x2="20" y2="8" class="sketch-stroke" stroke-width="1.8" />
            <line x1="20" y1="20" x2="28" y2="20" class="sketch-stroke" stroke-width="1.8" />
            <circle cx="20" cy="20" r="2.5" fill="#634442" />
          </svg>
          <div class="leading-tight">
            <p class="text-lg font-light tracking-wide">JUST DO IT</p>
            <p class="text-[12px] font-light text-sketch-lineSub font-en tracking-widest">
              试一下呢
            </p>
          </div>
        </RouterLink>

        <!-- ✅ ml-auto：把菜单+汉堡整体挤到最右边 -->
        <div class="flex items-center ml-auto">
          <!-- 可展开的菜单区 -->
          <div
            class="nav-menu flex items-center gap-4 md:gap-7 overflow-hidden transition-all duration-700"
            :style="{
              maxWidth: expanded ? '640px' : '0px',
              opacity: expanded ? '1' : '0',
              marginRight: expanded ? '2rem' : '0',
            }"
            style="transition-timing-function: cubic-bezier(0.53, 0, 0.15, 1.3);"
          >
            <!-- 链接区 -->
            <div class="flex items-center gap-4 md:gap-7">
              <RouterLink
                v-for="l in links"
                :key="l.to"
                :to="l.to"
                class="group flex flex-col items-center whitespace-nowrap"
                :class="route.path === l.to ? 'opacity-100' : 'opacity-60 hover:opacity-100'"
                @click="expanded = false"
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
                @click="expanded = false"
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
              <div class="ml-2 flex items-center gap-3 sketch-border-l pl-4">
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
                  @click="expanded = false"
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
