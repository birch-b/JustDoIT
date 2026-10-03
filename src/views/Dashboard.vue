<script setup lang="ts">
// 首页 / 仪表盘：历史会话卡片列表 + 新的一次纠结 + 装饰时钟
import { onMounted, computed, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAgentStore } from "@/store/agentStore";
import { useUserStore } from "@/store/userStore";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchClock from "@/components/sketch/SketchClock.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import SketchCheckbox from "@/components/sketch/SketchCheckbox.vue";
import SketchChip from "@/components/sketch/SketchChip.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import DecorDotCluster from "@/components/sketch/DecorDotCluster.vue";
import SketchConfirmDialog from "@/components/sketch/SketchConfirmDialog.vue";
import { useTodoStore } from "@/store/todoStore";

const router = useRouter();
const route = useRoute();
const store = useAgentStore();
const userStore = useUserStore();
const todoStore = useTodoStore();

// 是否已登录：首页对访客公开但不展示任何数据
const isLoggedIn = computed(() => userStore.isLoggedIn);

// 已完成区折叠状态
const showDone = ref(false);
// 已完成按分类分组的展开状态（默认全部折叠）
const doneOpenCats = ref<string[]>([]);
// 归档记录区域展开状态
const showArchived = ref(false);
// 待移出计划表的 todo（确认弹窗）
const todoToRemove = ref<{ id: number; taskContent: string } | null>(null);
// 归档确认弹窗
const showArchiveConfirm = ref(false);
// 待办是否全部为空（未登录时也视为空，不展示本地数据；加载失败不算空）
const todoIsEmpty = computed(
  () => !isLoggedIn.value || (!todoStore.loadError && todoStore.list.length === 0)
);
// 未登录时计数显示 0
const pendingCount = computed(() =>
  isLoggedIn.value ? todoStore.pendingCount : 0
);
const doneCount = computed(() =>
  isLoggedIn.value ? todoStore.doneList.length : 0
);

// 纠结分类中文名映射
const categoryLabel: Record<string, string> = {
  work: "工作",
  study: "学习",
  life: "生活",
  shopping: "购物",
  health: "健康",
  social: "社交",
  other: "其他",
};

onMounted(() => {
  // 登录后拉真实数据；未登录清空，不注入 mock
  if (isLoggedIn.value) {
    store.loadSessions();
    todoStore.loadTodos();
    todoStore.loadArchived();
  } else {
    store.resetSessions();
    todoStore.resetTodos();
  }
});

const cards = computed(() => store.cardList);

// 历史会话按分类分组成"抽屉"：每组可折叠，像文件夹收纳文件
// 固定分类顺序，只渲染有会话的组；默认展开最新会话所在的组
const CATEGORY_ORDER = ["work", "study", "life", "shopping", "health", "social", "other"];
const openCats = ref<string[]>([]);
const groupedCards = computed(() => {
  const map = new Map<string, typeof cards.value>();
  for (const c of cards.value) {
    const arr = map.get(c.category) ?? [];
    arr.push(c);
    map.set(c.category, arr);
  }
  return CATEGORY_ORDER.filter((k) => map.has(k)).map((k) => ({
    key: k,
    label: categoryLabel[k],
    list: map.get(k)!,
  }));
});
function toggleCat(key: string) {
  openCats.value = openCats.value.includes(key)
    ? openCats.value.filter((k) => k !== key)
    : [...openCats.value, key];
}
// 刷新/进入页面时所有抽屉默认折叠（openCats 初始为空），用户点击组头才展开

// 已完成待办按分类分组
const groupedDoneList = computed(() => {
  const map = new Map<string, typeof todoStore.doneList>();
  for (const t of todoStore.doneList) {
    const arr = map.get(t.category) ?? [];
    arr.push(t);
    map.set(t.category, arr);
  }
  return CATEGORY_ORDER.filter((k) => map.has(k)).map((k) => ({
    key: k,
    label: categoryLabel[k],
    list: map.get(k)!,
  }));
});
function toggleDoneCat(key: string) {
  doneOpenCats.value = doneOpenCats.value.includes(key)
    ? doneOpenCats.value.filter((k) => k !== key)
    : [...doneOpenCats.value, key];
}

// 归档记录
const archivedCount = computed(() => todoStore.archivedList.length);

function askRemoveTodo(todo: { id: number; taskContent: string }) {
  todoToRemove.value = todo;
}
function confirmRemoveTodo() {
  if (!todoToRemove.value) return;
  todoStore.removeTodo(todoToRemove.value.id);
  todoToRemove.value = null;
}
function askArchiveDone() {
  showArchiveConfirm.value = true;
}
function confirmArchiveDone() {
  todoStore.clearDone();
  showArchiveConfirm.value = false;
}
// 会话加载失败（已登录但网络/后端故障），用于显示「重试」而非空状态
const sessionLoadFailed = computed(() => isLoggedIn.value && store.loadError && cards.value.length === 0);
const isEmpty = computed(
  () => !sessionLoadFailed.value && !store.loading && cards.value.length === 0
);
function retryLoad() {
  store.loadSessions();
  todoStore.loadTodos();
}

// 批量管理模式
const selectMode = ref(false);
const deleting = ref(false);
const selectedIds = ref<number[]>([]);
const selectedCount = computed(() => selectedIds.value.length);
const allSelected = computed(
  () => cards.value.length > 0 && selectedIds.value.length === cards.value.length,
);
function isSelected(id: number): boolean {
  return selectedIds.value.includes(id);
}
function enterSelect() {
  if (!requireLogin() || cards.value.length === 0) return;
  selectMode.value = true;
}
function exitSelect() {
  selectMode.value = false;
  selectedIds.value = [];
}
function toggleSelect(id: number) {
  if (isSelected(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
  } else {
    selectedIds.value = [...selectedIds.value, id];
  }
}
function toggleSelectAll() {
  selectedIds.value = allSelected.value
    ? []
    : cards.value.map((c) => c.sessionId);
}
async function batchDelete() {
  if (deleting.value || !selectedIds.value.length) return;
  confirmOpen.value = true;
}

// 批量删除确认弹窗
const confirmOpen = ref(false);
async function doBatchDelete() {
  if (deleting.value || !selectedIds.value.length) return;
  deleting.value = true;
  try {
    await store.batchDeleteSessions([...selectedIds.value]);
    // 关联待办可能已被后端清理，同步计划表
    if (isLoggedIn.value) await todoStore.loadTodos();
    confirmOpen.value = false;
    exitSelect();
  } catch (e) {
    confirmOpen.value = false;
    window.alert((e as Error).message || "删除失败，请稍后再试");
  } finally {
    deleting.value = false;
  }
}
// 卡片点击：管理模式下勾选，否则进入详情
function onCardClick(id: number) {
  if (selectMode.value) toggleSelect(id);
  else goSession(id);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 访客点击任意功能：跳登录并带回跳地址，登录页提示“请先登录”
function requireLogin(): boolean {
  if (isLoggedIn.value) return true;
  router.push({ name: "login", query: { redirect: route.fullPath } });
  return false;
}

function goCreate() {
  if (requireLogin()) router.push("/task-create");
}
function goStats() {
  if (requireLogin()) router.push("/stats");
}
function goSession(id: number) {
  if (requireLogin()) router.push(`/session/${id}`);
}
function goLogin() {
  router.push({ name: "login", query: { redirect: route.fullPath } });
}
</script>

<template>
  <PageWrapper full title="JUST DO IT" subtitle="试一下呢">
    <!-- 波点装饰簇（PageWrapper 父容器自带 relative） -->
    <DecorDotCluster
      :count="28"
      :spread="110"
      :safe-inset="100"
      :hollow-ratio="0.3"
    />

    <!-- 顶部：装饰时钟 + 主行动按钮 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 md:mb-16">
      <div class="flex justify-center md:justify-start order-2 md:order-1">
        <SketchClock :score="cards[0]?.agentSuggestIndex ?? 0" :size="250" />
      </div>
      <div class="md:col-span-2 flex flex-col justify-center order-1 md:order-2">
        <DualTextBlock
          cn="还在为什么事情纠结？那试试JUST DO IT吧！"
          en="Every decision starts with a single line."
          size="lg"
        />
        <div class="mt-6 flex flex-wrap gap-3">
          <LinearButton size="lg" @click="goCreate">
            <span>+&nbsp;新的纠结</span>
          </LinearButton>
          <LinearButton size="lg" @click="goStats">
            <span>查看统计</span>
          </LinearButton>
        </div>
      </div>
    </div>

    <!-- To Do List 计划表 -->
    <section class="mb-12">
      <div class="flex items-end justify-between mb-6 pb-3 sketch-border-b">
        <DualTextBlock cn="我的计划表" en="TO DO LIST" size="md" weight="normal" />
        <span class="text-xs text-sketch-lineSub font-en tracking-widest">
          {{ pendingCount }} PENDING · {{ doneCount }} DONE
        </span>
      </div>

      <!-- 全空状态 -->
      <div v-if="todoIsEmpty" class="flex flex-col items-center justify-center py-10 text-center text-sm text-sketch-lineSub font-light">
        <SketchCheckbox :size="32" decorative />
        <p class="mt-3">{{ isLoggedIn ? "还没有待办事项，去结果页加入计划吧～" : "登录后查看你的计划表" }}</p>
        <LinearButton v-if="!isLoggedIn" size="md" class="mt-4" @click="goLogin">
          <span>去登录</span>
        </LinearButton>
      </div>

      <!-- 加载失败：给重试入口，不误显示成「没有待办」 -->
      <div v-else-if="isLoggedIn && todoStore.loadError" class="py-6 text-center">
        <p class="text-sm font-light text-sketch-lineSub">计划拉取失败，可能是网络抖动。</p>
        <LinearButton size="sm" class="mt-3" @click="todoStore.loadTodos()">重新加载</LinearButton>
      </div>

      <template v-else>
        <!-- 未完成（优先展示） -->
        <div v-if="todoStore.pendingList.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SketchBorder
            v-for="todo in todoStore.pendingList"
            :key="todo.id"
            padding="1.25rem"
            class="h-full"
          >
            <div class="flex items-start gap-3">
              <!-- 勾选框：点击标记完成 -->
              <SketchCheckbox
                :size="20"
                :model-value="false"
                class="mt-0.5 shrink-0"
                @update:model-value="todoStore.toggleDone(todo.id)"
              />
              <!-- 内容 -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-light leading-snug">
                  {{ todo.taskContent }}
                </p>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <SketchChip tag>
                    {{ categoryLabel[todo.category] || todo.category }}
                  </SketchChip>
                  <span v-if="todo.deadline" class="text-[10px] text-sketch-lineSub font-en tracking-wide">
                    📅 {{ todo.deadline.slice(0, 10) }}
                  </span>
                </div>
              </div>
              <!-- 移出计划表 -->
              <button
                class="text-sketch-lineSub hover:text-sketch-line text-sm shrink-0"
                @click="askRemoveTodo(todo)"
                aria-label="移出计划表"
              >
                ✕
              </button>
            </div>
          </SketchBorder>
        </div>

        <!-- 已完成折叠区（按分类分组成抽屉） -->
        <div v-if="todoStore.doneList.length" class="mt-6">
          <div class="flex items-center justify-between">
            <button
              class="flex items-center gap-2 text-xs text-sketch-lineSub hover:text-sketch-line"
              @click="showDone = !showDone"
            >
              <span class="inline-block transition-transform duration-300" :style="{ transform: showDone ? 'rotate(90deg)' : 'rotate(0deg)' }">▶</span>
              <span>已完成 {{ todoStore.doneList.length }} 项</span>
            </button>
            <button
              class="text-[11px] text-sketch-lineSub hover:text-sketch-line"
              @click="askArchiveDone"
            >
              归档已完成
            </button>
          </div>

          <div v-show="showDone" class="mt-4 space-y-4">
            <div v-for="g in groupedDoneList" :key="g.key">
              <!-- 分类抽屉头 -->
              <button
                type="button"
                class="flex w-full items-center justify-between pb-1 text-left"
                :aria-expanded="doneOpenCats.includes(g.key)"
                @click="toggleDoneCat(g.key)"
              >
                <span class="flex items-center gap-2">
                  <span
                    class="inline-block transition-transform duration-300 text-sketch-lineSub text-xs"
                    :style="{ transform: doneOpenCats.includes(g.key) ? 'rotate(90deg)' : 'rotate(0deg)' }"
                  >▶</span>
                  <span class="text-xs font-light text-sketch-lineSub">{{ g.label }}</span>
                </span>
                <span class="text-[10px] text-sketch-lineSub font-en tracking-widest">{{ g.list.length }}</span>
              </button>

              <!-- 该分类下的已完成待办 -->
              <div v-show="doneOpenCats.includes(g.key)" class="mt-2 space-y-2">
                <div
                  v-for="todo in g.list"
                  :key="todo.id"
                  class="flex items-center gap-3 px-3 py-2 opacity-60"
                >
                  <SketchCheckbox
                    :size="18"
                    :model-value="true"
                    class="shrink-0"
                    @update:model-value="todoStore.toggleDone(todo.id)"
                  />
                  <p class="flex-1 min-w-0 text-sm font-light line-through truncate">
                    {{ todo.taskContent }}
                  </p>
                  <SketchChip tag>
                    {{ categoryLabel[todo.category] || todo.category }}
                  </SketchChip>
                  <button
                    class="text-sketch-lineSub hover:text-sketch-line text-xs shrink-0"
                    @click="askRemoveTodo(todo)"
                    aria-label="移出计划表"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 归档记录入口 -->
        <div v-if="archivedCount" class="mt-4">
          <button
            class="flex items-center gap-2 text-xs text-sketch-lineSub hover:text-sketch-line"
            @click="showArchived = !showArchived"
          >
            <span class="inline-block transition-transform duration-300" :style="{ transform: showArchived ? 'rotate(90deg)' : 'rotate(0deg)' }">▶</span>
            <span>归档记录 {{ archivedCount }} 项</span>
          </button>

          <div v-show="showArchived" class="mt-3 space-y-2 opacity-50">
            <div
              v-for="todo in todoStore.archivedList"
              :key="todo.id"
              class="flex items-center gap-3 px-3 py-2"
            >
              <p class="flex-1 min-w-0 text-sm font-light line-through truncate">
                {{ todo.taskContent }}
              </p>
              <SketchChip tag>
                {{ categoryLabel[todo.category] || todo.category }}
              </SketchChip>
            </div>
          </div>
        </div>
      </template>
    </section>

    <!-- 历史会话卡片列表 -->
    <section>
      <div class="flex flex-wrap items-end justify-between gap-3 mb-6 sketch-border-b pb-3">
        <DualTextBlock cn="历史会话" en="RECENT SESSIONS" size="md" weight="normal" />
        <!-- 普通模式：数量 + 批量管理入口 -->
        <div v-if="!selectMode" class="flex items-center gap-4">
          <span class="text-xs text-sketch-lineSub font-en tracking-widest">
            {{ cards.length }} ITEMS
          </span>
          <button
            v-if="isLoggedIn && !isEmpty && !sessionLoadFailed"
            class="text-xs text-sketch-lineSub hover:text-sketch-line whitespace-nowrap opacity-70 hover:opacity-100 transition-opacity"
            @click="enterSelect"
          >
            批量管理
          </button>
        </div>
        <!-- 管理模式：全选 / 删除选中 / 取消 -->
        <div v-else class="flex flex-wrap items-center gap-3 text-xs">
          <button
            class="text-sketch-lineSub hover:text-sketch-line whitespace-nowrap"
            @click="toggleSelectAll"
          >
            {{ allSelected ? "取消全选" : "全选" }}
          </button>
          <button
            class="border border-sketch-line/50 px-2.5 py-1 whitespace-nowrap transition-opacity"
            :class="selectedCount === 0 || deleting ? 'opacity-40 pointer-events-none' : 'hover:bg-sketch-hover'"
            @click="batchDelete"
          >
            {{ deleting ? "删除中…" : `删除选中（${selectedCount}）` }}
          </button>
          <button
            class="text-sketch-lineSub hover:text-sketch-line whitespace-nowrap"
            :class="{ 'pointer-events-none opacity-40': deleting }"
            @click="exitSelect"
          >
            取消
          </button>
        </div>
      </div>

      <!-- 加载失败：网络/后端暂时不可用，给重试入口 -->
      <div v-if="sessionLoadFailed" class="flex flex-col items-center justify-center py-20 text-center">
        <SketchBorder padding="2.5rem 3rem" class="max-w-sm">
          <DualTextBlock
            cn="网络开小差了，记录暂时没拉下来"
            en="FAILED TO LOAD. GIVE IT ANOTHER TRY."
            size="md"
          />
          <div class="mt-6">
            <LinearButton size="md" @click="retryLoad">重新加载</LinearButton>
          </div>
        </SketchBorder>
      </div>

      <!-- 真空状态 -->
      <div v-else-if="isEmpty" class="flex flex-col items-center justify-center py-20 text-center">
        <SketchBorder padding="2.5rem 3rem" class="max-w-sm">
          <SketchClock :score="0" :size="150" :animated="false" />
          <DualTextBlock
            :cn="isLoggedIn ? '还没有任何决策记录' : '登录后查看你的决策记录'"
            :en="isLoggedIn ? 'No sessions yet. Start your first decision.' : 'LOGIN TO VIEW YOUR SESSIONS.'"
            size="md"
          />
          <div class="mt-6">
            <LinearButton v-if="isLoggedIn" size="md" @click="goCreate">开始第一次决策</LinearButton>
            <LinearButton v-else size="md" @click="goLogin">去登录</LinearButton>
          </div>
        </SketchBorder>
      </div>

      <!-- 分类抽屉：每组可折叠，默认展开最新会话所在分类 -->
      <div v-else class="space-y-6">
        <div v-for="g in groupedCards" :key="g.key">
          <!-- 抽屉头：分类名 + 数量 + 折叠箭头 -->
          <button
            type="button"
            class="flex w-full items-center justify-between pb-2 sketch-border-b text-left"
            :aria-expanded="openCats.includes(g.key)"
            @click="toggleCat(g.key)"
          >
            <span class="flex items-center gap-2">
              <span
                class="inline-block transition-transform duration-300 text-sketch-lineSub"
                :style="{ transform: openCats.includes(g.key) ? 'rotate(90deg)' : 'rotate(0deg)' }"
              >▶</span>
              <span class="text-sm font-light">{{ g.label }}</span>
            </span>
            <span class="text-xs text-sketch-lineSub font-en tracking-widest">
              {{ g.list.length }} ITEMS
            </span>
          </button>

          <!-- 抽屉内容：该分类下的卡片网格 -->
          <div
            v-show="openCats.includes(g.key)"
            class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            <component
              :is="selectMode ? 'div' : 'button'"
              v-for="card in g.list"
              :key="card.sessionId"
              class="group relative min-h-[210px] block w-full text-left cursor-pointer transition-colors duration-200 hover:bg-sketch-hover"
              :class="{ 'bg-sketch-hover': selectMode && isSelected(card.sessionId) }"
              :aria-pressed="selectMode ? isSelected(card.sessionId) : undefined"
              @click="onCardClick(card.sessionId)"
            >
          <SketchBorder padding="1.75rem" class="h-full">
            <div class="flex items-start justify-between gap-3">
              <!-- 管理模式勾选框（不单独绑事件，点击冒泡给整卡统一处理，避免双重切换） -->
              <SketchCheckbox
                v-if="selectMode"
                :size="18"
                :model-value="isSelected(card.sessionId)"
                class="mt-0.5 shrink-0"
              />
              <p
                class="text-base font-light leading-snug line-clamp-2"
                :class="selectMode ? 'flex-1' : ''"
              >
                {{ card.taskContent }}
              </p>
              <!-- 行动指数：右上角，删除按钮在右下角不冲突 -->
              <span
                class="shrink-0 text-2xl font-light font-en"
                :class="card.agentSuggestIndex >= 50 ? 'opacity-100' : 'opacity-60'"
              >
                {{ card.agentSuggestIndex }}
              </span>
            </div>
            <p class="mt-2 text-xs text-sketch-lineSub font-en tracking-wide">
              {{ card.conclusion }}
            </p>
<div class="mt-4 flex items-start justify-between sketch-border-t pt-3 gap-2">
  <span class="text-[10px] text-sketch-lineSub font-en tracking-widest">
    {{ card.persuadeMode.toUpperCase() }}
  </span>
  <!-- 右侧垂直排列：时间在上，已反馈在下 -->
  <div class="flex flex-col items-end gap-1">
    <span class="text-[10px] text-sketch-lineSub font-en tracking-widest">
      {{ formatDate(card.createdAt) }}
    </span>
    <span
      v-if="card.hasFeedback"
      class="text-[10px] border border-sketch-line px-1.5 py-0.5 bg-sketch-bg"
    >
      已反馈
    </span>
  </div>
</div>
          </SketchBorder>
            </component>
          </div>
        </div>
      </div>
    </section>

    <!-- 批量删除确认：手绘风弹窗 -->
    <SketchConfirmDialog
      :open="confirmOpen"
      title="批量删除决策记录"
      en-title="DELETE RECORDS"
      :message="`确定删除选中的 ${selectedIds.length} 条决策记录吗？任务输入、Agent 建议、反馈以及由它们加入计划表的待办将一并删除，且不可恢复。`"
      confirm-text="确认删除"
      :loading="deleting"
      @confirm="doBatchDelete"
      @cancel="confirmOpen = false"
    />

    <!-- 移出计划表确认 -->
    <SketchConfirmDialog
      :open="!!todoToRemove"
      title="移出计划表"
      en-title="REMOVE FROM PLAN"
      :message="`确定将「${todoToRemove?.taskContent}」移出计划表吗？该待办将被删除，但关联的历史会话不受影响。如需重新加入，可在历史会话中找到对应会话，进入详情页重新加入计划表。`"
      confirm-text="移出计划表"
      @confirm="confirmRemoveTodo"
      @cancel="todoToRemove = null"
    />

    <!-- 归档已完成确认 -->
    <SketchConfirmDialog
      :open="showArchiveConfirm"
      title="归档已完成"
      en-title="ARCHIVE DONE"
      :message="`确定归档全部 ${todoStore.doneList.length} 条已完成待办吗？归档后它们将从计划表隐藏，但数据保留在「归档记录」中，随时可查看。`"
      confirm-text="归档"
      @confirm="confirmArchiveDone"
      @cancel="showArchiveConfirm = false"
    />
  </PageWrapper>
</template>
