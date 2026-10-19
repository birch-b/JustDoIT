<script setup lang="ts">
// 折叠容器：grid-rows 0fr→1fr 高度过渡，任意内容高度都能平滑展开/收起（替代 v-show 的瞬间切换）
// 展开无延迟跟手；收起带 0.12s 宽限延迟，鼠标扫过标题时内容不会瞬间闪没
defineProps<{ open: boolean }>();
</script>

<template>
  <div class="drawer-collapse" :class="{ open }">
    <div class="drawer-collapse-inner">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.drawer-collapse {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 0.32s cubic-bezier(0.25, 0.8, 0.35, 1) 0.12s,
    opacity 0.28s ease 0.12s;
}
.drawer-collapse.open {
  grid-template-rows: 1fr;
  opacity: 1;
  transition:
    grid-template-rows 0.9s cubic-bezier(0.25, 0.8, 0.35, 1),
    opacity 0.55s ease;
}
.drawer-collapse-inner {
  min-height: 0;
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .drawer-collapse {
    transition: none;
  }
}
</style>
