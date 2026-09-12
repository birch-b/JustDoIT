<script setup lang="ts">
// 线性边框按钮：SVG 手绘不规则波浪边框
import { computed } from "vue";

interface Props {
  type?: "button" | "submit" | "reset";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  block?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  type: "button",
  size: "md",
  disabled: false,
  block: false,
});

const sizeClass = computed(() => {
  switch (props.size) {
    case "sm":
      return "px-4 py-1.5 text-xs";
    case "lg":
      return "px-8 py-3 text-base";
    default:
      return "px-6 py-2 text-sm";
  }
});
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="[
      'sketch-btn group relative inline-flex items-center justify-center gap-2',
      'bg-transparent text-sketch-line',
      'font-light tracking-wide transition-colors duration-200',
      sizeClass,
      block ? 'w-full' : '',
      disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
    ]"
  >
    <!-- 手绘不规则边框 SVG -->
    <svg
      class="sketch-btn-border absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 400 100"
    >
      <!-- 外框：不规则波浪线 -->
      <path
        class="sketch-stroke"
        stroke-width="1.8"
        d="M12,18 C70,10 180,14 388,12 C394,35 396,65 388,82 C180,88 70,84 12,82 C6,65 4,35 12,18"
      />
      <!-- 内层 accent 细线 -->
      <path
        fill="none"
        stroke="#A9C8C2"
        stroke-width="1"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.6"
        d="M20,24 C75,18 185,22 380,20 C386,40 388,62 380,76 C185,80 75,76 20,74 C14,60 12,40 20,24"
      />
    </svg>
    <!-- 按钮文字内容 -->
    <span class="relative z-10 flex items-center gap-2">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.sketch-btn {
  border-radius: 0;
}
.sketch-btn:hover .sketch-btn-border path:first-child {
  stroke: theme("colors.sketch.accent");
}
.sketch-btn:hover {
  color: theme("colors.sketch.line");
}
</style>
