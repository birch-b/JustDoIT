<script setup lang="ts">
// 首页 / 仪表盘：历史会话卡片列表 + 新的一次纠结 + 装饰时钟
import { onMounted, computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAgentStore } from "@/store/agentStore";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchClock from "@/components/sketch/SketchClock.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import SketchCheckbox from "@/components/sketch/SketchCheckbox.vue";
import SketchChip from "@/components/sketch/SketchChip.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import DecorDotCluster from "@/components/sketch/DecorDotCluster.vue";
import { useTodoStore } from "@/store/todoStore";

const router = useRouter();
const store = useAgentStore();
const todoStore = useTodoStore();

// 已完成区折叠状态
const showDone = ref(false);
// 待办是否全部为空
const todoIsEmpty = computed(() => todoStore.list.length === 0);

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
  store.seedDemoData();
});

const cards = computed(() => store.cardList);
const isEmpty = computed(() => cards.value.length === 0);

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function goCreate() {
  router.push("/task-create");
}
function goSession(id: number) {
  router.push(`/session/${id}`);
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
        <SketchClock :score="isEmpty ? 0 : cards[0].agentSuggestIndex" :size="250" />
      </div>
      <div class="md:col-span-2 flex flex-col justify-center order-1 md:order-2">
        <DualTextBlock
          cn="下一次决策，从一个细线方框开始。"
          en="Every decision starts with a single line."
          size="lg"
        />
        <div class="mt-6 flex flex-wrap gap-3">
          <LinearButton size="lg" @click="goCreate">
            <span>+&nbsp;新的纠结</span>
          </LinearButton>
          <LinearButton size="lg" @click="router.push('/stats')">
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
          {{ todoStore.pendingCount }} PENDING · {{ todoStore.doneList.length }} DONE
        </span>
      </div>

      <!-- 全空状态 -->
      <div v-if="todoIsEmpty" class="flex flex-col items-center justify-center py-10 text-center text-sm text-sketch-lineSub font-light">
        <SketchCheckbox :size="32" decorative />
        <p class="mt-3">还没有待办事项，去结果页加入计划吧～</p>
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
              <!-- 删除 -->
              <button
                class="text-sketch-lineSub hover:text-sketch-line text-sm shrink-0"
                @click="todoStore.removeTodo(todo.id)"
                aria-label="删除"
              >
                ✕
              </button>
            </div>
          </SketchBorder>
        </div>

        <!-- 已完成折叠区 -->
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
              @click="todoStore.clearDone()"
            >
              一键清除
            </button>
          </div>

          <div v-show="showDone" class="mt-3 space-y-2">
            <div
              v-for="todo in todoStore.doneList"
              :key="todo.id"
              class="flex items-center gap-3 px-3 py-2 opacity-60"
            >
              <!-- 勾选框：显示对勾，点击取消完成 -->
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
                @click="todoStore.removeTodo(todo.id)"
                aria-label="删除"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </template>
    </section>

    <!-- 历史会话卡片列表 -->
    <section>
      <div class="flex items-end justify-between mb-6 sketch-border-b pb-3">
        <DualTextBlock cn="历史会话" en="RECENT SESSIONS" size="md" weight="normal" />
        <span class="text-xs text-sketch-lineSub font-en tracking-widest">
          {{ cards.length }} ITEMS
        </span>
      </div>

      <!-- 空状态 -->
      <div v-if="isEmpty" class="flex flex-col items-center justify-center py-20 text-center">
        <SketchBorder padding="2.5rem 3rem" class="max-w-sm">
          <SketchClock :score="0" :size="150" :animated="false" />
          <DualTextBlock
            cn="还没有任何决策记录"
            en="No sessions yet. Start your first decision."
            size="md"
          />
          <div class="mt-6">
            <LinearButton size="md" @click="goCreate">开始第一次决策</LinearButton>
          </div>
        </SketchBorder>
      </div>

      <!-- 卡片网格 -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <button
          v-for="card in cards"
          :key="card.sessionId"
          class="group relative min-h-[210px] text-left transition-colors duration-200 hover:bg-sketch-hover"
          @click="goSession(card.sessionId)"
        >
          <SketchBorder padding="1.75rem" class="h-full">
            <div class="flex items-start justify-between gap-3">
              <p class="text-base font-light leading-snug line-clamp-2">
                {{ card.taskContent }}
              </p>
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
        </button>
      </div>
    </section>
  </PageWrapper>
</template>
