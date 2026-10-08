<script setup lang="ts">
// 手绘线条三角形：折叠抽屉的展开指示，默认指向右侧，由父级容器旋转控制开合
interface Props {
  // 图形尺寸（px），描边粗细随尺寸缩放
  size?: number;
}

withDefaults(defineProps<Props>(), {
  size: 12,
});
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- 略带抖动的手绘描边三角：线条跟随文字颜色（currentColor） -->
    <path
      d="M2.5 2.2 C5.5 1.6 8.8 4.6 10.9 6.5 Q11.5 7 10.9 7.6 C8.7 9.8 5.4 12.5 2.6 11.8 Q1.9 11.6 2 10.7 L2.1 3.2 Q2.2 2.4 2.5 2.2 Z"
      stroke="currentColor"
      :stroke-width="size >= 12 ? 1.5 : 1.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
