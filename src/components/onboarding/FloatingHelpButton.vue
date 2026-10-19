<script setup lang="ts">
// 悬浮帮助按钮：固定在屏幕右侧中间，点击重开新手引导；替代原导航栏「?」入口
// 视觉：柔和描边 + 放射状柔光阴影 + 上下微微浮动
import { openGuide } from "./OnboardingGuide.vue";
</script>

<template>
  <div class="group fixed right-3 top-1/2 z-40 flex -translate-y-1/2 items-center gap-2 md:right-4">
    <!-- 悬停标签：桌面端 hover 时滑出，触屏不显示；手绘抖动边框同 SketchTooltip 画法 -->
    <span
      class="help-label relative px-3 py-1.5 text-xs font-light text-sketch-line opacity-0 transition-all duration-200 group-hover:opacity-100"
      aria-hidden="true"
    >
      <svg
        class="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 80 28"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="
            M7,5.5
            C26,2.5 54,2.5 73,5.5
            C77,10.5 77.5,16.5 73,22.5
            C54,25.5 26,25.5 7,22.5
            C3,16.5 2.5,10.5 7,5.5
          "
          fill="rgba(247, 241, 229, 0.95)"
          stroke="rgba(99, 68, 66, 0.75)"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <span class="relative z-10">使用指南</span>
    </span>
    <!-- 浮动层：承担上下漂浮动画，与按钮自身的 hover 缩放互不干扰 -->
    <span class="help-float block">
      <button
        type="button"
        class="help-btn block cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
        aria-label="使用指南"
        @click="openGuide"
      >
        <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
          <!-- 手绘抖动圆圈：同 SketchTooltip 画法，放大版；描边半透明更柔和 -->
          <path
            d="M19.4 3.6 C28.1 3.2 34.7 9.5 34.5 18.6 C34.3 27.5 27.8 34.3 18.9 34.1 C10.2 33.9 3.4 27.5 3.6 18.8 C3.8 10.3 10.8 4 19.4 3.6 Z"
            fill="rgba(247, 241, 229, 0.92)"
            stroke="rgba(99, 68, 66, 0.75)"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <text
            x="19"
            y="26"
            text-anchor="middle"
            font-size="20"
            fill="rgba(99, 68, 66, 0.85)"
          >?</text>
        </svg>
      </button>
    </span>
  </div>
</template>

<style scoped>
/* 放射状柔光：drop-shadow 沿手绘圆圈轮廓扩散，一暖一青两层，柔和不发闷 */
.help-btn {
  filter: drop-shadow(0 4px 10px rgba(99, 68, 66, 0.18))
    drop-shadow(0 0 14px rgba(127, 168, 159, 0.22));
}
/* 微微浮动：3s 上下往返 5px */
.help-float {
  animation: help-bob 3.2s ease-in-out infinite;
}
@keyframes help-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}
/* 标签底色与边框由内嵌手绘 SVG 绘制，只留一层柔和投影 */
.help-label {
  filter: drop-shadow(0 3px 8px rgba(99, 68, 66, 0.16));
  transform: translateX(4px);
}
.group:hover .help-label {
  transform: translateX(0);
}
/* 非悬停设备（触屏）不显示标签，避免常驻遮挡 */
@media (hover: none) {
  .help-label {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .help-label,
  .help-btn {
    transition: none;
  }
  .help-float {
    animation: none;
  }
}
</style>
