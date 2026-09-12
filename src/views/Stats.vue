<script setup lang="ts">
// 个人统计页 /stats：全部使用原生 SVG 手绘线条图表
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAgentStore } from "@/store/agentStore";
import type { PersuadeMode } from "@/types";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import SketchCheckbox from "@/components/sketch/SketchCheckbox.vue";
import DecorDotCluster from "@/components/sketch/DecorDotCluster.vue";

const router = useRouter();
const store = useAgentStore();

onMounted(() => {
  store.seedDemoData();
});

const stats = computed(() => store.stats);

// 劝说模式列表（用于柱状图）
const modeList = computed(() => {
  const dist = stats.value.modeDistribution;
  const max = Math.max(1, ...Object.values(dist));
  return (Object.keys(dist) as PersuadeMode[]).map((m) => ({
    mode: m,
    count: dist[m],
    pct: Math.round((dist[m] / max) * 100),
  }));
});

// 意愿分数 - 完成率分布：x=意愿1-10，y=完成率
const willScatter = computed(() => {
  const buckets: Record<number, { total: number; done: number }> = {};
  for (let i = 1; i <= 10; i++) buckets[i] = { total: 0, done: 0 };
  stats.value.willVsComplete.forEach((p) => {
    buckets[p.willScore].total += 1;
    if (p.completed) buckets[p.willScore].done += 1;
  });
  return Object.entries(buckets).map(([w, v]) => ({
    will: Number(w),
    total: v.total,
    done: v.done,
    rate: v.total ? Math.round((v.done / v.total) * 100) : 0,
  }));
});

// 散落装饰：手绘方框（波点由 DecorDotCluster 统一渲染）
interface BoxDeco {
  top: string;
  left?: string;
  right?: string;
  rotate?: number;
  size: number;
}
const decos: BoxDeco[] = [
  { top: "12%", left: "3%", rotate: -10, size: 28 },
];

// 折线图坐标计算
const scatterPoints = computed(() => {
  const W = 320;
  const H = 140;
  const pad = 24;
  return willScatter.value.map((p) => {
    const x = pad + ((p.will - 1) / 9) * (W - pad * 2);
    const y = H - pad - (p.rate / 100) * (H - pad * 2);
    return { x, y, ...p };
  });
});
</script>

<template>
  <PageWrapper full title="个人统计" subtitle="PERSONAL STATS">
    <!-- 散落装饰：波点簇 + 手绘方框 -->
    <DecorDotCluster
      :count="26"
      :spread="110"
      :safe-inset="50"
      :hollow-ratio="0.3"
    />
    <div
      v-for="(b, i) in decos"
      :key="i"
      class="pointer-events-none absolute"
      :style="{ top: b.top, left: b.left, right: b.right }"
    >
      <SketchCheckbox :size="b.size" :rotate="b.rotate" decorative />
    </div>

    <!-- 顶部数据卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
      <SketchBorder padding="2rem">
        <DualTextBlock cn="总会话数" en="TOTAL SESSIONS" size="sm" weight="normal" />
        <p class="mt-3 text-4xl font-light font-en">{{ stats.totalSessions }}</p>
      </SketchBorder>
      <SketchBorder padding="2rem">
        <DualTextBlock cn="已执行" en="EXECUTED" size="sm" weight="normal" />
        <p class="mt-3 text-4xl font-light font-en">{{ stats.executedCount }}</p>
      </SketchBorder>
      <SketchBorder padding="2rem">
        <DualTextBlock cn="接受率" en="ACCEPT RATE" size="sm" weight="normal" />
        <p class="mt-3 text-4xl font-light font-en">{{ stats.acceptRate }}<span class="text-lg">%</span></p>
      </SketchBorder>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <!-- 劝说模式分布柱状图 -->
      <SketchBorder padding="2.25rem">
        <DualTextBlock cn="劝说模式接受率分布" en="PERSUADE MODE DISTRIBUTION" size="md" weight="normal" />
        <div class="mt-6 space-y-5">
          <div v-for="m in modeList" :key="m.mode">
            <div class="flex items-center justify-between text-xs">
              <span class="font-light">{{ m.mode }}</span>
              <span class="font-en text-sketch-lineSub">{{ m.count }}</span>
            </div>
            <div class="mt-1.5 relative h-3">
              <!-- 背景轨道 -->
              <svg class="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 6">
                <line x1="0" y1="3" x2="100" y2="3" class="sketch-stroke" stroke-width="0.8" opacity="0.4" />
              </svg>
              <!-- 数据柱（仅描边方框） -->
              <svg class="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 6">
                <rect
                  x="0"
                  y="1"
                  :width="m.pct"
                  height="4"
                  class="sketch-stroke"
                  stroke-width="0.9"
                  fill="rgba(99,68,66,0.12)"
                />
              </svg>
            </div>
          </div>
        </div>
      </SketchBorder>

      <!-- 意愿分数 - 完成率折线图 -->
      <SketchBorder padding="2.25rem">
        <DualTextBlock cn="意愿分数 - 完成率" en="WILL SCORE VS COMPLETION RATE" size="md" weight="normal" />
        <div class="mt-4">
          <svg viewBox="0 0 320 160" class="w-full">
            <!-- 坐标轴 -->
            <line x1="24" y1="140" x2="312" y2="140" class="sketch-stroke" stroke-width="1.2" />
            <line x1="24" y1="20" x2="24" y2="140" class="sketch-stroke" stroke-width="1.2" />
            <!-- 网格虚线 · accent 点缀 -->
            <line x1="24" y1="50" x2="312" y2="50" stroke="#A9C8C2" stroke-width="0.7" opacity="0.5" stroke-dasharray="2 3" stroke-linecap="round" />
            <line x1="24" y1="95" x2="312" y2="95" stroke="#A9C8C2" stroke-width="0.7" opacity="0.5" stroke-dasharray="2 3" stroke-linecap="round" />

            <!-- 散落装饰小方框 -->
            <rect x="290" y="30" width="8" height="8" class="sketch-stroke" stroke-width="0.9" />
            <rect x="30" y="125" width="6" height="6" class="sketch-stroke" stroke-width="0.9" />

            <!-- 折线 -->
            <polyline
              v-if="scatterPoints.length"
              :points="scatterPoints.map(p => `${p.x},${p.y}`).join(' ')"
              class="sketch-stroke"
              stroke-width="2.1"
              fill="none"
            />
            <!-- 数据点：空心方框 -->
            <rect
              v-for="(p, i) in scatterPoints"
              :key="i"
              :x="p.x - 3"
              :y="p.y - 3"
              width="6"
              height="6"
              class="sketch-stroke"
              stroke-width="1.5"
              fill="none"
            />
            <!-- x 轴标签 -->
            <text
              v-for="w in [1, 5, 10]"
              :key="w"
              :x="24 + ((w - 1) / 9) * (320 - 48)"
              y="154"
              text-anchor="middle"
              fill="rgba(99,68,66,0.65)"
              font-size="8"
              font-family="Inter, sans-serif"
            >{{ w }}</text>
            <!-- y 轴标签 -->
            <text x="18" y="24" text-anchor="end" fill="rgba(99,68,66,0.65)" font-size="8" font-family="Inter, sans-serif">100%</text>
            <text x="18" y="143" text-anchor="end" fill="rgba(99,68,66,0.65)" font-size="8" font-family="Inter, sans-serif">0%</text>
          </svg>
          <p class="mt-2 text-[10px] text-sketch-lineSub font-en tracking-widest">X · WILL SCORE　　Y · COMPLETION RATE</p>
        </div>
      </SketchBorder>
    </div>

    <!-- 底部 -->
    <div class="mt-10 flex flex-wrap gap-3">
      <LinearButton size="lg" @click="router.push('/task-create')">新的一次纠结</LinearButton>
      <LinearButton size="lg" @click="router.push('/')">返回首页</LinearButton>
    </div>
  </PageWrapper>
</template>
