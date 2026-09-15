<script setup lang="ts">
// 会话统一页 /session/:id【核心页面】
// Agent 结果 + 历史详情合并：时钟/建议/任务输入/历史摘要/真实反馈/删除 全部在同一页
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAgentStore } from "@/store/agentStore";
import { useTodoStore } from "@/store/todoStore";
import { useUserStore } from "@/store/userStore";
import type { AgentSessionRes, TaskCreateReq } from "@/types";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchClock from "@/components/sketch/SketchClock.vue";
import SketchCheckbox from "@/components/sketch/SketchCheckbox.vue";
import DecorDotCluster from "@/components/sketch/DecorDotCluster.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";

interface Props {
  id: string | string[];
}
const props = defineProps<Props>();
const router = useRouter();
const store = useAgentStore();
const todoStore = useTodoStore();
const userStore = useUserStore();

const sessionId = computed(() => Number(props.id));
const session = ref<AgentSessionRes | undefined>(undefined);
const task = ref<TaskCreateReq | undefined>(undefined);
const createdAt = ref("");
const notFound = ref(false);

// 反馈：只表达态度——接受 / 拒绝；完成与否由计划表追踪
type FeedbackChoice = "accept" | "reject";
const submitted = ref(false);
const accepted = ref(false);
const submitting = ref(false);
const reAdding = ref(false);

const choiceMeta: Record<FeedbackChoice, { cn: string; symbol: string; accept: boolean }> = {
  accept: { cn: "我接受", symbol: "✓", accept: true },
  reject: { cn: "我拒绝", symbol: "✕", accept: false },
};

// 删除记录
const deleting = ref(false);

// 该会话对应的待办是否还在计划表中（可能被用户从计划表删掉）
const linkedTodo = computed(() =>
  todoStore.list.find((t) => t.sessionId === sessionId.value)
);
const inTodoList = computed(() => !!linkedTodo.value);

const record = computed(() => store.getSessionWithTask(sessionId.value)?.record ?? null);

onMounted(async () => {
  if (userStore.isLoggedIn && !todoStore.loaded) await todoStore.loadTodos();
  const detail = await store.fetchHistory(sessionId.value);
  if (detail) {
    session.value = detail.session;
    task.value = detail.task;
    createdAt.value = detail.createdAt;
    if (detail.record) {
      submitted.value = true;
      accepted.value = detail.record.userAcceptSuggest;
    }
  } else {
    notFound.value = true;
  }
});

// 时钟四周装饰：手绘方框（波点由 DecorDotCluster 统一渲染）
interface RingDeco {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  rotate?: number;
  size: number;
}
const ringDeco: RingDeco[] = [
  { top: "-6%", left: "8%", rotate: -12, size: 24 },
  { bottom: "2%", right: "10%", rotate: -8, size: 26 },
];

// 提交反馈：接受则自动加入计划表（是否完成之后在计划表勾选）
async function submitFeedback(c: FeedbackChoice) {
  if (submitted.value || submitting.value || !session.value) return;
  const meta = choiceMeta[c];
  submitting.value = true;
  try {
    await store.submitRecord({
      sessionId: session.value.sessionId,
      userAcceptSuggest: meta.accept,
      isExecute: false,
      actualCostMin: 0,
      executeResult: "",
    });
    if (meta.accept) {
      await addIntoTodoList();
      accepted.value = true;
    }
    submitted.value = true;
  } finally {
    submitting.value = false;
  }
}

// 加入 / 重新加入计划表；重新加入时把执行状态重置为未执行（新一轮追踪）
async function addIntoTodoList(resetExecute = false) {
  if (!session.value || !task.value || inTodoList.value) return;
  await todoStore.addTodo({
    taskContent: task.value.taskContent,
    category: task.value.category || "other",
    deadline: task.value.deadline || null,
    sessionId: session.value.sessionId,
  });
  if (resetExecute) {
    await store.submitRecord({
      sessionId: session.value.sessionId,
      userAcceptSuggest: true,
      isExecute: false,
      actualCostMin: 0,
      executeResult: "",
    });
  }
}

async function reAddTodo() {
  if (reAdding.value) return;
  reAdding.value = true;
  try {
    await addIntoTodoList(true);
  } finally {
    reAdding.value = false;
  }
}

async function deleteRecord() {
  if (deleting.value || !session.value) return;
  if (!window.confirm("确定删除这条决策记录吗？任务输入、Agent 建议、反馈以及由它加入计划表的待办将一并删除，且不可恢复。"))
    return;
  deleting.value = true;
  try {
    await store.deleteSession(session.value.sessionId);
    await todoStore.loadTodos();
    router.push("/");
  } catch (e) {
    window.alert((e as Error).message || "删除失败，请稍后再试");
    deleting.value = false;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const categoryLabel: Record<string, string> = {
  work: "工作",
  study: "学习",
  life: "生活",
  shopping: "购物",
  health: "健康",
  social: "社交",
  other: "其他",
};
</script>

<template>
  <PageWrapper full>
    <!-- 波点装饰簇（PageWrapper 父容器自带 relative） -->
    <DecorDotCluster
      :count="26"
      :spread="110"
      :safe-inset="50"
      :hollow-ratio="0.3"
    />

    <!-- 未找到 -->
    <div v-if="notFound" class="flex flex-col items-center justify-center flex-1 text-center">
      <SketchClock :score="0" :size="160" :animated="false" />
      <DualTextBlock
        class="mt-6"
        cn="未找到该会话"
        en="SESSION NOT FOUND"
        size="lg"
      />
      <LinearButton class="mt-6" size="lg" @click="router.push('/')">返回首页</LinearButton>
    </div>

    <div v-else-if="session" class="flex-1 flex flex-col">
      <!-- 顶部小标题 -->
      <div class="mb-8 flex items-center justify-between gap-4 sketch-border-b pb-3">
        <DualTextBlock cn="Agent 结果" en="AGENT RESULT" size="md" weight="normal" />
        <div class="flex items-center gap-5 shrink-0">
          <span class="text-xs text-sketch-lineSub font-en tracking-widest">
            SESSION #{{ session.sessionId }}<template v-if="createdAt"> · {{ formatDate(createdAt) }}</template>
          </span>
          <span
            role="button"
            aria-label="删除记录"
            title="删除这条记录"
            class="group flex flex-col items-center text-base font-light opacity-60 hover:opacity-100 transition-opacity whitespace-nowrap"
            :class="{ 'pointer-events-none opacity-40': deleting }"
            @click="deleteRecord"
          >
            {{ deleting ? "删除中…" : "删除记录" }}
            <span
              class="mt-1 h-px bg-sketch-accent transition-all duration-300"
              :class="deleting ? 'w-0' : 'w-0 group-hover:w-4'"
            />
          </span>
        </div>
      </div>

      <!-- 主体：左时钟 + 右文案 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16 flex-1">
        <!-- 左：时钟 -->
        <div class="relative flex items-start justify-center lg:justify-start">
          <div class="relative">
            <SketchClock :score="session.agentSuggestIndex" :size="320" />
            <div
              v-for="(b, i) in ringDeco"
              :key="i"
              class="absolute pointer-events-none"
              :style="{ top: b.top, left: b.left, right: b.right, bottom: b.bottom }"
            >
              <SketchCheckbox :size="b.size" :rotate="b.rotate" decorative />
            </div>
            <div class="mt-4 flex items-center justify-center gap-2">
              <SketchCheckbox :size="16" decorative />
              <span class="text-xs font-en tracking-widest text-sketch-lineSub">
                ACTION INDEX · {{ session.agentSuggestIndex }}
              </span>
            </div>
          </div>
        </div>

        <!-- 右：完整内容 -->
        <div class="lg:col-span-2 flex flex-col gap-8">
          <!-- 结论 -->
          <SketchBorder padding="2rem">
            <DualTextBlock
              :cn="session.conclusion"
              :en="session.agentSuggestIndex >= 50 ? 'GO FOR IT NOW' : 'HOLD OFF TODAY'"
              size="xl"
              highlight
            />
            <div class="mt-4 flex items-center gap-3">
              <SketchCheckbox :size="18" decorative />
              <span class="text-xs font-en tracking-widest text-sketch-lineSub">
                {{ session.persuadeMode.toUpperCase() }}
              </span>
            </div>
            <p class="mt-4 text-sm font-light leading-relaxed">
              {{ session.persuadeText }}
            </p>

            <!-- 答案之书 -->
            <div v-if="session.answerBook" class="mt-5 sketch-border-l pl-3">
              <DualTextBlock cn="答案之书" en="ANSWER BOOK" size="sm" weight="normal" />
              <p class="mt-1 text-sm font-light">「{{ session.answerBook }}」</p>
            </div>

            <!-- 塔罗牌 · 单张 -->
            <div v-if="session.tarotCards?.length" class="mt-5">
              <DualTextBlock cn="塔罗牌" en="TAROT" size="sm" weight="normal" />
              <div class="mt-2 border border-sketch-line/60 px-4 py-5 text-center">
                <p class="text-lg font-light tracking-wide">{{ session.tarotCards[0] }}</p>
              </div>
            </div>
          </SketchBorder>

          <!-- 当时任务输入 -->
          <div v-if="task">
            <DualTextBlock cn="当时任务输入" en="ORIGINAL TASK INPUT" size="sm" weight="normal" />
            <div class="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-light">
              <div>
                <p class="text-[10px] text-sketch-lineSub font-en tracking-widest">CONTENT</p>
                <p class="mt-1">{{ task.taskContent }}</p>
              </div>
              <div>
                <p class="text-[10px] text-sketch-lineSub font-en tracking-widest">WILL / ENERGY / IMPORTANCE</p>
                <p class="mt-1">{{ task.willScore }} / {{ task.energyScore }} / {{ task.importance }}</p>
              </div>
              <div>
                <p class="text-[10px] text-sketch-lineSub font-en tracking-widest">EXPECT COST</p>
                <p class="mt-1">{{ task.expectCostMin ? `${task.expectCostMin} min` : "—" }}</p>
              </div>
              <div>
                <p class="text-[10px] text-sketch-lineSub font-en tracking-widest">CATEGORY / DEADLINE</p>
                <p class="mt-1">
                  {{ categoryLabel[task.category] || task.category }}<template v-if="task.deadline"> · {{ task.deadline }}</template>
                </p>
              </div>
            </div>
          </div>

          <!-- 最小行动 -->
          <div>
            <DualTextBlock cn="最小行动" en="MINIMAL ACTION" size="sm" weight="normal" />
            <p class="mt-2 text-base font-light leading-relaxed">
              {{ session.minAction }}
            </p>
          </div>

          <!-- 历史真实行为摘要 -->
          <div class="sketch-border-l">
            <DualTextBlock cn="历史真实行为摘要" en="HISTORY SUMMARY" size="sm" weight="normal" />
            <p class="mt-2 text-sm font-light text-sketch-lineSub leading-relaxed">
              {{ session.historySummary }}
            </p>
          </div>

          <!-- 用户真实反馈 / 决策区 -->
          <SketchBorder padding="2rem">
            <DualTextBlock cn="你的决定与反馈" en="YOUR DECISION & FEEDBACK" size="md" weight="normal" />

            <!-- 未反馈：做决定 -->
            <div v-if="!submitted" class="mt-4 flex flex-wrap gap-3">
              <LinearButton
                v-for="(meta, key) in choiceMeta"
                :key="key"
                size="md"
                :disabled="submitting"
                @click="submitFeedback(key as FeedbackChoice)"
              >
                <span class="mr-1">{{ meta.symbol }}</span>
                <span>{{ meta.cn }}</span>
              </LinearButton>
            </div>

            <!-- 已反馈：回显真实状态 -->
            <div v-else class="mt-4 space-y-4">
              <div class="flex flex-wrap gap-3">
                <span class="border border-sketch-line/40 px-2 py-1 text-xs">
                  {{ accepted ? "接受建议" : "拒绝建议" }}
                </span>
                <span v-if="record" class="border border-sketch-line/40 px-2 py-1 text-xs">
                  {{ record.isExecute ? "已执行" : "未执行" }}
                </span>
                <span v-if="record?.actualCostMin" class="border border-sketch-line/40 px-2 py-1 text-xs">
                  实际耗时 {{ record.actualCostMin }} min
                </span>
                <span v-if="record?.createdAt" class="text-[10px] text-sketch-lineSub font-en tracking-widest self-center">
                  {{ formatDate(record.createdAt) }}
                </span>
              </div>
              <p v-if="record?.executeResult" class="text-sm text-sketch-lineSub font-light">
                {{ record.executeResult }}
              </p>

              <!-- 计划状态 -->
              <div v-if="accepted" class="pt-3 sketch-border-t flex flex-wrap items-center gap-3">
                <template v-if="inTodoList">
                  <!-- 静态状态方框：done 显示对勾 -->
                  <svg width="18" height="18" viewBox="0 0 40 40" class="shrink-0">
                    <rect x="3" y="3" width="34" height="34" class="sketch-stroke" stroke-width="2.1" />
                    <path
                      v-if="linkedTodo?.done"
                      class="sketch-stroke"
                      stroke-width="2.4"
                      d="M11,21 L18,28 L30,14"
                    />
                  </svg>
                  <span class="text-sm font-light">
                    {{ linkedTodo?.done ? "该待办已完成。" : "已加入计划表，去首页勾选完成吧。" }}
                  </span>
                </template>
                <template v-else>
                  <span class="text-sm font-light text-sketch-lineSub">
                    对应的待办已从计划表移除。
                  </span>
                  <LinearButton size="sm" :disabled="reAdding" @click="reAddTodo">
                    {{ reAdding ? "加入中…" : "重新加入计划表" }}
                  </LinearButton>
                </template>
              </div>
            </div>
          </SketchBorder>

          <!-- 底部导航 -->
          <div class="flex flex-wrap gap-3 pt-2">
            <LinearButton size="md" @click="router.push('/')">返回首页</LinearButton>
            <LinearButton size="md" @click="router.push('/stats')">查看统计</LinearButton>
            <LinearButton size="md" @click="router.push('/task-create')">新的一次纠结</LinearButton>
          </div>
        </div>
      </div>
    </div>
  </PageWrapper>
</template>
