<script setup lang="ts">
// 会话统一页 /session/:id【核心页面】
// Agent 结果 + 历史详情合并：时钟/建议/任务输入/真实反馈/删除 全部在同一页
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
import SketchConfirmDialog from "@/components/sketch/SketchConfirmDialog.vue";

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
// 可选评论：用户对建议想说的话，和 接受/拒绝 + 是否入计划表 一起打包触发 Agent 二次回复
const comment = ref("");
// 点了「我接受」之后、尚未选择是否入计划表的追问阶段（此时反馈还未提交）
const askAddTodo = ref(false);
const addingTodo = ref(false);
// Agent 二次回复（提交后优先用接口实时返回，历史回看用 record 里的持久化值）
const replyText = ref("");
// 行内错误提示：反馈区与删除区分开，样式与全站错误条一致
const feedbackError = ref("");
const deleteError = ref("");

const choiceMeta: Record<FeedbackChoice, { cn: string; symbol: string; accept: boolean }> = {
  accept: { cn: "我接受", symbol: "✓", accept: true },
  reject: { cn: "我拒绝", symbol: "✕", accept: false },
};

// 删除记录：手绘弹窗二次确认
const deleting = ref(false);
const confirmOpen = ref(false);

// 该会话对应的待办是否还在计划表中（可能被用户从计划表删掉）
const linkedTodo = computed(() =>
  todoStore.list.find((t) => t.sessionId === sessionId.value)
);
// 已归档的待办同样算「已加入」：归档代表这轮计划已完成收尾，
// 历史详情不应把它当成「未加入」而再次提供加入按钮（否则会重复入表）
const linkedArchivedTodo = computed(() =>
  todoStore.archivedItems.find((t) => t.sessionId === sessionId.value)
);
const inTodoList = computed(
  () => !!linkedTodo.value || !!linkedArchivedTodo.value
);

const record = computed(() => store.getSessionWithTask(sessionId.value)?.record ?? null);

// 待办不存在时的细分：做出决定时曾选「加入计划表」→ 待办后来被删（移出/删除归档）；
// addToTodo 为 false → 从未加入。旧数据无此字段按未加入处理。
const todoWasAdded = computed(() => record.value?.addToTodo === true);

onMounted(async () => {
  if (userStore.isLoggedIn) {
    if (!todoStore.loaded) await todoStore.loadTodos();
    // 归档记录也要拉：判断会话待办是否已归档（避免归档后误显示「未加入」）
    void todoStore.loadArchived();
  }
  const detail = await store.fetchHistory(sessionId.value);
  if (detail) {
    session.value = detail.session;
    task.value = detail.task;
    createdAt.value = detail.createdAt;
    if (detail.record) {
      submitted.value = true;
      accepted.value = detail.record.userAcceptSuggest;
      comment.value = detail.record.feedbackComment ?? "";
      replyText.value = detail.record.agentReply ?? "";
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

// 点「我接受」：先追问是否加入计划表（吃饭/出门这类即时决定可以不加入），反馈暂不提交
function submitFeedback(c: FeedbackChoice) {
  if (submitted.value || submitting.value || addingTodo.value || !session.value) return;
  if (c === "accept") {
    askAddTodo.value = true;
    return;
  }
  void doSubmit(false, false);
}

// 真正提交反馈：态度 + 是否入计划表 + 评论一次打包，后端二次调用 LLM 生成回应
async function doSubmit(acceptChoice: boolean, addToTodo: boolean) {
  if (!session.value || submitting.value) return;
  submitting.value = true;
  try {
    const saved = await store.submitRecord({
      sessionId: session.value.sessionId,
      userAcceptSuggest: acceptChoice,
      isExecute: false,
      actualCostMin: 0,
      executeResult: "",
      comment: comment.value.trim(),
      addToTodo,
      withReply: true,
    });
    // store 内部吞掉异常并返回 undefined：提交失败时停留原状态，允许重试
    if (!saved) {
      feedbackError.value = "反馈提交失败，请确认后端已启动后重试";
      return;
    }
    submitted.value = true;
    accepted.value = acceptChoice;
    askAddTodo.value = false;
    replyText.value = saved.agentReply ?? "";
  } finally {
    submitting.value = false;
  }
}

// 追问中点击「加入计划表」：先入表，再连同决定一起提交
async function confirmAddTodo() {
  if (addingTodo.value || !session.value) return;
  addingTodo.value = true;
  feedbackError.value = "";
  try {
    await addIntoTodoList(false);
    await doSubmit(true, true);
  } catch (e) {
    feedbackError.value = (e as Error).message || "加入计划表失败，请重试";
  } finally {
    addingTodo.value = false;
  }
}

// 追问中点击「不用了」：即时决定不入表，直接提交接受反馈（之后仍可在下方补加入）
function skipAddTodo() {
  if (addingTodo.value) return;
  void doSubmit(true, false);
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

// 点击「删除记录」：只打开确认弹窗
function deleteRecord() {
  if (deleting.value || !session.value) return;
  deleteError.value = "";
  confirmOpen.value = true;
}

// 弹窗确认后真正删除
async function confirmDelete() {
  if (deleting.value || !session.value) return;
  deleting.value = true;
  try {
    await store.deleteSession(session.value.sessionId);
    await todoStore.loadTodos();
    router.push("/");
  } catch (e) {
    confirmOpen.value = false;
    deleteError.value = (e as Error).message || "删除失败，请稍后再试";
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
      :count="40"
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

      <!-- 删除失败：行内错误条（样式与全站一致） -->
      <p v-if="deleteError" class="-mt-4 mb-6 text-xs text-sketch-line border border-sketch-line/40 px-3 py-2">
        {{ deleteError }}
      </p>

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
              <p v-if="session.answerBookReading" class="mt-1 text-sm font-light leading-relaxed text-sketch-lineSub">
                {{ session.answerBookReading }}
              </p>
            </div>

            <!-- 塔罗牌 · 单张 -->
            <div v-if="session.tarotCards?.length" class="mt-5">
              <DualTextBlock cn="塔罗牌" en="TAROT" size="sm" weight="normal" />
              <div class="mt-2 border border-sketch-line/60 px-4 py-5 text-center">
                <p class="text-lg font-light tracking-wide">{{ session.tarotCards[0] }}</p>
                <p v-if="session.tarotReading" class="mt-3 text-sm font-light leading-relaxed text-sketch-lineSub">
                  {{ session.tarotReading }}
                </p>
              </div>
            </div>

            <!-- 今日天气 + 打分（勾选天气加成时才有） -->
            <div v-if="task?.weatherText && task.weatherScore" class="mt-5 sketch-border-l pl-3">
              <DualTextBlock cn="今日天气" en="TODAY'S WEATHER" size="sm" weight="normal" />
              <p class="mt-1 text-sm font-light leading-relaxed">
                <template v-if="task.weatherCity">{{ task.weatherCity }} · </template>{{ task.weatherText }}
              </p>
              <p class="mt-1 text-sm font-light text-sketch-lineSub">
                当时给天气的打分：<span class="font-en">{{ task.weatherScore }}</span><span class="font-en">/10</span>
              </p>
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
            <!-- 补充条件（可选，未填写则不展示） -->
            <p v-if="task.extraContext" class="mt-3 text-sm font-light text-sketch-lineSub">
              补充条件：{{ task.extraContext }}
            </p>
          </div>

          <!-- 最小行动 -->
          <div>
            <DualTextBlock cn="最小行动" en="MINIMAL ACTION" size="sm" weight="normal" />
            <p class="mt-2 text-base font-light leading-relaxed">
              {{ session.minAction }}
            </p>
          </div>

          <!-- 用户真实反馈 / 决策区 -->
          <SketchBorder padding="2rem">
            <DualTextBlock cn="你的决定与反馈" en="YOUR DECISION & FEEDBACK" size="md" weight="normal" />

            <!-- 反馈提交/入表失败：行内错误条 -->
            <p v-if="feedbackError" class="mt-3 text-xs text-sketch-line border border-sketch-line/40 px-3 py-2">
              {{ feedbackError }}
            </p>

            <!-- 未反馈：可选评论 + 做决定（接受后先追问是否入计划表，再一起提交） -->
            <div v-if="!submitted" class="mt-4 space-y-4">
              <textarea
                v-model="comment"
                class="sketch-input w-full resize-none"
                rows="2"
                maxlength="500"
                :disabled="submitting || addingTodo"
                placeholder="想再说点什么吗？（可选）例如：可以，我就这么干"
              />
              <!-- 决定按钮 -->
              <div v-if="!askAddTodo" class="flex flex-wrap gap-3">
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
              <!-- 接受后追问：是否加入计划表 -->
              <div v-else class="flex flex-wrap items-center gap-3">
                <span class="text-sm font-light">要把这件事加入计划表吗？</span>
                <span class="text-xs text-sketch-lineSub font-light">
                  吃饭、出门这类即时决定可以不用加入
                </span>
                <LinearButton size="sm" :disabled="addingTodo || submitting" @click="confirmAddTodo">
                  {{ addingTodo || submitting ? "提交中…" : "加入计划表" }}
                </LinearButton>
                <LinearButton size="sm" :disabled="addingTodo || submitting" @click="skipAddTodo">
                  不用了
                </LinearButton>
              </div>
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

              <!-- 用户当时的留言 -->
              <p v-if="comment" class="text-sm font-light text-sketch-lineSub">
                我的留言：{{ comment }}
              </p>
              <p v-if="record?.executeResult" class="text-sm text-sketch-lineSub font-light">
                {{ record.executeResult }}
              </p>

              <!-- Agent 收到决定后的二次回复 -->
              <div v-if="replyText" class="sketch-border-l">
                <DualTextBlock cn="Agent 的回应" en="AGENT REPLY" size="sm" weight="normal" />
                <p class="mt-2 text-sm font-light leading-relaxed">
                  {{ replyText }}
                </p>
              </div>

              <!-- 计划状态 -->
              <div v-if="accepted" class="pt-3 sketch-border-t flex flex-wrap items-center gap-3">
                <template v-if="inTodoList">
                  <!-- 静态状态方框：done 或已归档显示对勾 -->
                  <svg width="18" height="18" viewBox="0 0 40 40" class="shrink-0">
                    <rect x="3" y="3" width="34" height="34" class="sketch-stroke" stroke-width="2.1" />
                    <path
                      v-if="linkedTodo?.done || linkedArchivedTodo"
                      class="sketch-stroke"
                      stroke-width="2.4"
                      d="M11,21 L18,28 L30,14"
                    />
                  </svg>
                  <span class="text-sm font-light">
                    {{
                      linkedTodo
                        ? linkedTodo.done
                          ? "该待办已完成。"
                          : "已加入计划表，去首页勾选完成吧。"
                        : "该待办已归档"
                    }}
                  </span>
                </template>
                <template v-else>
                  <span class="text-sm font-light text-sketch-lineSub">
                    {{ todoWasAdded ? "该待办已删除，可以重新加入计划表。" : "这条建议没有进入计划表。" }}
                  </span>
                  <LinearButton size="sm" :disabled="reAdding" @click="reAddTodo">
                    {{ reAdding ? "加入中…" : "加入计划表" }}
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

    <!-- 删除确认：手绘风弹窗 -->
    <SketchConfirmDialog
      :open="confirmOpen"
      title="删除决策记录"
      en-title="DELETE RECORD"
      message="任务输入、Agent 建议、反馈以及由它加入计划表的待办将一并删除，且不可恢复。"
      confirm-text="确认删除"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="confirmOpen = false"
    />
  </PageWrapper>
</template>
