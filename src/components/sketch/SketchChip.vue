<script setup lang="ts">
// 手绘波浪边框选择块：可选中态用于纠结分类单选；tag 模式渲染为纯展示标签（待办卡片分类等）
interface Props {
  selected?: boolean;
  /** 展示标签模式：span + 淡化波浪边框，无交互 */
  tag?: boolean;
}
withDefaults(defineProps<Props>(), {
  selected: false,
  tag: false,
});
</script>

<template>
  <component
    :is="tag ? 'span' : 'button'"
    :type="tag ? undefined : 'button'"
    class="sketch-chip relative inline-flex items-center justify-center bg-transparent"
    :class="[
      tag
        ? 'sketch-chip--tag px-1.5 py-0.5 text-[10px] text-sketch-lineSub cursor-default'
        : [
            'px-3 py-1.5 text-sm font-light tracking-wide transition-colors duration-200 cursor-pointer',
            selected ? 'bg-sketch-hover text-sketch-line' : 'text-sketch-lineSub hover:text-sketch-line',
          ],
    ]"
  >
    <!-- 手绘不规则边框 SVG（同 LinearButton） -->
    <svg
      class="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 400 100"
    >
      <!-- 外框：不规则波浪线 -->
      <path
        class="sketch-stroke"
        stroke-width="1.8"
        :opacity="selected && !tag ? 1 : 0.55"
        d="M12,18 C70,10 180,14 388,12 C394,35 396,65 388,82 C180,88 70,84 12,82 C6,65 4,35 12,18"
      />
      <!-- 内层 accent 细线：仅选中时显示 -->
      <path
        fill="none"
        stroke="#A9C8C2"
        stroke-width="1"
        stroke-linecap="round"
        stroke-linejoin="round"
        :opacity="selected && !tag ? 0.6 : 0"
        d="M20,24 C75,18 185,22 380,20 C386,40 388,62 380,76 C185,80 75,76 20,74 C14,60 12,40 20,24"
      />
    </svg>
    <span class="relative z-10"><slot /></span>
  </component>
</template>

<style scoped>
.sketch-chip {
  border-radius: 0;
}
.sketch-chip:not(.sketch-chip--tag):hover svg path:first-child {
  opacity: 0.9;
}
</style>
