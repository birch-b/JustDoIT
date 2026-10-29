<script setup lang="ts">
import { RouterView, useRoute } from "vue-router";
import { computed, onMounted, watch } from "vue";
import NavBar from "@/components/layout/NavBar.vue";
import OnboardingGuide, { guideOpen } from "@/components/onboarding/OnboardingGuide.vue";
import PreferenceQuestionnaire, {
  pendingAfterGuide,
  openQuestionnaire,
} from "@/components/onboarding/PreferenceQuestionnaire.vue";
import FloatingHelpButton from "@/components/onboarding/FloatingHelpButton.vue";
import GuestSyncPrompt from "@/components/layout/GuestSyncPrompt.vue";
import { trackVisit } from "@/api/announcementApi";

const route = useRoute();
// 登录/注册/找回密码页隐藏导航栏
const showNavBar = computed(() => !["login", "register", "forgot-password"].includes(route.name as string));

// 注册流程：引导关闭后自动弹偏好问卷。监听放这里是因为注册成功会立刻跳首页，Register.vue 被卸载后其内部 watch 会失效
watch(guideOpen, (v, oldV) => {
  if (oldV && !v && pendingAfterGuide.value) {
    pendingAfterGuide.value = false;
    openQuestionnaire();
  }
});

// 访问上报：每会话一次（sessionStorage 去重），用于后台统计访问量与活跃时间
onMounted(() => {
  if (!sessionStorage.getItem("jdi_visited")) {
    sessionStorage.setItem("jdi_visited", "1");
    trackVisit();
  }
});
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <NavBar v-if="showNavBar" />
    <!-- 悬浮帮助按钮：固定右侧中间，登录/注册页不显示（与导航栏同规则） -->
    <FloatingHelpButton v-if="showNavBar" />
    <main class="flex-1">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
    <!-- 新手引导弹层：全局挂载，NavBar「?」与首页首次进入都能触发 -->
    <OnboardingGuide />
    <!-- 偏好问卷弹层：全局挂载，注册后引导或关键词页编辑都能触发 -->
    <PreferenceQuestionnaire />
    <!-- 游客数据同步询问：登录/注册后若本地仍有游客数据，由用户决定是否并入账号 -->
    <GuestSyncPrompt />
  </div>
</template>
