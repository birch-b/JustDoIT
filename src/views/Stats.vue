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
const HERO = "#A9C8C2"; // 薄荷灰绿：已执行/主角（填充）
const HERO_DEEP = "#7FA89F"; // 薄荷描边（奶米底上保证对比度）
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

// ── 图 3：意愿分 × 完成率（glance-stroke 一笔画曲线 + 底层单位点）──
const DOT_X0 = 44;
const DOT_X1 = 372;
const DOT_BASE = 206; // 曲线地板
const DOT_TOP = 34; // 100% 对应的顶部
const willChart = computed(() => {
  const cw = (DOT_X1 - DOT_X0) / 10;
  // 按意愿分分桶，保留每条真实反馈记录
  const buckets: Record<number, boolean[]> = {};
  for (let w = 1; w <= 10; w++) buckets[w] = [];
  stats.value.willVsComplete.forEach((p) => buckets[p.willScore]?.push(p.completed));

  const maxCol = Math.max(1, ...Object.values(buckets).map((b) => b.length));
  const pitch = Math.max(7, Math.min(12, 150 / maxCol));
  const size = 5; // 底层证据点统一缩小

  const cols = Object.entries(buckets).map(([w, arr]) => {
    const wn = Number(w);
    const cx = DOT_X0 + (wn - 0.5) * cw;
    const done = arr.filter(Boolean).length;
    return {
      w: wn,
      cx,
      total: arr.length,
      done,
      rate: arr.length ? Math.round((done / arr.length) * 100) : null,
      long: wn === 1 || wn === 5 || wn === 10,
    };
  });

  // 底层证据点（缩小、淡化，曲线是主角）
  const dots = Object.entries(buckets).flatMap(([w, arr]) => {
    const wn = Number(w);
    const cx = DOT_X0 + (wn - 0.5) * cw;
    return arr.map((completed, idx) => ({
      x: cx + (rnd(idx + 3, wn) - 0.5) * 9 - size / 2,
      y: DOT_BASE - 7 - idx * pitch - rnd(idx + 7, wn + 4) * 1.5 - size / 2,
      size,
      completed,
    }));
  });

  // 有数据的列才是曲线顶点；rate→y
  const pts = cols
    .filter((c) => c.rate !== null)
    .map((c) => ({ x: c.cx, y: DOT_BASE - (c.rate as number) / 100 * (DOT_BASE - DOT_TOP), w: c.w, rate: c.rate as number, total: c.total }));

  // Catmull-Rom → 三次贝塞尔，生成平滑曲线
  const linePath = smoothPath(pts);
  const areaPath = pts.length >= 2
    ? `${linePath} L ${pts[pts.length - 1].x} ${DOT_BASE} L ${pts[0].x} ${DOT_BASE} Z`
    : "";

  return { cols, dots, pts, linePath, areaPath, empty: pts.length === 0 };
});

/** Catmull-Rom 样条转 SVG 贝塞尔 path；不足 2 点退化为线段/空 */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

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

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
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

      <!-- 图 3：意愿分 × 执行情况 单位点阵 -->
      <SketchBorder padding="2.25rem">
        <div class="flex items-start justify-between gap-3">
          <DualTextBlock cn="意愿分数与执行" en="WILL SCORE × EXECUTION" size="md" weight="normal" />
          <!-- 图例 -->
          <div class="flex shrink-0 items-center gap-3 pt-1 text-[10px] text-sketch-lineSub">
            <span class="flex items-center gap-1.5 whitespace-nowrap">
              <span
                class="inline-block h-2.5 w-2.5"
                :style="{ background: HERO, border: `1px solid ${HERO_DEEP}` }"
              />已执行
            </span>
            <span class="flex items-center gap-1.5 whitespace-nowrap">
              <span
                class="inline-block h-2.5 w-2.5"
                :style="{ border: `1.2px solid ${INK}` }"
              />未执行
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

        <svg v-else viewBox="0 0 400 262" class="mt-4 w-full" role="img" aria-label="意愿分数与完成率趋势曲线">
          <defs>
            <!-- 曲线下方薄荷渐变填充 -->
            <linearGradient id="willArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#A9C8C2" stop-opacity="0.55" />
              <stop offset="100%" stop-color="#A9C8C2" stop-opacity="0.04" />
            </linearGradient>
          </defs>

          <!-- y 轴只标两端：100%=全部执行（顶）、0%=全部未执行（地板） -->
          <line :x1="DOT_X0" :y1="DOT_TOP" :x2="DOT_X1" :y2="DOT_TOP" :stroke="FAINT" stroke-width="0.6" stroke-dasharray="2 3" />
          <text
            :x="DOT_X0 - 8" :y="DOT_TOP + 2.5" text-anchor="end"
            :fill="FAINT" font-size="7" font-weight="600" font-family="Inter, sans-serif"
          >100%</text>
          <line :x1="DOT_X0" :y1="DOT_BASE" :x2="DOT_X1" :y2="DOT_BASE" :stroke="GRID" stroke-width="0.9" />
          <text
            :x="DOT_X0 - 8" :y="DOT_BASE + 2.5" text-anchor="end"
            :fill="MUT" font-size="7" font-weight="600" font-family="Inter, sans-serif"
          >0%</text>

          <!-- barcode 地板刻度 + 列号 1-10 -->
          <line
            v-for="c in willChart.cols"
            :key="`b${c.w}`"
            :x1="c.cx"
            :y1="DOT_BASE"
            :x2="c.cx"
            :y2="c.long ? DOT_BASE + 9 : DOT_BASE + 5"
            :stroke="FAINT"
            stroke-width="0.7"
          />
          <text
            v-for="c in willChart.cols"
            :key="`x${c.w}`"
            :x="c.cx"
            :y="DOT_BASE + 20"
            text-anchor="middle"
            :fill="c.long ? MUT : FAINT"
            font-size="7.5"
            font-weight="600"
            font-family="Inter, sans-serif"
          >{{ c.w }}</text>
          <!-- x 轴标题：意愿分数 1→10 -->
          <text
            :x="(DOT_X0 + DOT_X1) / 2" :y="DOT_BASE + 34" text-anchor="middle"
            :fill="MUT" font-size="8" font-weight="600"
            font-family="'Noto Sans SC', Inter, sans-serif" letter-spacing="0.05em"
          >意愿分数 WILL SCORE · 1 不想做 → 10 很想做</text>

          <!-- 底层证据点：1 方框 = 1 次有反馈决策（淡化，曲线为主角） -->
          <rect
            v-for="(d, i) in willChart.dots"
            :key="`d${i}`"
            :x="d.x"
            :y="d.y"
            :width="d.size"
            :height="d.size"
            :fill="d.completed ? HERO : 'none'"
            :stroke="d.completed ? HERO_DEEP : FAINT"
            :stroke-width="0.9"
            :opacity="d.completed ? 0.55 : 0.8"
          />

          <!-- 曲线下方填充（≥2 点） -->
          <path v-if="willChart.areaPath" :d="willChart.areaPath" fill="url(#willArea)" class="area-fade" />
          <!-- 一笔画平滑曲线 -->
          <path
            v-if="willChart.pts.length >= 2"
            :d="willChart.linePath"
            fill="none"
            :stroke="HERO_DEEP"
            stroke-width="2.1"
            stroke-linecap="round"
            class="stroke-draw"
            pathLength="1"
          />
          <!-- 顶点：手绘小方框 + 完成率标签 -->
          <g v-for="(p, i) in willChart.pts" :key="`p${i}`">
            <rect
              class="box-pop"
              :x="p.x - 3.5"
              :y="p.y - 3.5"
              width="7"
              height="7"
              :fill="p.rate >= 50 ? HERO : '#FFF2E1'"
              :stroke="HERO_DEEP"
              stroke-width="1.4"
              :style="{ animationDelay: `${0.5 + i * 0.12}s` }"
            />
            <text
              :x="p.x"
              :y="p.y - 8"
              text-anchor="middle"
              :fill="HERO_DEEP"
              font-size="8"
              font-weight="800"
              font-family="Inter, sans-serif"
              style="paint-order: stroke; stroke: #fff2e1; stroke-width: 2.5px"
            >{{ p.rate }}%</text>
          </g>

          <text
            x="208" y="258" text-anchor="middle" font-size="7" font-weight="600"
            :fill="FAINT" font-family="Inter, sans-serif" letter-spacing="0.1em"
          >CURVE = COMPLETION RATE · SMALL BOX = ONE DECISION WITH FEEDBACK</text>
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
