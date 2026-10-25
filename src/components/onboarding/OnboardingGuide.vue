<script lang="ts">
// 首页新手引导：手绘卡片 5 步讲清怎么用。
// 仅在注册成功那一刻自动弹（Register.vue 调 openGuide），平时靠 NavBar「?」随时重开
import { ref } from "vue";

/** 引导弹层开关（模块级共享：NavBar 与注册流程都能控制） */
export const guideOpen = ref(false);
export function openGuide() {
  guideOpen.value = true;
}
function closeGuide() {
  guideOpen.value = false;
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";

interface Step {
  title: string;
  en: string;
  text: string;
}
const STEPS: Step[] = [
  {
    title: "这是什么",
    en: "WHAT IS THIS",
    text: "拍板大王帮你把纠结变成行动：写下你在纠结的事，它会结合意愿、精力等因素，给你一个可以拍板的答案。",
  },
  {
    title: "创建一次纠结",
    en: "CREATE",
    text: "点「新的纠结」填一张小卡片：纠结内容、分类、意愿与精力。拿不准 A 还是 B 时勾上「这是二选一」，它会自动把两个选项切出来，结论直接告诉你选哪个。",
  },
  {
    title: "看建议、进计划表",
    en: "ADVICE & PLAN",
    text: "结果页会给出行动指数与建议；点「加入计划表」，这条待办就会出现在首页的计划表里，随时勾选完成。",
  },
  {
    title: "完成后的评价",
    en: "REVIEW AFTER DONE",
    text: "待办做完，在首页勾选完成时会先弹出「完成打卡」：写下做得顺不顺、拖了多久、什么感受，它会再回应你。不想写也可以点「先不打卡」，直接标记完成。",
  },
  {
    title: "打卡与回顾",
    en: "CHECK-IN & STATS",
    text: "到点它会先来问你「做了吗」，还没做可以顺延；每一次评价和它的回应都会留在会话详情里，随时回看。",
  },
  {
    title: "自我探索",
    en: "KEYWORDS & REVIEW",
    text: "「自我探索」页里，「关键词」是它在一次次纠结里记住的你的样子；滑到「探索手册」，它会把你的习惯讲成几个你认得出来的场景。",
  },
];

const index = ref(0);
const step = computed(() => STEPS[index.value]);
const isFirst = computed(() => index.value === 0);
const isLast = computed(() => index.value === STEPS.length - 1);

function next() {
  if (isLast.value) {
    closeGuide();
    return;
  }
  index.value++;
}
function prev() {
  if (!isFirst.value) index.value--;
}
function skip() {
  closeGuide();
}
function onKey(e: KeyboardEvent) {
  if (!guideOpen.value) return;
  if (e.key === "Escape") skip();
}
watch(guideOpen, (v) => {
  if (v) {
    index.value = 0;
    window.addEventListener("keydown", onKey);
  } else {
    window.removeEventListener("keydown", onKey);
  }
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <Teleport to="body">
    <Transition name="guide">
      <div
        v-if="guideOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center px-6"
        role="dialog"
        aria-modal="true"
      >
        <!-- 遮罩：点击等同跳过 -->
        <div class="absolute inset-0 bg-sketch-line/35" @click="skip" />
        <div class="guide-card relative w-full max-w-md">
          <SketchBorder padding="2rem 2.5rem">
            <div class="flex items-start justify-between gap-3">
              <DualTextBlock :cn="step.title" :en="step.en" size="md" weight="normal" />
              <span class="shrink-0 pt-1 text-xs text-sketch-lineSub font-en tracking-widest">
                {{ index + 1 }} / {{ STEPS.length }}
              </span>
            </div>
            <p class="mt-4 min-h-[4.5rem] text-sm font-light leading-relaxed text-sketch-line">
              {{ step.text }}
            </p>
            <!-- 分页圆点 -->
            <div class="mt-4 flex items-center gap-2">
              <span
                v-for="(s, i) in STEPS"
                :key="s.en"
                class="h-2 w-2 rounded-full transition-colors"
                :style="{ background: i === index ? '#7FA89F' : 'rgba(99,68,66,0.25)' }"
              />
            </div>
            <div class="mt-6 flex items-center justify-between">
              <button
                class="text-xs text-sketch-lineSub hover:text-sketch-line transition-colors"
                @click="skip"
              >
                跳过
              </button>
              <div class="flex gap-3">
                <LinearButton v-if="!isFirst" size="sm" @click="prev">
                  <span>上一步</span>
                </LinearButton>
                <LinearButton size="sm" @click="next">
                  <span>{{ isLast ? "开始使用" : "下一步" }}</span>
                </LinearButton>
              </div>
            </div>
          </SketchBorder>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.guide-card {
  background: theme("colors.sketch.bg");
}
.guide-enter-active,
.guide-leave-active {
  transition: opacity 0.2s ease;
}
.guide-enter-active .guide-card,
.guide-leave-active .guide-card {
  transition:
    transform 0.25s cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 0.2s ease;
}
.guide-enter-from,
.guide-leave-to {
  opacity: 0;
}
.guide-enter-from .guide-card,
.guide-leave-to .guide-card {
  transform: scale(0.94) translateY(6px);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .guide-enter-active,
  .guide-leave-active,
  .guide-enter-active .guide-card,
  .guide-leave-active .guide-card {
    transition: none;
  }
}
</style>
