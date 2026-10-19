<script setup lang="ts">
import { RouterView, useRoute } from "vue-router";
import { computed } from "vue";
import NavBar from "@/components/layout/NavBar.vue";
import OnboardingGuide from "@/components/onboarding/OnboardingGuide.vue";
import FloatingHelpButton from "@/components/onboarding/FloatingHelpButton.vue";

const route = useRoute();
// 登录/注册/找回密码页隐藏导航栏
const showNavBar = computed(() => !["login", "register", "forgot-password"].includes(route.name as string));
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
  </div>
</template>
