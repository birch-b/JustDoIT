<script setup lang="ts">
// 中英对照文本块：主中文 + 小号英文说明
interface Props {
  cn: string;
  en?: string;
  // 主文案尺寸
  size?: "sm" | "md" | "lg" | "xl";
  // 主文案字重
  weight?: "light" | "normal" | "medium";
  // 主文案是否为结论样式（强调）
  highlight?: boolean;
}
withDefaults(defineProps<Props>(), {
  size: "md",
  weight: "light",
  highlight: false,
});
</script>

<template>
  <div class="dual-text-block">
    <p
      :class="[
        'text-sketch-line',
        size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : size === 'xl' ? 'text-4xl' : 'text-base',
        weight === 'normal' ? 'font-normal' : weight === 'medium' ? 'font-medium' : 'font-light',
        highlight ? 'leading-tight' : 'leading-relaxed',
      ]"
    >
      {{ cn }}
    </p>
    <p
      v-if="en"
      class="mt-1 text-xs font-light text-sketch-lineSub font-en tracking-wide"
    >
      {{ en }}
    </p>
  </div>
</template>
