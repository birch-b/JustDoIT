<script setup lang="ts">
// 个人中心页 /profile：展示并编辑用户资料
import { reactive, ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/store/userStore";
import { useAgentStore } from "@/store/agentStore";
import { userApi } from "@/api/userApi";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import SketchCheckbox from "@/components/sketch/SketchCheckbox.vue";
import DecorDotCluster from "@/components/sketch/DecorDotCluster.vue";
import EmailCodeInput from "@/components/sketch/EmailCodeInput.vue";

const router = useRouter();
const userStore = useUserStore();
const agentStore = useAgentStore();

const editing = ref(false);
const msg = ref("");
const saving = ref(false);
const form = reactive({
  username: "",
  email: "",
  bio: "",
});

const stats = computed(() => agentStore.stats);

onMounted(() => {
  if (!userStore.isLoggedIn) {
    router.push("/login");
    return;
  }
  // 拉取后端聚合的统计数据（个人中心概览用）
  agentStore.loadStats();
  syncForm();
});

function syncForm() {
  if (!userStore.currentUser) return;
  form.username = userStore.currentUser.username;
  form.email = userStore.currentUser.email;
  form.bio = userStore.currentUser.bio ?? "";
}

function startEdit() {
  syncForm();
  editing.value = true;
  msg.value = "";
}

function cancelEdit() {
  editing.value = false;
  msg.value = "";
}

async function save() {
  msg.value = "";
  if (!form.username.trim()) {
    msg.value = "用户名不能为空";
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    msg.value = "邮箱格式不正确";
    return;
  }
  saving.value = true;
  const res = await userStore.updateProfile({
    username: form.username.trim(),
    email: form.email.trim(),
    bio: form.bio.trim(),
  });
  saving.value = false;
  if (!res.ok) {
    msg.value = res.msg;
    return;
  }
  msg.value = res.msg;
  editing.value = false;
}

function logout() {
  userStore.logout();
  agentStore.resetSessions();
  router.push("/login");
}

// —— 注销账户：绑定邮箱验证码确认 ——
const deleteForm = reactive({ code: "", agreed: false });
const deleteMsg = ref("");
const deleting = ref(false);

// 发送注销验证码：后端从登录态取用户，发往绑定邮箱（type=delete）；失败抛错
async function sendDeleteCode() {
  deleteMsg.value = "";
  try {
    await userApi.sendDeleteCode();
  } catch (e) {
    deleteMsg.value = (e as Error).message;
    throw e;
  }
}

// 执行注销：校验通过后清登录态并跳登录页
async function doDelete() {
  deleteMsg.value = "";
  if (!/^\d{6}$/.test(deleteForm.code)) {
    deleteMsg.value = "请输入 6 位邮箱验证码";
    return;
  }
  if (!deleteForm.agreed) {
    deleteMsg.value = "请先勾选确认已知晓注销后果";
    return;
  }
  deleting.value = true;
  try {
    await userApi.deleteAccount(deleteForm.code);
    userStore.logout();
    agentStore.resetSessions();
    router.push({ name: "login", query: { accountDeleted: "1" } });
  } catch (e) {
    deleteMsg.value = (e as Error).message;
  } finally {
    deleting.value = false;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
</script>

<template>
  <PageWrapper full title="个人中心" subtitle="PROFILE">
    <DecorDotCluster
      :count="26"
      :spread="110"
      :safe-inset="50"
      :hollow-ratio="0.3"
    />

    <div v-if="userStore.currentUser" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 左：用户信息卡 -->
      <div class="space-y-6">
        <SketchBorder padding="2rem">
          <div class="flex flex-col items-center text-center">
            <!-- 头像占位：手绘方框 + 用户名首字 -->
            <div class="relative">
              <SketchCheckbox :size="80" :rotate="-4" decorative />
              <span class="absolute inset-0 flex items-center justify-center text-3xl font-light font-en">
                {{ userStore.currentUser.username.charAt(0).toUpperCase() }}
              </span>
            </div>
            <p class="mt-4 text-xl font-light">{{ userStore.currentUser.username }}</p>
            <p class="mt-1 text-xs text-sketch-lineSub font-en tracking-wide">
              {{ userStore.currentUser.email }}
            </p>
            <p v-if="userStore.currentUser.createdAt" class="mt-3 text-xs text-sketch-lineSub">
              注册于 {{ formatDate(userStore.currentUser.createdAt) }}
            </p>
          </div>
        </SketchBorder>

        <!-- 快捷操作 -->
        <SketchBorder padding="2rem">
          <DualTextBlock cn="快捷操作" en="QUICK ACTIONS" size="sm" weight="normal" />
          <div class="mt-4 flex flex-col gap-3">
            <LinearButton size="md" @click="router.push('/stats')">
              <span>查看统计</span>
            </LinearButton>
            <LinearButton size="md" @click="router.push('/task-create')">
              <span>新的纠结</span>
            </LinearButton>
            <LinearButton size="md" @click="logout">
              <span>退出登录</span>
            </LinearButton>
          </div>
        </SketchBorder>
      </div>

      <!-- 右：资料编辑 + 数据概览 -->
      <div class="lg:col-span-2 space-y-6">
        <!-- 资料编辑 -->
        <SketchBorder padding="2rem">
          <div class="flex items-center justify-between">
            <DualTextBlock cn="个人资料" en="PROFILE INFO" size="md" weight="normal" />
            <LinearButton v-if="!editing" size="sm" @click="startEdit">
              <span>编辑</span>
            </LinearButton>
          </div>

          <div v-if="!editing" class="mt-6 space-y-4 text-sm font-light">
            <div class="flex items-baseline gap-3">
              <SketchCheckbox :size="14" decorative />
              <span class="text-sketch-lineSub w-20 shrink-0">用户名</span>
              <span>{{ userStore.currentUser.username }}</span>
            </div>
            <div class="flex items-baseline gap-3">
              <SketchCheckbox :size="14" decorative />
              <span class="text-sketch-lineSub w-20 shrink-0">邮箱</span>
              <span>{{ userStore.currentUser.email }}</span>
            </div>
            <div class="flex items-start gap-3">
              <SketchCheckbox :size="14" decorative />
              <span class="text-sketch-lineSub w-20 shrink-0 pt-0.5">简介</span>
              <span class="flex-1">{{ userStore.currentUser.bio || "这个人很懒，什么都没留下。" }}</span>
            </div>
          </div>

          <div v-else class="mt-6 space-y-4">
            <div>
              <DualTextBlock cn="用户名" en="USERNAME" size="sm" weight="normal" />
              <input v-model="form.username" type="text" class="sketch-input mt-2 w-full" />
            </div>
            <div>
              <DualTextBlock cn="邮箱" en="EMAIL" size="sm" weight="normal" />
              <input v-model="form.email" type="email" class="sketch-input mt-2 w-full" />
            </div>
            <div>
              <DualTextBlock cn="简介" en="BIO" size="sm" weight="normal" />
              <textarea
                v-model="form.bio"
                rows="3"
                class="sketch-input mt-2 w-full resize-none"
                placeholder="一句话介绍自己"
              />
            </div>

            <p v-if="msg" class="text-xs text-sketch-line border border-sketch-line/40 px-3 py-2">
              {{ msg }}
            </p>

            <div class="flex gap-3 pt-2">
              <LinearButton size="md" :disabled="saving" @click="save">
                <span>{{ saving ? "保存中…" : "保存" }}</span>
              </LinearButton>
              <LinearButton size="md" :disabled="saving" @click="cancelEdit">
                <span>取消</span>
              </LinearButton>
            </div>
          </div>
        </SketchBorder>

        <!-- 数据概览 -->
        <SketchBorder padding="2rem">
          <DualTextBlock cn="我的数据" en="MY DATA" size="md" weight="normal" />
          <div class="mt-6 grid grid-cols-3 gap-4">
            <div class="text-center">
              <p class="text-3xl font-light font-en">{{ stats.totalSessions }}</p>
              <p class="mt-1 text-[10px] text-sketch-lineSub font-en tracking-widest">SESSIONS</p>
            </div>
            <div class="text-center">
              <p class="text-3xl font-light font-en">{{ stats.executedCount }}</p>
              <p class="mt-1 text-[10px] text-sketch-lineSub font-en tracking-widest">EXECUTED</p>
            </div>
            <div class="text-center">
              <p class="text-3xl font-light font-en">{{ stats.acceptRate }}<span class="text-lg">%</span></p>
              <p class="mt-1 text-[10px] text-sketch-lineSub font-en tracking-widest">ACCEPT</p>
            </div>
          </div>
        </SketchBorder>

        <!-- 注销账户（危险操作，需绑定邮箱验证码） -->
        <SketchBorder padding="2rem">
          <DualTextBlock cn="注销账户" en="DELETE ACCOUNT" size="md" weight="normal" />
          <p class="mt-4 text-sm font-light leading-relaxed text-sketch-lineSub">
            注销后，你的账号以及全部纠结任务、Agent 会话、行为反馈与统计数据将被
            <span class="text-sketch-line">永久删除且无法恢复</span>。请谨慎操作。
          </p>

          <EmailCodeInput
            v-model="deleteForm.code"
            class="mt-5"
            :on-send="sendDeleteCode"
          />

          <label class="mt-4 flex items-center gap-3 cursor-pointer select-none">
            <SketchCheckbox v-model="deleteForm.agreed" :size="20" />
            <span class="text-sm font-light text-sketch-lineSub">
              我已知晓注销后果，确认永久删除账户
            </span>
          </label>

          <p v-if="deleteMsg" class="mt-4 text-xs text-sketch-line border border-sketch-line/40 px-3 py-2">
            {{ deleteMsg }}
          </p>

          <div class="mt-5">
            <LinearButton
              size="md"
              :disabled="deleting || !deleteForm.agreed || deleteForm.code.length !== 6"
              @click="doDelete"
            >
              <span>{{ deleting ? "注销中…" : "确认注销账户" }}</span>
            </LinearButton>
          </div>
        </SketchBorder>
      </div>
    </div>
  </PageWrapper>
</template>
