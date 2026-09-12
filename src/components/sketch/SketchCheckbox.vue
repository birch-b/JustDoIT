<script setup lang="ts">
// 空心方框装饰组件：仅描边；可做纯装饰，也可绑定 v-model
import { computed } from "vue";

interface Props {
  size?: number; // 方框边长
  // 是否作为可勾选项
  modelValue?: boolean;
  // 装饰模式下随机旋转角度，避免呆板
  rotate?: number;
  // 装饰模式下是否仅展示（不响应点击）
  decorative?: boolean;
  // 勾选后是否显示对勾（非装饰模式）
  showCheck?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  size: 28,
  modelValue: false,
  rotate: 0,
  decorative: false,
  showCheck: true,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const checked = computed(() => props.modelValue);

function toggle() {
  if (props.decorative) return;
  emit("update:modelValue", !props.modelValue);
}
</script>

<template>
  <button
    type="button"
    class="sketch-checkbox inline-flex items-center justify-center disabled:cursor-default"
    :style="{ transform: `rotate(${rotate}deg)` }"
    :disabled="decorative"
    :aria-pressed="checked"
    @click="toggle"
  >
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 40 40"
      :class="['transition-transform duration-300', decorative ? '' : 'hover:scale-105']"
    >
      <!-- 主方框，只描边不填充 -->
      <rect
        x="3"
        y="3"
        width="34"
        height="34"
        class="sketch-stroke"
        stroke-width="2.1"
      />
      <!-- 内部第二个偏移方框，增加手绘不规则感 -->
      <rect
        x="6"
        y="6"
        width="28"
        height="28"
        class="sketch-stroke"
        stroke-width="1.25"
        opacity="0.6"
      />
      <!-- 勾选对勾 -->
      <path
        v-if="showCheck && checked && !decorative"
        class="sketch-stroke"
        stroke-width="2.4"
        d="M11,21 L18,28 L30,14"
      />
    </svg>
  </button>
</template>

<style scoped>
.sketch-checkbox {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}
.sketch-checkbox:disabled {
  cursor: default;
}
</style>
