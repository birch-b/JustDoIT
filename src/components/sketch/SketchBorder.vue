<script setup lang="ts">
// 手绘不规则缠绕装饰边框 SVG：包裹任意内容
interface Props {
  // 内边距
  padding?: number | string;
  // 是否仅装饰（不占满）
  radius?: number; // 圆角不规则度
}
withDefaults(defineProps<Props>(), {
  padding: "2rem",
  radius: 18,
});
</script>

<template>
  <div class="sketch-border-wrap relative" :style="{ padding: typeof padding === 'number' ? padding + 'px' : padding }">
    <!-- 边框 SVG，绝对定位铺满 -->
    <svg class="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 400 200">
      <!-- 外层手绘缠绕框（向边缘收缩，避免与内容重叠） -->
      <path
        class="sketch-stroke"
        stroke-width="1.8"
        d="M6,6 C80,3 200,2 394,6 C397,80 398,130 394,194 C200,197 80,196 6,194 C3,130 2,80 6,6"
      />
      <!-- 内层偏移装饰框 · accent 点缀 -->
      <path
        fill="none"
        stroke="#A9C8C2"
        stroke-width="1.25"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.7"
        d="M12,12 C80,9 200,8 388,12 C393,80 394,130 388,188 C200,191 80,190 12,188 C7,130 6,80 12,12"
      />
      <!-- 四角小装饰方框（缩小并贴角，避免侵入内容区） -->
      <rect x="3" y="3" width="8" height="8" class="sketch-stroke" stroke-width="1.5" opacity="0.7" />
      <rect x="389" y="3" width="8" height="8" class="sketch-stroke" stroke-width="1.5" opacity="0.7" />
      <rect x="3" y="189" width="8" height="8" class="sketch-stroke" stroke-width="1.5" opacity="0.7" />
      <rect x="389" y="189" width="8" height="8" class="sketch-stroke" stroke-width="1.5" opacity="0.7" />
    </svg>
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
