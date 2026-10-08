<script setup lang="ts">
// 忘记密码页 /forgot-password：邮箱验证码重置密码
import { reactive, ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { userApi } from "@/api/userApi";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import SketchCheckbox from "@/components/sketch/SketchCheckbox.vue";
import DecorDotCluster from "@/components/sketch/DecorDotCluster.vue";
import EmailCodeInput from "@/components/sketch/EmailCodeInput.vue";

const router = useRouter();

const form = reactive({
  email: "",
  code: "",
  newPassword: "",
  confirm: "",
});
const errorMsg = ref("");
const successMsg = ref("");
const loading = ref(false);

// 发送找回密码验证码（type=reset，后端据此区分注册/改密场景）：失败抛错，不启动倒计时
async function sendCode() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errorMsg.value = "请先输入有效的邮箱地址";
    throw new Error(errorMsg.value);
  }
  errorMsg.value = "";
  try {
    await userApi.sendCode({ email: form.email.trim(), type: "reset" });
  } catch (e) {
    errorMsg.value = (e as Error).message;
    throw e;
  }
}

async function submit() {
  errorMsg.value = "";
  successMsg.value = "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errorMsg.value = "请输入有效的邮箱地址";
    return;
  }
  if (!/^\d{6}$/.test(form.code)) {
    errorMsg.value = "请输入 6 位邮箱验证码";
    return;
  }
  if (form.newPassword.length < 6) {
    errorMsg.value = "新密码至少 6 位";
    return;
  }
  if (form.newPassword !== form.confirm) {
    errorMsg.value = "两次密码不一致";
    return;
  }
  loading.value = true;
  try {
    await userApi.resetPassword({
      email: form.email.trim(),
      code: form.code,
      newPassword: form.newPassword,
    });
    successMsg.value = "密码重置成功，即将跳转登录页…";
    setTimeout(() => router.push("/login"), 1500);
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <PageWrapper full>
    <DecorDotCluster
      :count="40"
      :spread="100"
      :safe-inset="60"
      :hollow-ratio="0.35"
    />

    <div class="flex flex-1 items-center justify-center">
      <SketchBorder padding="2.5rem" class="w-full max-w-md">
        <form class="space-y-5" @submit.prevent="submit">
          <div class="flex items-center gap-2">
            <SketchCheckbox :size="18" decorative />
            <DualTextBlock cn="找回密码" en="RESET PASSWORD" size="md" weight="normal" />
          </div>

          <!-- 邮箱 -->
          <div>
            <DualTextBlock cn="注册邮箱" en="EMAIL" size="sm" weight="normal" />
            <input
              v-model="form.email"
              type="email"
              class="sketch-input mt-2 w-full"
              placeholder="you@example.com"
            />
          </div>

          <!-- 邮箱验证码 -->
          <EmailCodeInput
            v-model="form.code"
            :on-send="sendCode"
            placeholder="6 位数字"
          />

          <!-- 新密码 -->
          <div>
            <DualTextBlock cn="新密码" en="NEW PASSWORD" size="sm" weight="normal" />
            <input
              v-model="form.newPassword"
              type="password"
              class="sketch-input mt-2 w-full"
              placeholder="至少 6 位"
            />
          </div>

          <!-- 确认新密码 -->
          <div>
            <DualTextBlock cn="确认新密码" en="CONFIRM PASSWORD" size="sm" weight="normal" />
            <input
              v-model="form.confirm"
              type="password"
              class="sketch-input mt-2 w-full"
              placeholder="再输入一次"
            />
          </div>

          <!-- 提示信息 -->
          <p v-if="errorMsg" class="text-xs text-sketch-line border border-sketch-line/40 px-3 py-2">
            {{ errorMsg }}
          </p>
          <p v-if="successMsg" class="text-xs text-sketch-accent border border-sketch-accent/40 px-3 py-2">
            {{ successMsg }}
          </p>

          <!-- 操作 -->
          <div class="flex flex-col gap-3 pt-2">
            <LinearButton type="submit" size="lg" block :disabled="loading">
              <span>{{ loading ? "重置中…" : "重置密码" }}</span>
            </LinearButton>
            <p class="text-center text-xs text-sketch-lineSub font-light">
              想起密码了？
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
