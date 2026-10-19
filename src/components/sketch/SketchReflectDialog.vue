<script setup lang="ts">
// 完成打卡弹窗：勾选完成时先收集可选感受，提交后由 Agent 生成回应
import { ref, watch, onBeforeUnmount } from "vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";

interface Props {
  open: boolean;
  taskContent: string;
  loading?: boolean;
  error?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: "",
});

const emit = defineEmits<{
  (e: "submit", comment: string): void;
  (e: "cancel"): void;
}>();

const comment = ref("");

watch(
  () => props.open,
  (v) => {
    if (v) comment.value = "";
  },
);

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

function submit() {
  if (props.loading) return;
  emit("submit", comment.value.trim());
}
</script>

<template>
  <Teleport to="body">
    <Transition name="reflect-dialog">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center px-6"
        role="dialog"
        aria-modal="true"
        aria-label="完成打卡"
      >
        <!-- 遮罩：loading 时不可误关 -->
        <div class="absolute inset-0 bg-sketch-line/35" @click="!loading && emit('cancel')" />
        <div class="reflect-card relative w-full max-w-sm">
          <SketchBorder padding="1.75rem">
            <DualTextBlock cn="完成打卡" en="DONE. NICE." size="sm" weight="normal" />
            <p class="mt-3 text-sm font-light leading-relaxed text-sketch-line">
              「{{ taskContent }}」做完啦。想说点什么吗？比如做得顺不顺、拖了多久、什么感受——
              Agent 会回应你（不写也行）。
            </p>
            <textarea
              v-model="comment"
              class="sketch-input mt-3 w-full resize-none"
              rows="3"
              maxlength="500"
              placeholder="随便写两句…"
            />
            <!-- 错误提示：行内手绘错误条 -->
            <p v-if="error" class="mt-2 text-xs text-sketch-line border border-sketch-line/40 px-3 py-2">
              {{ error }}
            </p>
            <div class="mt-5 flex flex-wrap justify-end gap-3">
              <LinearButton size="sm" :disabled="loading" @click="emit('cancel')">
                先不打卡
              </LinearButton>
              <LinearButton size="sm" :disabled="loading" @click="submit">
                <span>{{ loading ? "Agent 回你中…" : "记下了" }}</span>
              </LinearButton>
            </div>
          </SketchBorder>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.reflect-card {
  background: theme("colors.sketch.bg");
}
.reflect-dialog-enter-active,
.reflect-dialog-leave-active {
  transition: opacity 0.2s ease;
}
.reflect-dialog-enter-active .reflect-card,
.reflect-dialog-leave-active .reflect-card {
  transition:
    transform 0.25s cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 0.2s ease;
}
.reflect-dialog-enter-from,
.reflect-dialog-leave-to {
  opacity: 0;
}
.reflect-dialog-enter-from .reflect-card,
.reflect-dialog-leave-to .reflect-card {
  transform: scale(0.94) translateY(6px);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .reflect-dialog-enter-active,
  .reflect-dialog-leave-active,
  .reflect-dialog-enter-active .reflect-card,
  .reflect-dialog-leave-active .reflect-card {
    transition: none;
  }
}
</style>
