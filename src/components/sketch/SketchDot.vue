<script setup lang="ts">
// 实心/空心波点装饰组件：仅描边或纯填充，用 currentColor 继承父文字色
interface Props {
  /** SVG 画布像素大小 */
  size?: number;
  /** 圆点半径 */
  dotSize?: number;
  /** 空心模式（仅描边无填充） */
  hollow?: boolean;
  /** 额外 class（常用于定位：absolute/left/top 等） */
  className?: string;
}
withDefaults(defineProps<Props>(), {
  size: 30,
  dotSize: 8,
  hollow: false,
  className: "",
});
</script>

<template>
  <svg
    :class="className"
    :width="size"
    :height="size"
    viewBox="0 0 40 40"
    fill="none"
  >
    <!-- 实心波点 -->
    <circle
      v-if="!hollow"
      cx="20"
      cy="20"
      :r="dotSize"
      fill="currentColor"
    />
    <!-- 空心波点（仅描边，与 .sketch-stroke 同粗） -->
    <circle
      v-else
      cx="20"
      cy="20"
      :r="dotSize"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  </svg>
</template>
