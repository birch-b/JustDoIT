<script setup lang="ts">
import { RouterView, useRoute } from "vue-router";
import { computed } from "vue";
import NavBar from "@/components/layout/NavBar.vue";

const route = useRoute();
// 登录/注册/找回密码页隐藏导航栏
const showNavBar = computed(() => !["login", "register", "forgot-password"].includes(route.name as string));
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <NavBar v-if="showNavBar" />
    <main class="flex-1">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
  </div>
</template>
