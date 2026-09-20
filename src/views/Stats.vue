<script setup lang="ts">
// 个人统计页 /stats
// 图表沿用 lieflat-charts 视觉语法（tick rows / tick gauge / 单位点阵），
// 手绘 SVG + 品牌 custom 色板：奶米底、深棕墨线、薄荷灰绿为唯一 HERO 色
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

// ── custom 色板角色 ──────────────────────────────────────────────
const INK = "#634442"; // 炭棕：主数据/文字
const HERO_DEEP = "#7FA89F"; // 薄荷灰绿（奶米底上保证对比度）：已执行/主角
const MUT = "rgba(99,68,66,0.55)"; // 次要文字
const FAINT = "rgba(99,68,66,0.28)"; // 空 tick / 刻度
const GRID = "rgba(99,68,66,0.2)"; // 发丝导轨

/** 确定性伪随机（不用 Math.random，刷新长一样） */
function rnd(i: number, k: number): number {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

const router = useRouter();
const store = useAgentStore();

onMounted(() => {
  store.loadSessions();
});

const stats = computed(() => store.stats);

// ── 图 1：接受率 tick gauge（1 tick = 5%，共 20 tick）────────────
const gaugeTicks = computed(() =>
  Array.from({ length: 20 }, (_, k) => ({
    x: k * 9.4,
    on: stats.value.acceptRate > k * 5,
    h: 0,
    delay: k * 0.03,
  })).map((t) => ({ ...t, h: t.on ? 11 + rnd(t.x + 1, 2) * 5 : 5 + rnd(t.x + 1, 7) * 2 })),
);

// ── 图 2：劝说模式 tick rows（1 根竖发丝 = 1 次会话）────────────
const ROW_X0 = 104;
const ROW_X1 = 372;
const modeRows = computed(() => {
  const dist = stats.value.modeDistribution;
  const modes = Object.keys(dist) as PersuadeMode[];
  const counts = modes.map((m) => dist[m]);
  const max = Math.max(1, ...counts);
  // tick 间距随最大值收缩，保证大量会话也不溢出
  const px = Math.min(8, (ROW_X1 - ROW_X0 - 18) / max);
  const heroMode = modes[counts.indexOf(Math.max(...counts))];
  return modes.map((mode, i) => {
    const count = dist[mode];
    return {
      mode,
      count,
      hero: count > 0 && mode === heroMode,
      y: 62 + i * 76,
      labelX: ROW_X0 + count * px + 8,
      ticks: Array.from({ length: count }, (_, k) => ({
        x: ROW_X0 + k * px + px / 2,
        h: 10 + rnd(k + 1, i + 2) * 6,
        mark: k % 5 === 4,
        delay: i * 0.08 + k * 0.012,
      })),
    };
  });
});

// ── 图 3：意愿分 × 执行（双点散点）────────
// x=意愿分 1-10，y=次数。每个意愿分最多两个点：
//   实心点高度=做了几次，空心点高度=没做几次（一个点代表该类全部次数）。
// 两个次数相同会重叠时，左右错开放同一行。y 严格对齐刻度，仅 x/半径轻微手绘抖动。
const BUB_X0 = 44;
const BUB_X1 = 372;
const BUB_BASE = 202; // 基线（0 次）
const BUB_TOP = 40; // 绘图顶部
const DOT_R = 7.2;
const PAIR_DX = 9; // 同次数时实心/空心左右错开的位移
const willChart = computed(() => {
  const cw = (BUB_X1 - BUB_X0) / 10;
  // 按意愿分分桶
  const buckets: Record<number, boolean[]> = {};
  for (let w = 1; w <= 10; w++) buckets[w] = [];
  stats.value.willVsComplete.forEach((p) => buckets[p.willScore]?.push(p.completed));

  const cols = Object.entries(buckets).map(([w, arr]) => ({
    w: Number(w),
    cx: BUB_X0 + (Number(w) - 0.5) * cw,
    doneN: arr.filter(Boolean).length,
    undoneN: arr.filter((x) => !x).length,
    long: Number(w) === 1 || Number(w) === 5 || Number(w) === 10,
  }));

  const maxN = Math.max(1, ...cols.flatMap((c) => [c.doneN, c.undoneN]));
  // 次数→像素：≤8 次用固定层距，更多再压缩
  const pitch = maxN <= 8 ? 18 : (BUB_BASE - BUB_TOP - 8) / maxN;
  const yFor = (n: number) => BUB_BASE - DOT_R - 3 - (n - 1) * pitch;

  // 每个意愿分：一个实心点(执行次数) + 一个空心点(未执行次数)；同次数则左右排开
  const dots = cols.flatMap((c, ci) => {
    const same = c.doneN > 0 && c.doneN === c.undoneN;
    const mk = (completed: boolean, n: number, side: -1 | 0 | 1) => ({
      w: c.w,
      completed,
      n,
      cx: c.cx + side * PAIR_DX + (rnd(c.w * 7 + (completed ? 1 : 2), 5) - 0.5) * 1.6,
      cy: yFor(n), // y 严格对齐次数刻度，不抖动
      r: DOT_R + (rnd(c.w * 7 + (completed ? 3 : 4), 9) - 0.5) * 1.8,
      delay: 0.12 + ci * 0.06 + (completed ? 0 : 0.05),
    });
    const out: ReturnType<typeof mk>[] = [];
    if (c.doneN > 0) out.push(mk(true, c.doneN, same ? -1 : 0));
    if (c.undoneN > 0) out.push(mk(false, c.undoneN, same ? 1 : 0));
    return out;
  });

  // y 轴次数刻度 0..maxN
  const yTicks = Array.from({ length: maxN + 1 }, (_, k) => ({
    k,
    y: k === 0 ? BUB_BASE : yFor(k),
  }));

  return { cols, dots, yTicks, empty: dots.length === 0 };
});

// 散落装饰：手绘方框（波点由 DecorDotCluster 统一渲染）
interface BoxDeco {
  top: string;
  left?: string;
  right?: string;
  rotate?: number;
  size: number;
}
const decos: BoxDeco[] = [{ top: "12%", left: "3%", rotate: -10, size: 28 }];
</script>

<template>
  <PageWrapper full title="个人统计" subtitle="PERSONAL STATS">
    <!-- 散落装饰：波点簇 + 手绘方框 -->
    <DecorDotCluster :count="26" :spread="110" :safe-inset="50" :hollow-ratio="0.3" />
    <div
      v-for="(b, i) in decos"
      :key="i"
      class="pointer-events-none absolute"
      :style="{ top: b.top, left: b.left, right: b.right }"
    >
      <SketchCheckbox :size="b.size" :rotate="b.rotate" decorative />
    </div>

    <!-- 顶部 KPI：接受率带 tick gauge -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5 mb-8 sm:mb-10">
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
        <p class="mt-3 text-4xl font-light font-en">
          {{ stats.acceptRate }}<span class="text-lg">%</span>
        </p>
        <!-- C7 tick gauge：1 tick = 5%，上墨 = 接受 -->
        <svg viewBox="0 0 188 26" class="mt-3 w-48" aria-hidden="true">
          <line x1="0" y1="22" x2="188" y2="22" :stroke="GRID" stroke-width="0.7" />
          <line
            v-for="(t, i) in gaugeTicks"
            :key="i"
            class="tick-rise"
            :x1="t.x"
            y1="22"
            :x2="t.x"
            :y2="22 - t.h"
            :stroke="t.on ? HERO_DEEP : FAINT"
            :stroke-width="t.on ? 1.5 : 0.9"
            stroke-linecap="round"
            :style="{ animationDelay: `${t.delay}s` }"
          />
        </svg>
        <p class="mt-1 text-[9px] text-sketch-lineSub font-en tracking-widest">
          1 TICK = 5% · INKED = ACCEPTED
        </p>
      </SketchBorder>
    </div>

    <div class="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-8 lg:gap-10">
      <!-- 图 2：劝说模式 tick rows -->
      <SketchBorder padding="2.25rem">
        <DualTextBlock cn="劝说模式分布" en="PERSUADE MODE DISTRIBUTION" size="md" weight="normal" />
        <svg viewBox="0 0 400 272" class="mt-4 w-full" role="img" aria-label="劝说模式出现次数">
          <g v-for="(row, i) in modeRows" :key="row.mode">
            <!-- 模式名 -->
            <text
              :x="ROW_X0 - 12"
              :y="row.y + 4"
              text-anchor="end"
              :fill="row.hero ? HERO_DEEP : MUT"
              font-size="9.5"
              font-weight="600"
              font-family="'Noto Sans SC', sans-serif"
            >{{ row.mode }}</text>
            <!-- 发丝基线 -->
            <line :x1="ROW_X0" :y1="row.y + 10" :x2="ROW_X1" :y2="row.y + 10" :stroke="GRID" stroke-width="0.7" />
            <!-- 单位 tick：一根竖线 = 一次会话 -->
            <line
              v-for="(t, k) in row.ticks"
              :key="k"
              class="tick-rise"
              :x1="t.x"
              :y1="row.y + 10"
              :x2="t.x"
              :y2="row.y + 10 - t.h"
              :stroke="row.hero ? HERO_DEEP : INK"
              :stroke-width="1.1"
              stroke-linecap="round"
              :opacity="row.hero ? 0.95 : 0.55 + rnd(k + 3, i + 5) * 0.4"
              :style="{ animationDelay: `${t.delay}s` }"
            />
            <!-- 每 5 tick 一个点标 -->
            <circle
              v-for="(t, k) in row.ticks.filter((x) => x.mark)"
              :key="`m${k}`"
              :cx="t.x"
              :cy="row.y + 15"
              r="0.9"
              :fill="FAINT"
            />
            <!-- 行尾大计数 -->
            <text
              :x="row.labelX"
              :y="row.y + 5"
              font-size="12"
              font-weight="800"
              :fill="row.hero ? HERO_DEEP : INK"
              font-family="Inter, sans-serif"
            >{{ row.count }}</text>
          </g>
          <text
            x="238" y="258" text-anchor="middle" font-size="7.5" font-weight="600"
            :fill="FAINT" font-family="Inter, sans-serif" letter-spacing="0.12em"
          >ONE TICK = ONE SESSION · DOT MARKS EVERY FIFTH</text>
        </svg>
      </SketchBorder>

      <!-- 图 3：意愿分 × 执行情况 porcelain 气泡年鉴 -->
      <SketchBorder padding="2.25rem">
        <div class="flex items-start justify-between gap-3">
          <DualTextBlock cn="意愿分数与执行" en="WILL SCORE × EXECUTION" size="md" weight="normal" />
          <!-- 图例：实心=已执行，空心=未执行 -->
          <div class="flex shrink-0 items-center gap-3 pt-1 text-[10px] text-sketch-lineSub">
            <span class="flex items-center gap-1.5 whitespace-nowrap">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="5" :fill="HERO_DEEP" />
              </svg>已执行
            </span>
            <span class="flex items-center gap-1.5 whitespace-nowrap">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="5" fill="#FFF2E1" :stroke="MUT" stroke-width="1.4" />
              </svg>未执行
            </span>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="willChart.empty" class="flex h-[250px] flex-col items-center justify-center text-center">
          <SketchCheckbox :size="30" decorative />
          <p class="mt-3 text-sm font-light text-sketch-lineSub">
            还没有真实执行反馈，去结果页记录你的行动吧
          </p>
        </div>

        <svg v-else viewBox="0 0 400 262" class="mt-4 w-full" role="img" aria-label="意愿分数与执行双点图：横轴意愿1到10，纵轴次数；每个意愿分上实心点高度为已执行次数、空心点高度为未执行次数，次数相同时左右排开">
          <!-- y 轴：次数（横向导轨 + 左侧数字，对齐每一层圆点） -->
          <g v-for="t in willChart.yTicks" :key="`y${t.k}`">
            <line
              v-if="t.k > 0"
              :x1="BUB_X0" :y1="t.y" :x2="BUB_X1" :y2="t.y"
              :stroke="GRID" stroke-width="0.5"
            />
            <text
              :x="BUB_X0 - 9" :y="t.y + 2.5" text-anchor="end"
              :fill="t.k === 0 ? MUT : FAINT" font-size="7" font-weight="600"
              font-family="Inter, sans-serif"
            >{{ t.k }}</text>
          </g>
          <!-- y 轴标题 -->
          <text
            :x="BUB_X0 - 26" :y="BUB_TOP - 6" text-anchor="middle"
            :fill="MUT" font-size="7.5" font-weight="600"
            font-family="'Noto Sans SC', Inter, sans-serif"
          >次数</text>

          <!-- x 基线 + 列刻度 + 意愿分 1-10 -->
          <line :x1="BUB_X0" :y1="BUB_BASE" :x2="BUB_X1" :y2="BUB_BASE" :stroke="GRID" stroke-width="0.9" />
          <line
            v-for="c in willChart.cols"
            :key="`b${c.w}`"
            :x1="c.cx"
            :y1="BUB_BASE"
            :x2="c.cx"
            :y2="c.long ? BUB_BASE + 9 : BUB_BASE + 5"
            :stroke="FAINT"
            stroke-width="0.7"
          />
          <text
            v-for="c in willChart.cols"
            :key="`x${c.w}`"
            :x="c.cx"
            :y="BUB_BASE + 20"
            text-anchor="middle"
            :fill="c.long ? MUT : FAINT"
            font-size="7.5"
            font-weight="600"
            font-family="Inter, sans-serif"
          >{{ c.w }}</text>
          <text
            :x="(BUB_X0 + BUB_X1) / 2" :y="BUB_BASE + 34" text-anchor="middle"
            :fill="MUT" font-size="8" font-weight="600"
            font-family="'Noto Sans SC', Inter, sans-serif" letter-spacing="0.05em"
          >意愿分数 · 1 不想做 → 10 很想做</text>

          <!-- 决策气泡：自下而上逐个弹入；实心沉底=已执行，空心摞其上=未执行 -->
          <circle
            v-for="(d, i) in willChart.dots"
            :key="`d${i}`"
            :cx="d.cx"
            :cy="d.cy"
            :r="d.r"
            :fill="d.completed ? HERO_DEEP : '#FFF2E1'"
            :stroke="d.completed ? HERO_DEEP : MUT"
            :stroke-width="d.completed ? 0 : 1.4"
            class="box-pop"
            :style="{ animationDelay: `${d.delay}s` }"
          />
        </svg>
      </SketchBorder>
    </div>

    <!-- 底部 -->
    <div class="mt-10 flex flex-wrap gap-3">
      <LinearButton size="lg" @click="router.push('/task-create')">新的一次纠结</LinearButton>
      <LinearButton size="lg" @click="router.push('/')">返回首页</LinearButton>
    </div>
  </PageWrapper>
</template>

<style scoped>
/* 入场动画：发丝线自基线向上生长 / 单位点弹出，遵循 quarticOut 快进快停 */
@keyframes tick-rise {
  from {
    transform: scaleY(0);
    opacity: 0;
  }
  to {
    transform: scaleY(1);
    opacity: 1;
  }
}
@keyframes box-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  70% {
    transform: scale(1.12);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.tick-rise {
  transform-box: fill-box;
  transform-origin: bottom;
  animation: tick-rise 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.box-pop {
  transform-box: fill-box;
  transform-origin: center;
  animation: box-pop 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
/* 一笔画：曲线从头描到尾 */
.stroke-draw {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: stroke-draw 1.1s cubic-bezier(0.55, 0, 0.25, 1) 0.15s forwards;
}
@keyframes stroke-draw {
  to {
    stroke-dashoffset: 0;
  }
}
/* 填充随曲线收笔淡入 */
.area-fade {
  opacity: 0;
  animation: area-fade 0.7s ease 0.9s forwards;
}
@keyframes area-fade {
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tick-rise,
  .box-pop,
  .stroke-draw,
  .area-fade {
    animation: none;
    opacity: 1;
    stroke-dashoffset: 0;
  }
}
</style>
