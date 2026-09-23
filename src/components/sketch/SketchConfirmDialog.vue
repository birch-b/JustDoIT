<script setup lang="ts">
// 手绘风确认弹窗：替换浏览器原生 window.confirm，与全站手绘风格统一
// 用法：:open 控制显隐，@confirm 执行危险操作，@cancel 关闭；loading 时锁定交互
import { watch, onBeforeUnmount } from "vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";

interface Props {
  open: boolean;
  title: string;
  enTitle?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 确认操作执行中：按钮置灰、遮罩/Esc 不可关闭 */
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  enTitle: "PLEASE CONFIRM",
  confirmText: "确认",
  cancelText: "取消",
  loading: false,
});

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape" && props.open && !props.loading) emit("cancel");
}

watch(
  () => props.open,
  (v) => {
    if (v) window.addEventListener("keydown", onKey);
    else window.removeEventListener("keydown", onKey);
  },
);
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <Teleport to="body">
    <Transition name="sketch-dialog">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center px-6"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <!-- 遮罩：点击等同取消（loading 时禁用，防误关） -->
        <div
          class="absolute inset-0 bg-sketch-line/35"
          @click="!loading && emit('cancel')"
        />
        <!-- 卡片：奶米底 + 手绘边框 -->
        <div class="sketch-dialog-card relative w-full max-w-sm">
          <SketchBorder padding="1.75rem">
            <DualTextBlock :cn="title" :en="enTitle" size="sm" weight="normal" />
            <p class="mt-3 text-sm font-light leading-relaxed text-sketch-line">
              {{ message }}
            </p>
            <div class="mt-6 flex flex-wrap justify-end gap-3">
              <LinearButton size="sm" :disabled="loading" @click="emit('cancel')">
                {{ cancelText }}
              </LinearButton>
              <LinearButton size="sm" :disabled="loading" @click="emit('confirm')">
                {{ loading ? "处理中…" : confirmText }}
              </LinearButton>
            </div>
          </SketchBorder>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sketch-dialog-card {
  background: theme("colors.sketch.bg");
}
.sketch-dialog-enter-active,
.sketch-dialog-leave-active {
  transition: opacity 0.2s ease;
}
.sketch-dialog-enter-active .sketch-dialog-card,
.sketch-dialog-leave-active .sketch-dialog-card {
  transition:
    transform 0.25s cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 0.2s ease;
}
.sketch-dialog-enter-from,
.sketch-dialog-leave-to {
  opacity: 0;
}
.sketch-dialog-enter-from .sketch-dialog-card,
.sketch-dialog-leave-to .sketch-dialog-card {
  transform: scale(0.94) translateY(6px);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .sketch-dialog-enter-active,
  .sketch-dialog-leave-active,
  .sketch-dialog-enter-active .sketch-dialog-card,
  .sketch-dialog-leave-active .sketch-dialog-card {
    transition: none;
  }
}
</style>
