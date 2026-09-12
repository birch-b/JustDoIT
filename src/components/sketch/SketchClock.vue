<script setup lang="ts">
// 手绘缠绕时钟：指针角度由 score(0-100) 映射 0-360 度
import { computed, onMounted, ref } from "vue";

interface Props {
  score: number; // agentSuggestIndex 0-100
  size?: number; // svg 画布像素大小
  animated?: boolean; // 是否入场动画
}
const props = withDefaults(defineProps<Props>(), {
  size: 360,
  animated: true,
});

const currentScore = ref(0);
onMounted(() => {
  if (!props.animated) {
    currentScore.value = props.score;
    return;
  }
  // 简单的指针入场动画：用 requestAnimationFrame 平滑过渡
  const start = performance.now();
  const duration = 900;
  const from = 0;
  const to = props.score;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    // easeOutCubic
    const eased = 1 - Math.pow(1 - t, 3);
    currentScore.value = from + (to - from) * eased;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const rotateDeg = computed(() => (currentScore.value / 100) * 360);
const scoreLabel = computed(() => Math.round(currentScore.value));
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 400 400"
    class="sketch-clock"
    role="img"
    aria-label="行动指数时钟"
  >
    <!-- 外圈手绘缠绕环线，只描边不填充 -->
    <path
      class="sketch-stroke"
      d="M200,40 C280,60 340,120 360,200 C330,290 260,350 200,360 C110,340 50,270 40,200 C70,110 130,55 200,40"
    />
    <!-- 第二层缠绕外圈 -->
    <path
      class="sketch-stroke"
      d="M200,60 C265,75 320,125 340,200 C315,275 255,330 200,340 C120,325 65,260 60,200 C75,125 135,75 200,60"
      opacity="0.6"
    />
    <!-- 基础刻度圆环 -->
    <circle cx="200" cy="200" r="150" class="sketch-stroke" stroke-width="1.5" />
    <!-- 12 刻度短线 -->
    <g class="sketch-stroke" stroke-width="1.5">
      <line
        v-for="i in 12"
        :key="i"
        x1="200"
        y1="55"
        x2="200"
        y2="65"
        :transform="`rotate(${(i - 1) * 30} 200 200)`"
      />
    </g>
    <!-- 指针：分数映射为 0-360 度旋转 -->
    <line
      x1="200"
      y1="200"
      x2="200"
      y2="70"
      class="sketch-stroke"
      stroke-width="3"
      :transform="`rotate(${rotateDeg} 200 200)`"
    />
    <!-- 中心圆点 -->
    <circle cx="200" cy="200" r="4" fill="#634442" />
    <!-- 分数文本 -->
    <text
      x="200"
      y="245"
      text-anchor="middle"
      fill="#634442"
      font-size="28"
      font-weight="500"
      font-family="Inter, sans-serif"
    >
      {{ scoreLabel }}
    </text>
    <text
      x="200"
      y="268"
      text-anchor="middle"
      fill="rgba(99,68,66,0.65)"
      font-size="11"
      font-family="Inter, sans-serif"
    >
      ACTION INDEX
    </text>
  </svg>
</template>
