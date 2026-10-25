<script setup lang="ts">
// 关键词汇总页 /keywords：展示系统记住的关于你的关键词与洞察，支持增删改
// 不暴露置信度（用户不关心）；关键词以手绘墨圈气泡呈现，洞察内容以卡片列表管理
import { computed, onMounted, ref } from "vue";
import {
  getMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  getSelfInsight,
  MEMORY_TYPE_LABEL,
  type SelfInsight,
  type UserMemoryItem,
} from "@/api/memoryApi";
import { useUserStore } from "@/store/userStore";
import { openQuestionnaire } from "@/components/onboarding/PreferenceQuestionnaire.vue";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchConfirmDialog from "@/components/sketch/SketchConfirmDialog.vue";
import SketchSelect from "@/components/sketch/SketchSelect.vue";
import DecorDotCluster from "@/components/sketch/DecorDotCluster.vue";

import { isNetworkError, sleep } from "@/api/http";

const INK = "#634442"; // 炭棕墨线

/** 类型选项给 SketchSelect 用 */
const typeOptions = computed(() =>
  Object.entries(MEMORY_TYPE_LABEL).map(([value, label]) => ({ label, value }))
);

/** 确定性伪随机（不用 Math.random，刷新长一样） */
function rnd(i: number, k: number): number {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** 手绘不规则墨圈 */
function sketchCirclePath(cx: number, cy: number, r: number, seed: number): string {
  const K = 9;
  const a0 = rnd(seed, 13) * Math.PI * 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < K; i++) {
    const a = a0 + (i / K) * Math.PI * 2;
    const wob = 1 + (rnd(seed * 3 + i, 11) - 0.5) * 0.2;
    pts.push([cx + Math.cos(a) * r * wob, cy + Math.sin(a) * r * wob]);
  }
  const P = (i: number) => pts[(i + K) % K];
  let d = `M ${P(0)[0].toFixed(2)} ${P(0)[1].toFixed(2)}`;
  for (let i = 0; i < K; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d} Z`;
}

interface KeywordBubble {
  keyword: string;
  d: string;
  duration: string;
  delay: string;
  wide: boolean;
}

const memories = ref<UserMemoryItem[]>([]);
const loading = ref(false);
const errorMsg = ref("");
const userStore = useUserStore();

function editPreference() {
  openQuestionnaire(userStore.currentUser?.preference ?? null);
}

// ── 卡片切换：第 1 页关键词 / 第 2 页阶段总结 ──
type PageKey = "keywords" | "insight";
const pageOrder: PageKey[] = ["keywords", "insight"];
const tabs: { key: PageKey; label: string }[] = [
  { key: "keywords", label: "关键词" },
  { key: "insight", label: "探索手册" },
];
const page = ref<PageKey>("keywords");
const slideDir = ref<"left" | "right">("left");

function switchPage(p: PageKey) {
  if (p === page.value) return;
  slideDir.value = pageOrder.indexOf(p) > pageOrder.indexOf(page.value) ? "left" : "right";
  page.value = p;
  if (p === "insight" && !insightLoaded.value) void loadInsight();
}

// 移动端触摸滑动切换（横向滑动超过阈值换页）
let touchStartX = 0;
function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX;
}
function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) < 48) return;
  switchPage(dx < 0 ? "insight" : "keywords");
}

// ── 探索手册：进入第 2 页时才拉取；后端攒够 5 条新纠结才重写，平时直接给旧稿 ──
const insight = ref<SelfInsight | null>(null);
const insightMeta = ref<{
  updatedAt: number | null;
  nextUpdateAt: number | null;
  samples: number;
  minSamples: number;
} | null>(null);
const insightLoading = ref(false);
const insightLoaded = ref(false);
const insightError = ref("");

/** 时间戳 → MM-DD */
function mdText(ts: number | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

const insightUpdatedText = computed(() => mdText(insightMeta.value?.updatedAt));
const insightNextText = computed(() => mdText(insightMeta.value?.nextUpdateAt));

async function loadInsight(refresh = false) {
  insightLoading.value = true;
  insightError.value = "";
  try {
    const view = await getSelfInsight(refresh);
    insight.value = view.insight;
    insightMeta.value = {
      updatedAt: view.updatedAt,
      nextUpdateAt: view.nextUpdateAt,
      samples: view.samples,
      minSamples: view.minSamples,
    };
    insightLoaded.value = true;
  } catch {
    insightError.value = "手册加载失败，稍后再试";
  } finally {
    insightLoading.value = false;
  }
}

// 去重后的关键词气泡（全部展示，不按置信度区分颜色）
const keywordBubbles = computed<KeywordBubble[]>(() => {
  const seen = new Set<string>();
  const out: KeywordBubble[] = [];
  for (const m of memories.value) {
    const kw = m.keyword?.trim();
    if (!kw || seen.has(kw)) continue;
    seen.add(kw);
    const idx = out.length;
    const seed = idx * 17 + 5;
    out.push({
      keyword: kw,
      d: sketchCirclePath(50, 50, 40, seed),
      duration: `${(3.8 + rnd(seed, 3) * 1.8).toFixed(2)}s`,
      delay: `${(-rnd(seed, 7) * 3.5).toFixed(2)}s`,
      wide: kw.length >= 4,
    });
  }
  return out;
});

// 编辑态：记录正在编辑的 memory id 与草稿
const editingId = ref<number | null>(null);
const editDraft = ref({ memoryType: "", content: "", keyword: "" });

// 新增态
const showCreate = ref(false);
const createDraft = ref({ memoryType: "behavior", content: "", keyword: "" });

// 删除确认弹窗
const deleteTarget = ref<UserMemoryItem | null>(null);
const deleting = ref(false);

async function load() {
  loading.value = true;
  errorMsg.value = "";
  // 网络故障（后端重启等）自动等待重试两次，避免误显示成「还没有关键词」
  const delays = [700, 1500];
  for (let attempt = 0; ; attempt++) {
    try {
      memories.value = (await getMemories()) ?? [];
      errorMsg.value = "";
      break;
    } catch (e) {
      if (isNetworkError(e) && attempt < delays.length) {
        await sleep(delays[attempt]);
        continue;
      }
      errorMsg.value = "记忆加载失败，可能是网络抖动";
      break;
    }
  }
  loading.value = false;
}

function startEdit(m: UserMemoryItem) {
  editingId.value = m.id;
  editDraft.value = {
    memoryType: m.memoryType,
    content: m.content,
    keyword: m.keyword ?? "",
  };
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(id: number) {
  if (!editDraft.value.content.trim()) return;
  try {
    const updated = await updateMemory(id, {
      memoryType: editDraft.value.memoryType,
      content: editDraft.value.content.trim(),
      keyword: editDraft.value.keyword,
    });
    const idx = memories.value.findIndex((m) => m.id === id);
    if (idx >= 0) memories.value[idx] = updated;
    editingId.value = null;
  } catch {
    errorMsg.value = "保存失败，稍后再试";
  }
}

async function submitCreate() {
  if (!createDraft.value.content.trim()) return;
  try {
    const created = await createMemory({
      memoryType: createDraft.value.memoryType,
      content: createDraft.value.content.trim(),
      keyword: createDraft.value.keyword.trim() || undefined,
    });
    memories.value.unshift(created);
    createDraft.value = { memoryType: "behavior", content: "", keyword: "" };
    showCreate.value = false;
  } catch {
    errorMsg.value = "创建失败，稍后再试";
  }
}

function askDelete(m: UserMemoryItem) {
  deleteTarget.value = m;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await deleteMemory(deleteTarget.value.id);
    memories.value = memories.value.filter((m) => m.id !== deleteTarget.value!.id);
    deleteTarget.value = null;
  } catch {
    errorMsg.value = "删除失败，稍后再试";
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
</script>

<template>

  <PageWrapper>
       <DecorDotCluster
      :count="40"
      :spread="110"
      :safe-inset="50"
      :hollow-ratio="0.3"
    />
    <!-- 标题放进内容列一起 mx-auto 居中，保证标题与正文左边缘对齐（参考首页布局） -->
    <!-- 不加内边距：PageWrapper 已有 px-4 py-10 md:px-6，避免双重缩进 -->
    <div class="mx-auto max-w-5xl">
      <header class="mb-8 md:mb-12">
        <h1 class="text-3xl md:text-4xl font-light tracking-wide">自我探索</h1>
      </header>

      <!-- 副标题说明 -->
      <p class="mb-8 text-sm font-light leading-relaxed text-sketch-lineSub">
        这些是你在一次次纠结里留下的痕迹——你容易被什么说动、总在什么事上拖延。
        不准的地方可以改，也可以删掉。
      </p>

      <!-- 错误提示 + 手动重试 -->
      <div v-if="errorMsg" class="mb-4 flex items-center gap-4">
        <p class="text-sm text-sketch-accent">{{ errorMsg }}</p>
        <LinearButton size="sm" :disabled="loading" @click="load">
          {{ loading ? "重试中…" : "重试" }}
        </LinearButton>
      </div>

      <!-- 卡片切换头：关键词 / 阶段总结（移动端可左右滑动换页） -->
      <div class="mb-8 flex items-center gap-8">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="relative pb-1.5 text-base font-light transition-colors"
          :class="page === t.key ? 'text-sketch-line' : 'text-sketch-lineSub hover:text-sketch-line'"
          @click="switchPage(t.key)"
        >
          {{ t.label }}
          <svg
            v-if="page === t.key"
            class="absolute -bottom-0.5 left-0 h-[5px] w-full"
            viewBox="0 0 100 5"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M1 3 Q 25 1, 50 3 T 99 2.5"
              fill="none"
              stroke="#7FA89F"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <!-- 双页滑动容器 -->
      <div @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
        <Transition :name="slideDir === 'left' ? 'card-left' : 'card-right'" mode="out-in">
        <!-- 第 1 页：关键词 -->
        <div v-if="page === 'keywords'" key="keywords">
      <!-- 关键词墨圈气泡区 -->
      <SketchBorder v-if="!loading && keywordBubbles.length" padding="3rem 3.5rem" class="max-w-2xl">
        <DualTextBlock cn="关于你的词" en="KEYWORDS" size="sm" weight="normal" />
        <div class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-6">
          <span
            v-for="b in keywordBubbles"
            :key="b.keyword"
            class="kw-bubble relative inline-flex items-center justify-center leading-none"
            :class="b.wide ? 'kw-bubble--wide' : ''"
            :style="{
              animationDuration: b.duration,
              animationDelay: b.delay,
              color: INK,
            }"
          >
            <svg
              class="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                :d="b.d"
                :stroke="INK"
                stroke-width="2.2"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>
            <span class="relative z-10 text-sm sm:text-[15px] font-light tracking-wide">
              {{ b.keyword }}
            </span>
          </span>
        </div>
      </SketchBorder>

      <!-- 空状态（加载失败时不显示，避免误判成空账号） -->
      <SketchBorder v-else-if="!loading && !errorMsg" padding="2rem 3rem">
        <p class="text-sm font-light text-sketch-lineSub leading-relaxed">
          还没有关键词。多做几次纠结并留下反馈，系统会慢慢提炼出关于你的词；
          你也可以手动添加一条。
        </p>
      </SketchBorder>

      <!-- 新增按钮 -->
      <div class="mt-6 flex items-center gap-3">
        <LinearButton v-if="!showCreate" size="sm" @click="showCreate = true">
          + 手动添加一条
        </LinearButton>
        <LinearButton size="sm" @click="editPreference">
          <span>偏好设置</span>
        </LinearButton>
      </div>

      <!-- 新增表单 -->
      <SketchBorder v-if="showCreate" padding="2rem 3rem" class="mt-4">
        <DualTextBlock cn="新的洞察" en="NEW INSIGHT" size="sm" weight="normal" />
        <div class="mt-4 space-y-3">
          <div>
            <label class="text-xs text-sketch-lineSub">类型</label>
            <SketchSelect v-model="createDraft.memoryType" :options="typeOptions" class="mt-2 w-full" />
          </div>
          <div>
            <label class="text-xs text-sketch-lineSub">洞察内容</label>
            <textarea
              v-model="createDraft.content"
              rows="3"
              maxlength="500"
              placeholder="例如：对耗时超 60 分钟的任务容易拖延"
              class="sketch-input mt-2 w-full resize-none"
            />
          </div>
          <div>
            <label class="text-xs text-sketch-lineSub">关键词（3~5 字，可选）</label>
            <input
              v-model="createDraft.keyword"
              maxlength="10"
              placeholder="例如：爱拖延"
              class="sketch-input mt-2 w-full"
            />
          </div>
          <div class="flex justify-end gap-3">
            <LinearButton size="sm" @click="showCreate = false">取消</LinearButton>
            <LinearButton
              size="sm"
              :disabled="!createDraft.content.trim()"
              @click="submitCreate"
            >
              添加
            </LinearButton>
          </div>
        </div>
      </SketchBorder>

      <!-- 记忆列表 -->
      <div class="mt-8 space-y-4">
        <div v-for="m in memories" :key="m.id">
          <SketchBorder padding="1.5rem 1.5rem 1.5rem 2.75rem">
            <!-- 编辑态 -->
            <template v-if="editingId === m.id">
              <div class="space-y-3">
                <div>
                  <label class="text-xs text-sketch-lineSub">类型</label>
                  <SketchSelect v-model="editDraft.memoryType" :options="typeOptions" class="mt-2 w-full" />
                </div>
                <div>
                  <label class="text-xs text-sketch-lineSub">洞察内容</label>
                  <textarea
                    v-model="editDraft.content"
                    rows="3"
                    maxlength="500"
                    class="sketch-input mt-2 w-full resize-none"
                  />
                </div>
                <div>
                  <label class="text-xs text-sketch-lineSub">关键词（3~5 字，可清空）</label>
                  <input
                    v-model="editDraft.keyword"
                    maxlength="10"
                    class="sketch-input mt-2 w-full"
                  />
                </div>
                <div class="flex justify-end gap-3">
                  <LinearButton size="sm" @click="cancelEdit">取消</LinearButton>
                  <LinearButton
                    size="sm"
                    :disabled="!editDraft.content.trim()"
                    @click="saveEdit(m.id)"
                  >
                    保存
                  </LinearButton>
                </div>
              </div>
            </template>

            <!-- 展示态 -->
            <template v-else>
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span
                      class="inline-block rounded-sm border border-sketch-line/40 px-2 py-0.5 text-xs font-light text-sketch-lineSub"
                    >
                      {{ MEMORY_TYPE_LABEL[m.memoryType] ?? m.memoryType }}
                    </span>
                    <span
                      v-if="m.keyword"
                      class="inline-block rounded-full border border-sketch-accent/50 px-2.5 py-0.5 text-xs font-light text-sketch-accent"
                    >
                      {{ m.keyword }}
                    </span>
                  </div>
                  <p
                    v-if="m.content?.trim()"
                    class="mt-3 text-sm font-light leading-relaxed text-sketch-line break-words pl-2"
                  >
                    {{ m.content }}
                  </p>
                  <p
                    v-else
                    class="mt-3 text-xs font-light text-sketch-lineSub break-words pl-2"
                  >
                    （暂无描述，点击「编辑」可补充）
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2 pr-2">
                  <button
                    class="text-xs text-sketch-lineSub hover:text-sketch-line transition-colors"
                    @click="startEdit(m)"
                  >
                    编辑
                  </button>
                  <button
                    class="text-xs text-sketch-lineSub hover:text-sketch-accent transition-colors"
                    @click="askDelete(m)"
                  >
                    删除
                  </button>
                </div>
              </div>
            </template>
          </SketchBorder>
        </div>
      </div>

      <!-- 加载中 -->
      <p v-if="loading" class="mt-6 text-sm text-sketch-lineSub">加载中…</p>
        </div>

        <!-- 第 2 页：探索手册（场景标题 + 有画面感的叙事，不罗列数据） -->
        <div v-else key="insight">
          <p class="mb-6 text-sm font-light leading-relaxed text-sketch-lineSub">
            不是清单，也不是数据——是把你这些天的样子，讲成几个你认得出来的场景。
          </p>

          <!-- 行内错误条 + 重试 -->
          <div v-if="insightError" class="mb-4 flex items-center gap-4">
            <p class="text-sm text-sketch-accent">{{ insightError }}</p>
            <LinearButton size="sm" :disabled="insightLoading" @click="loadInsight()">
              重试
            </LinearButton>
          </div>

          <p v-if="insightLoading" class="text-sm text-sketch-lineSub">正在翻看你的纠结记录…</p>

          <template v-else-if="insight">
            <SketchBorder padding="2.5rem 3rem" class="max-w-2xl">
              <p class="mb-7 text-xs tracking-widest text-sketch-lineSub">你的探索手册</p>

              <section v-for="(c, i) in insight.chapters" :key="i" :class="i > 0 ? 'mt-7' : ''">
                <svg
                  v-if="i > 0"
                  class="mb-7 h-2 w-full"
                  viewBox="0 0 300 8"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 5 Q 40 1.5, 80 4.5 T 160 4 T 240 5 T 298 3.5"
                    fill="none"
                    stroke="#634442"
                    stroke-opacity="0.22"
                    stroke-width="1.2"
                    stroke-linecap="round"
                  />
                </svg>
                <h2 class="text-lg md:text-xl font-light leading-relaxed text-sketch-line">
                  {{ c.scene }}
                </h2>
                <p class="mt-3 text-sm font-light leading-loose text-sketch-line/90">
                  {{ c.story }}
                </p>
              </section>

              <div class="mt-8">
                <svg
                  class="mb-7 h-2 w-full"
                  viewBox="0 0 300 8"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 5 Q 40 1.5, 80 4.5 T 160 4 T 240 5 T 298 3.5"
                    fill="none"
                    stroke="#634442"
                    stroke-opacity="0.22"
                    stroke-width="1.2"
                    stroke-linecap="round"
                  />
                </svg>
                <DualTextBlock cn="想对你说" size="sm" weight="normal" />
                <p class="mt-3 text-sm font-light leading-loose text-sketch-line">
                  {{ insight.advice }}
                </p>
              </div>

              <p class="mt-8 text-base font-light leading-relaxed text-sketch-accent">
                {{ insight.question }}
              </p>
            </SketchBorder>

            <div class="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
              <LinearButton size="sm" :disabled="insightLoading" @click="loadInsight(true)">
                重新生成
              </LinearButton>
              <span class="text-xs font-light text-sketch-lineSub">
                上次更新 {{ insightUpdatedText }} · 每 7 天更新一次，下次 {{ insightNextText }}
              </span>
            </div>
          </template>

          <!-- 样本不足：还不够 5 次有反馈的纠结 -->
          <SketchBorder v-else padding="2rem 3rem" class="max-w-2xl">
            <p class="text-sm font-light text-sketch-lineSub leading-relaxed">
              还写不出你的手册——再完成
              {{ insightMeta ? Math.max(0, insightMeta.minSamples - insightMeta.samples) : 5 }}
              次纠结并留下反馈，我就能把你常有的样子讲给你听。
            </p>
          </SketchBorder>
        </div>
        </Transition>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <SketchConfirmDialog
      :open="!!deleteTarget"
      title="删除这条记忆？"
      message="删除后无法恢复，系统也不再用它来影响后续建议。"
      confirm-text="删除"
      :loading="deleting"
      @cancel="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </PageWrapper>
</template>

<style scoped>
/* 手绘墨圈气泡浮动动画 */
.kw-bubble {
  width: 5.5rem;
  height: 4rem;
  animation: kw-float 4s ease-in-out infinite;
}
.kw-bubble--wide {
  width: 7rem;
  height: 4rem;
}
@keyframes kw-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@media (prefers-reduced-motion: reduce) {
  .kw-bubble { animation: none; }
}

/* 卡片换页滑动过渡：左滑新页从右进，右滑新页从左进 */
.card-left-enter-active,
.card-left-leave-active,
.card-right-enter-active,
.card-right-leave-active {
  transition: transform 0.28s ease, opacity 0.28s ease;
}
.card-left-enter-from { transform: translateX(48px); opacity: 0; }
.card-left-leave-to { transform: translateX(-48px); opacity: 0; }
.card-right-enter-from { transform: translateX(-48px); opacity: 0; }
.card-right-leave-to { transform: translateX(48px); opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .card-left-enter-active,
  .card-left-leave-active,
  .card-right-enter-active,
  .card-right-leave-active {
    transition: none;
  }
}
</style>
