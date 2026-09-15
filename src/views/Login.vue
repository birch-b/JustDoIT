<script setup lang="ts">
// 登录页 /login
import { reactive, ref, computed } from "vue";
import { useRouter, useRoute, RouterLink } from "vue-router";
import { useUserStore } from "@/store/userStore";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import SketchCheckbox from "@/components/sketch/SketchCheckbox.vue";
import DecorDotCluster from "@/components/sketch/DecorDotCluster.vue";

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

// 被路由守卫拦截时带的回跳地址，登录成功后原路返回
const redirect = computed(() => {
  const r = route.query.redirect;
  return typeof r === "string" && r.startsWith("/") ? r : "/";
});
// 守卫带来的提示：需要先登录才能继续
const guardHint = computed(() =>
  typeof route.query.redirect === "string" ? "请先登录后再继续操作" : ""
);
// 账户注销成功后跳转回登录页的提示
const deletedHint = computed(() =>
  route.query.accountDeleted === "1" ? "账户已注销，期待下次相遇" : ""
);

const form = reactive({
  account: "",
  password: "",
});
const errorMsg = ref("");
const loading = ref(false);

async function submit() {
  errorMsg.value = "";
  if (!form.account.trim()) {
    errorMsg.value = "请输入用户名或邮箱";
    return;
  }
  if (!form.password) {
    errorMsg.value = "请输入密码";
    return;
  }
  loading.value = true;
  const res = await userStore.login({
    account: form.account.trim(),
    password: form.password,
  });
  loading.value = false;
  if (!res.ok) {
    errorMsg.value = res.msg;
    return;
  }
  router.push(redirect.value);
}
</script>

<template>
  <PageWrapper full>
    <DecorDotCluster
      :count="24"
      :spread="100"
      :safe-inset="60"
      :hollow-ratio="0.35"
    />

    <div class="flex flex-1 items-center justify-center">
      <SketchBorder padding="2.5rem" class="w-full max-w-md">
        <form class="space-y-6" @submit.prevent="submit">
          <div class="flex items-center gap-2">
            <SketchCheckbox :size="18" decorative />
            <DualTextBlock cn="欢迎回来" en="WELCOME BACK" size="md" weight="normal" />
          </div>

          <!-- 账号 -->
          <div>
            <DualTextBlock cn="账号" en="USERNAME OR EMAIL" size="sm" weight="normal" />
            <input
              v-model="form.account"
              type="text"
              class="sketch-input mt-2 w-full"
              placeholder="用户名或邮箱"
            />
          </div>

          <!-- 密码 -->
          <div>
            <DualTextBlock cn="密码" en="PASSWORD" size="sm" weight="normal" />
            <input
              v-model="form.password"
              type="password"
              class="sketch-input mt-2 w-full"
              placeholder="请输入密码"
            />
          </div>

          <!-- 守卫提示 / 注销提示 / 错误提示 -->
          <p v-if="guardHint" class="text-xs text-sketch-accent border border-sketch-accent/40 px-3 py-2">
            {{ guardHint }}
          </p>
          <p v-if="deletedHint" class="text-xs text-sketch-accent border border-sketch-accent/40 px-3 py-2">
            {{ deletedHint }}
          </p>
          <p v-if="errorMsg" class="text-xs text-sketch-line border border-sketch-line/40 px-3 py-2">
            {{ errorMsg }}
          </p>

          <!-- 操作 -->
          <div class="flex flex-col gap-3 pt-2">
            <LinearButton type="submit" size="lg" block :disabled="loading">
              <span>{{ loading ? "登录中…" : "登 录" }}</span>
            </LinearButton>
            <p class="text-center text-xs text-sketch-lineSub font-light">
              还没有账号？
              <RouterLink to="/register" class="underline hover:text-sketch-line">
                去注册
              </RouterLink>
              <span class="mx-2">·</span>
              <RouterLink to="/forgot-password" class="underline hover:text-sketch-line">
                忘记密码？
              </RouterLink>
            </p>
          </div>
        </form>
      </SketchBorder>
    </div>
  </PageWrapper>
</template>
