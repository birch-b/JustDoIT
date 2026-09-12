<script setup lang="ts">
// 注册页 /register
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
  username: "",
  email: "",
  password: "",
  confirm: "",
});
const errorMsg = ref("");
const loading = ref(false);

async function submit() {
  errorMsg.value = "";
  if (!form.username.trim()) {
    errorMsg.value = "请填写用户名";
    return;
  }
  if (form.username.trim().length < 3) {
    errorMsg.value = "用户名至少 3 位";
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errorMsg.value = "请输入有效的邮箱地址";
    return;
  }
  if (form.password.length < 6) {
    errorMsg.value = "密码至少 6 位";
    return;
  }
  if (form.password !== form.confirm) {
    errorMsg.value = "两次密码不一致";
    return;
  }
  loading.value = true;
  // 注册成功后端直接签发 token，等同于自动登录
  const res = await userStore.register({
    username: form.username.trim(),
    email: form.email.trim(),
    password: form.password,
  });
  loading.value = false;
  if (!res.ok) {
    errorMsg.value = res.msg;
    return;
  }
  router.push("/profile");
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
        <form class="space-y-5" @submit.prevent="submit">
          <div class="flex items-center gap-2">
            <SketchCheckbox :size="18" decorative />
            <DualTextBlock cn="创建账号" en="CREATE ACCOUNT" size="md" weight="normal" />
          </div>

          <!-- 用户名 -->
          <div>
            <DualTextBlock cn="用户名" en="USERNAME" size="sm" weight="normal" />
            <input
              v-model="form.username"
              type="text"
              class="sketch-input mt-2 w-full"
              placeholder="给自己起个名字"
            />
          </div>

          <!-- 邮箱 -->
          <div>
            <DualTextBlock cn="邮箱" en="EMAIL" size="sm" weight="normal" />
            <input
              v-model="form.email"
              type="email"
              class="sketch-input mt-2 w-full"
              placeholder="you@example.com"
            />
          </div>

          <!-- 密码 -->
          <div>
            <DualTextBlock cn="密码" en="PASSWORD" size="sm" weight="normal" />
            <input
              v-model="form.password"
              type="password"
              class="sketch-input mt-2 w-full"
              placeholder="至少 6 位"
            />
          </div>

          <!-- 确认密码 -->
          <div>
            <DualTextBlock cn="确认密码" en="CONFIRM PASSWORD" size="sm" weight="normal" />
            <input
              v-model="form.confirm"
              type="password"
              class="sketch-input mt-2 w-full"
              placeholder="再输入一次"
            />
          </div>

          <!-- 错误提示 -->
          <p v-if="errorMsg" class="text-xs text-sketch-line border border-sketch-line/40 px-3 py-2">
            {{ errorMsg }}
          </p>

          <!-- 操作 -->
          <div class="flex flex-col gap-3 pt-2">
            <LinearButton type="submit" size="lg" block :disabled="loading">
              <span>{{ loading ? "注册中…" : "注 册" }}</span>
            </LinearButton>
            <p class="text-center text-xs text-sketch-lineSub font-light">
              已有账号？
              <RouterLink to="/login" class="underline hover:text-sketch-line">
                去登录
              </RouterLink>
            </p>
          </div>
        </form>
      </SketchBorder>
    </div>
  </PageWrapper>
</template>
