<script setup lang="ts">
// 手绘不规则缠绕装饰边框 SVG：包裹任意内容
// viewBox 动态同步容器实际尺寸，保证 1 单位 = 1px，边框线位置不随卡片高度拉伸偏移
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

interface Props {
  padding?: number | string;
  radius?: number;
}

withDefaults(defineProps<Props>(), {
  padding: undefined,
  radius: 18,
});

const wrapEl = ref<HTMLElement | null>(null);
const vbW = ref(400);
const vbH = ref(200);

let ro: ResizeObserver | null = null;

function syncSize() {
  if (!wrapEl.value) return;
  const r = wrapEl.value.getBoundingClientRect();
  vbW.value = Math.max(1, Math.round(r.width));
  vbH.value = Math.max(1, Math.round(r.height));
}

onMounted(() => {
  syncSize();
  ro = new ResizeObserver(syncSize);
  if (wrapEl.value) ro.observe(wrapEl.value);
});

onBeforeUnmount(() => {
  ro?.disconnect();
});

const viewBox = computed(() => `0 0 ${vbW.value} ${vbH.value}`);

const borderPath = computed(() => {
  const w = vbW.value;
  const h = vbH.value;
  return `
    M6,6
    C${(w * 0.2).toFixed(1)},3 ${(w * 0.5).toFixed(1)},2 ${w - 6},6
    C${w - 3},${(h * 0.4).toFixed(1)} ${w - 2},${(h * 0.65).toFixed(1)} ${w - 6},${h - 6}
    C${(w * 0.5).toFixed(1)},${h - 3} ${(w * 0.2).toFixed(1)},${h - 4} 6,${h - 6}
    C3,${(h * 0.65).toFixed(1)} 2,${(h * 0.4).toFixed(1)} 6,6
  `;
});

const innerPath = computed(() => {
  const w = vbW.value;
  const h = vbH.value;
  return `
    M12,12
    C${(w * 0.2).toFixed(1)},9 ${(w * 0.5).toFixed(1)},8 ${w - 12},12
    C${w - 7},${(h * 0.4).toFixed(1)} ${w - 6},${(h * 0.65).toFixed(1)} ${w - 12},${h - 12}
    C${(w * 0.5).toFixed(1)},${h - 9} ${(w * 0.2).toFixed(1)},${h - 10} 12,${h - 12}
    C7,${(h * 0.65).toFixed(1)} 6,${(h * 0.4).toFixed(1)} 12,12
  `;
});
</script>

<template>
  <div
    ref="wrapEl"
    class="sketch-border-wrap relative"
    :style="{
      padding: typeof padding === 'number' ? padding + 'px' : padding,
    }"
  >
    <svg
      class="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      :viewBox="viewBox"
    >
      <path
        class="sketch-stroke"
        vector-effect="non-scaling-stroke"
        stroke-width="8"
        :d="borderPath"
      />

      <path
        fill="none"
        stroke="#A9C8C2"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.7"
        vector-effect="non-scaling-stroke"
        :d="innerPath"
      />

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

      <rect
        :x="vbW - 11"
        y="3"
        width="8"
        height="8"
        class="sketch-stroke"
        stroke-width="3"
        opacity="0.7"
        vector-effect="non-scaling-stroke"
      />

      <rect
        x="3"
        :y="vbH - 11"
        width="8"
        height="8"
        class="sketch-stroke"
        stroke-width="3"
        opacity="0.7"
        vector-effect="non-scaling-stroke"
      />

      <rect
        :x="vbW - 11"
        :y="vbH - 11"
        width="8"
        height="8"
        class="sketch-stroke"
        stroke-width="3"
        opacity="0.7"
        vector-effect="non-scaling-stroke"
      />
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
