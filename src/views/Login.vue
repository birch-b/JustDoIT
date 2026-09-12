<script setup lang="ts">
// 登录页 /login
import { reactive, ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { useUserStore } from "@/store/userStore";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import SketchCheckbox from "@/components/sketch/SketchCheckbox.vue";
import DecorDotCluster from "@/components/sketch/DecorDotCluster.vue";

const router = useRouter();
const userStore = useUserStore();

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
  router.push("/");
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

          <!-- 错误提示 -->
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
            </p>
          </div>
        </form>
      </SketchBorder>
    </div>
  </PageWrapper>
</template>
