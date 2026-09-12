<script setup lang="ts">
// 全局页面外壳：统一背景色、内边距，并提供标题/副标题插槽
// 波点装饰由各页面通过 DecorDotCluster 自行引入（父容器已带 relative）
interface Props {
  // 是否铺满高度（用于结果页等需要垂直居中场景）
  full?: boolean;
  // 顶部标题（中文）
  title?: string;
  // 顶部副标题（英文）
  subtitle?: string;
}
withDefaults(defineProps<Props>(), {
  full: false,
  title: "",
  subtitle: "",
});
</script>

<template>
  <div
    :class="[
      'page-wrapper relative mx-auto w-full max-w-7xl px-4 py-10 md:px-6 md:py-14',
      full ? 'min-h-[calc(100vh-64px)] flex flex-col' : '',
    ]"
  >
    <header v-if="title || $slots.header" class="mb-8 md:mb-12">
      <slot name="header">
        <div>
          <h1 v-if="title" class="text-3xl md:text-4xl font-light tracking-wide">
            {{ title }}
          </h1>
          <p v-if="subtitle" class="mt-1 text-sm md:text-base font-light text-sketch-lineSub font-en tracking-widest">
            {{ subtitle }}
          </p>
        </div>
      </slot>
    </header>
    <div :class="full ? 'flex-1 flex flex-col' : ''">
      <slot />
    </div>
  </div>
</template>
