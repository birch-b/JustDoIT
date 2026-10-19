<script setup lang="ts">
// 手绘风问号提示圈：桌面 hover 悬浮气泡、移开消失；触屏点按切换、点外部关闭
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{
  text: string;
}>();

const show = ref(false);
const rootEl = ref<HTMLElement | null>(null);
// 用 touchstart 标记区分真实触摸和合成鼠标事件
// matchMedia("(hover: none)") 在 DevTools 移动端模拟下不可靠，改用事件驱动
const recentTouch = ref(false);
let touchTimer: number | undefined;

function onEnter() {
  // 触摸后合成的 mouseenter 不响应，避免与 click 切换冲突
  if (recentTouch.value) return;
  show.value = true;
}
function onLeave() {
  if (recentTouch.value) return;
  show.value = false;
}
function onTouchStart() {
  recentTouch.value = true;
  if (touchTimer) window.clearTimeout(touchTimer);
  touchTimer = window.setTimeout(() => {
    recentTouch.value = false;
  }, 800);
}
function onTap() {
  show.value = !show.value;
}
function onDocPointerDown(e: PointerEvent) {
  if (!show.value) return;
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    show.value = false;
  }
}
// 用 pointerdown 而非 mousedown：移动端触摸时 mousedown 是合成事件、可能延迟或不触发，
// pointerdown 同时覆盖鼠标与触摸，且无 300ms 延迟，保证点外部能立即关闭
onMounted(() => document.addEventListener("pointerdown", onDocPointerDown));
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocPointerDown);
  if (touchTimer) window.clearTimeout(touchTimer);
});
</script>

<template>
  <span
    ref="rootEl"
    class="relative inline-flex shrink-0"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @touchstart="onTouchStart"
  >
    <button
      type="button"
      class="flex h-[18px] w-[18px] items-center justify-center cursor-help transition-colors hover:bg-sketch-accent/20"
      :aria-label="props.text"
      @click.stop="onTap"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          d="M9.2 1.7 C13.3 1.5 16.4 4.5 16.3 8.8 C16.2 13 13.1 16.3 8.9 16.2 C4.8 16.1 1.6 13 1.7 8.9 C1.8 4.9 5.1 1.9 9.2 1.7 Z"
          fill="none"
          stroke="#634442"
          stroke-width="1.4"
          stroke-linecap="round"
        />
        <text
          x="9"
          y="12.4"
          text-anchor="middle"
          font-size="10"
          fill="#634442"
        >?</text>
      </svg>
    </button>
    <Transition name="tip">
      <span
        v-if="show"
        role="tooltip"
        class="tip-bubble absolute left-1/2 top-full z-40 mt-3 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 px-4 py-3 text-xs font-light leading-relaxed text-sketch-line"
      >
        <!-- 手绘抖动边框：替代死板矩形，画法与 SketchBorder 一致 -->
        <svg
          class="absolute inset-0 h-full w-full pointer-events-none"
          viewBox="0 0 200 60"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="
              M7,7
              C50,3.5 120,2.5 193,7
              C197,25 197.5,40 193,53
              C120,57.5 50,56.5 7,53
              C3,40 2.5,25 7,7
            "
            fill="#F7F1E5"
            stroke="#634442"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <!-- 手绘小尾巴：指向问号圆圈，盖住交界处的边框线 -->
        <svg
          class="absolute left-1/2 top-0 h-2 w-4 -translate-x-1/2 -translate-y-[7px]"
          viewBox="0 0 16 8"
          aria-hidden="true"
        >
          <path
            d="M2,8 C4,5.5 6,3 8,1 C10,3 12,5.5 14,8"
            fill="#F7F1E5"
            stroke="#634442"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="relative z-10">{{ props.text }}</span>
      </span>
    </Transition>
  </span>
</template>

<style scoped>
/* 气泡底色与边框均由内嵌手绘 SVG 绘制，这里不再画矩形框 */
.tip-enter-active,
.tip-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.tip-enter-from,
.tip-leave-to {
  opacity: 0;
  transform: translate(-50%, -3px);
}
@media (prefers-reduced-motion: reduce) {
  .tip-enter-active,
  .tip-leave-active {
    transition: none;
  }
}
</style>
