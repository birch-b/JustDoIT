<script setup lang="ts">
// 登录/注册后检测到本地仍有游客数据时弹出：是否并入当前账号由用户决定
// 自动迁移会把游客数据强行算到登录的账号上，尤其登录已有账号时会污染该账号
import { computed, ref } from "vue";
import { useUserStore } from "@/store/userStore";
import SketchConfirmDialog from "@/components/sketch/SketchConfirmDialog.vue";

const userStore = useUserStore();
const syncing = ref(false);

const message = computed(() => {
  const p = userStore.guestPending;
  if (!p) return "";
  const parts: string[] = [];
  if (p.sessions) parts.push(`${p.sessions} 条纠结会话`);
  if (p.todos) parts.push(`${p.todos} 条待办`);
  return `检测到本浏览器有 ${parts.join("、")}。要把它们同步到当前账号「${
    userStore.currentUser?.username ?? ""
  }」吗？选择不同步，数据会继续留在本机，退出登录后仍可查看。`;
});

async function onConfirm() {
  if (syncing.value) return;
  syncing.value = true;
  try {
    await userStore.applyGuestSync();
  } finally {
    syncing.value = false;
  }
}
</script>

<template>
  <SketchConfirmDialog
    :open="!!userStore.guestPending"
    title="同步游客数据"
    en-title="SYNC GUEST DATA"
    :message="message"
    confirm-text="同步到账号"
    cancel-text="不同步"
    :loading="syncing"
    @confirm="onConfirm"
    @cancel="userStore.dismissGuestSync()"
  />
</template>
