<script setup lang="ts">
// 手绘风「思考中」加载动画：一排不规则波点从小到大、再从大到小依次波动（波浪式）
// 契合整体手绘风格：波点用偏圆的不规则形（非正圆），深棕主色 + 薄荷点缀色
import { computed } from "vue";

interface Props {
  /** 波点数量 */
  count?: number;
  /** 中文文案 */
  label?: string;
  /** 英文小字 */
  subLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  count: 5,
  label: "思考中",
  subLabel: "THINKING",
});

interface DotStyle {
  delay: string;
  accent: boolean;
  /** 每个波点略微不同的不规则圆角，模拟手绘的不完美 */
  radius: string;
}

// 预设几种偏圆点的不规则形状，循环取用，避免整齐划一的机械感
const WOBBLY_RADII = [
  "48% 52% 55% 45% / 52% 46% 54% 48%",
  "55% 45% 47% 53% / 45% 55% 48% 52%",
  "46% 54% 52% 48% / 53% 47% 55% 45%",
  "52% 48% 45% 55% / 47% 53% 46% 54%",
  "50% 50% 54% 46% / 46% 54% 50% 50%",
];

const dots = computed<DotStyle[]>(() =>
  Array.from({ length: props.count }, (_, i) => ({
    // 依次延迟：形成从左到右「小→大→小」的波浪节奏
    delay: `${(i * 0.13).toFixed(2)}s`,
    // 正中间一颗用薄荷点缀色，其余深棕，视觉有锚点
    accent: i === Math.floor(props.count / 2),
    radius: WOBBLY_RADII[i % WOBBLY_RADII.length],
  }))
);
</script>

<template>
  <div class="flex flex-col items-center gap-5" role="status" :aria-label="label">
    <div class="flex items-center gap-4">
      <span
        v-for="(d, i) in dots"
        :key="i"
        class="thinking-dot"
        :class="d.accent ? 'bg-sketch-accent' : 'bg-sketch-line'"
        :style="{ animationDelay: d.delay, borderRadius: d.radius }"
      />
    </div>
    <div v-if="label" class="text-center">
      <p class="text-base font-light text-sketch-line">{{ label }}</p>
      <p v-if="subLabel" class="mt-1 text-[10px] font-en tracking-widest text-sketch-lineSub">
        {{ subLabel }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.thinking-dot {
  width: 18px;
  height: 18px;
  animation: dot-wave 1.3s ease-in-out infinite;
  will-change: transform, opacity;
}

@keyframes dot-wave {
  0%,
  100% {
    transform: scale(0.35);
    opacity: 0.4;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 尊重系统的减少动态偏好：静态展示，不做缩放动画 */
@media (prefers-reduced-motion: reduce) {
  .thinking-dot {
    animation: none;
    opacity: 0.85;
  }
}
</style>
