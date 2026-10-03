<script setup lang="ts">
// 手绘风自绘下拉：方形奶米底 + 缠绕边框 + 薄荷选中，替换原生 select
// 用法：<SketchSelect v-model="province" :options="provinceOptions" placeholder="选省份" @select="..." />
import { computed, ref } from "vue";

interface Option { label: string; value: string }

const props = withDefaults(defineProps<{
  modelValue: string;
  options: Option[];
  placeholder?: string;
  /** 最多显示几项，超出滚动 */
  maxVisible?: number;
  disabled?: boolean;
}>(), {
  placeholder: "请选择",
  maxVisible: 8,
  disabled: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
  (e: "select", v: string): void;
}>();

const open = ref(false);

const currentLabel = computed(() => {
  if (!props.modelValue) return props.placeholder;
  return props.options.find((o) => o.value === props.modelValue)?.label ?? props.modelValue;
});

function pick(v: string) {
  emit("update:modelValue", v);
  emit("select", v);
  open.value = false;
}

/** 失焦收拢（用 mousedown 先触发 pick，blur 在之后） */
function onBlur() {
  open.value = false;
}
</script>

<template>
  <div class="relative select-none" :class="disabled ? 'opacity-50 pointer-events-none' : ''">
    <!-- 触发区：波浪下划线 + 手绘三角箭头 -->
    <button
      type="button"
      class="sketch-input w-full flex items-center justify-between gap-1 text-left"
      :aria-expanded="open"
      @click="open = !open"
      @blur="onBlur"
    >
      <span :class="modelValue ? '' : 'text-sketch-lineSub'">{{ currentLabel }}</span>
      <svg class="w-3 h-3 shrink-0 transition-transform duration-200" :class="open ? 'rotate-180' : ''" viewBox="0 0 12 8" fill="none">
        <path d="M1,1.5 L6,6.5 L11,1.5" stroke="#634442" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- 弹层：方形奶米底 + 手绘边框 -->
    <Transition name="drop">
      <div
        v-if="open"
        class="absolute z-40 left-0 right-0 mt-1"
        style="background: #F7F1E5; border: 1.5px solid #634442; box-shadow: 3px 3px 0 rgba(99,68,66,0.15);"
      >
        <ul class="py-1 overflow-y-auto" :style="{ maxHeight: `${maxVisible * 2.1}rem` }">
          <li
            v-for="o in options"
            :key="o.value"
            class="px-3 py-1 text-sm font-light cursor-pointer transition-colors"
            :style="o.value === modelValue ? 'color:#7FA89F; background:rgba(127,168,159,0.15)' : ''"
            :class="o.value === modelValue ? '' : 'text-sketch-line hover:bg-sketch-line/8'"
            @mousedown.prevent="pick(o.value)"
          >
            {{ o.label }}
          </li>
          <li v-if="options.length === 0" class="px-3 py-1 text-xs text-sketch-lineSub">无选项</li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drop-enter-active, .drop-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
