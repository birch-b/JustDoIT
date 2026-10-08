<script setup lang="ts">
// 手绘不规则缠绕装饰边框 SVG：包裹任意内容
interface Props {
  // 内边距
  padding?: number | string;
  // 圆角不规则度
  radius?: number;
}

withDefaults(defineProps<Props>(), {
  padding: undefined,
  radius: 18,
});
</script>

<template>
  <div
    class="sketch-border-wrap relative"
    :style="{
      padding: typeof padding === 'number' ? padding + 'px' : padding,
    }"
  >
    <!--
      手绘 SVG 边框
      vector-effect="non-scaling-stroke"
      保证卡片尺寸变化时，线条粗细保持稳定
    -->
    <svg
      class="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 400 200"
    >
      <!-- 外层手绘主边框 -->
      <path
        class="sketch-stroke"
        vector-effect="non-scaling-stroke"
        stroke-width="8"
        d="
          M6,6
          C80,3 200,2 394,6
          C397,80 398,130 394,194
          C200,197 80,196 6,194
          C3,130 2,80 6,6
        "
      />

      <!-- 内层偏移装饰框 -->
      <path
        fill="none"
        stroke="#A9C8C2"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.7"
        vector-effect="non-scaling-stroke"
        d="
          M12,12
          C80,9 200,8 388,12
          C393,80 394,130 388,188
          C200,191 80,190 12,188
          C7,130 6,80 12,12
        "
      />

      <!-- 左上角 -->
      <rect
        x="3"
        y="3"
        width="8"
        height="8"
        class="sketch-stroke"
        stroke-width="3"
        opacity="0.7"
        vector-effect="non-scaling-stroke"
      />
      
      <!-- 右上角 -->
      <rect
        x="389"
        y="3"
        width="8"
        height="8"
        class="sketch-stroke"
        stroke-width="3"
        opacity="0.7"
        vector-effect="non-scaling-stroke"
      />
      
      <!-- 左下角 -->
      <rect
        x="3"
        y="189"
        width="8"
        height="8"
        class="sketch-stroke"
        stroke-width="3"
        opacity="0.7"
        vector-effect="non-scaling-stroke"
      />
      
      <!-- 右下角 -->
      <rect
        x="389"
        y="189"
        width="8"
        height="8"
        class="sketch-stroke"
        stroke-width="3"
        opacity="0.7"
        vector-effect="non-scaling-stroke"
      />
    </svg>

    <!-- 内容区域 -->
    <div class="relative z-10">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.sketch-border-wrap {
  position: relative;
}
</style>