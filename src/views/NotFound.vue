<script setup lang="ts">
// 404 兜底页：未匹配到任何路由时提示并引导回首页
import { useRouter } from "vue-router";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";

const router = useRouter();

function goHome() {
  router.push("/");
}
</script>

<template>
  <PageWrapper full>
    <div class="flex flex-1 items-center justify-center">
      <div class="w-full max-w-lg">
        <SketchBorder padding="2.5rem 2.75rem">
          <div class="flex flex-col items-center text-center">
            <p class="font-en text-5xl font-light tracking-[0.2em] text-sketch-line">404</p>
            <p class="mt-3 text-xs font-light font-en tracking-widest text-sketch-lineSub">
              PAGE NOT FOUND
            </p>
            <p class="mt-5 text-sm font-light leading-relaxed text-sketch-line">
              你要找的页面不存在，可能已经被移走，或者地址写错了。
            </p>
            <LinearButton class="mt-7" size="md" @click="goHome">
              <span>回首页</span>
            </LinearButton>
          </div>
        </SketchBorder>
      </div>
    </div>
  </PageWrapper>
</template>
