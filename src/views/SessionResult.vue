<script setup lang="ts">
// Agent 结果页 /session/:id【核心页面】
// 左侧大时钟 SVG，右侧文案区域；移动端时钟置顶文案垂直向下
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAgentStore } from "@/store/agentStore";
import { useTodoStore } from "@/store/todoStore";
import type { AgentSessionRes } from "@/types";
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

const sessionId = computed(() => Number(props.id));
const session = ref<AgentSessionRes | undefined>(undefined);
const notFound = ref(false);

// 反馈：只表达态度——接受 / 拒绝；完成与否由计划表追踪
type FeedbackChoice = "accept" | "reject";
const submitted = ref(false);
const accepted = ref(false);

const choiceMeta: Record<FeedbackChoice, { cn: string; symbol: string; accept: boolean }> = {
  accept: { cn: "我接受", symbol: "✓", accept: true },
  reject: { cn: "我拒绝", symbol: "✕", accept: false },
};

onMounted(() => {
  store.seedDemoData();
  session.value = store.getMockSession(sessionId.value);
  if (!session.value) notFound.value = true;
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
function submitFeedback(c: FeedbackChoice) {
  if (submitted.value || !session.value) return;
  const meta = choiceMeta[c];
  store.submitMockRecord({
    sessionId: session.value.sessionId,
    userAcceptSuggest: meta.accept,
    isExecute: false,
    actualCostMin: 0,
    executeResult: "",
  });
  if (meta.accept) {
    const full = store.getMockSessionWithTask(session.value.sessionId);
    if (full) {
      todoStore.addTodo({
        taskContent: full.task.taskContent,
        category: full.task.category || "other",
        deadline: full.task.deadline || null,
        sessionId: session.value.sessionId,
      });
    }
    accepted.value = true;
  }
  submitted.value = true;
}
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
      <div class="mb-8 flex items-center justify-between sketch-border-b pb-3">
        <DualTextBlock cn="Agent 结果" en="AGENT RESULT" size="md" weight="normal" />
        <span class="text-xs text-sketch-lineSub font-en tracking-widest">
          SESSION #{{ session.sessionId }}
        </span>
      </div>

      <!-- 主体：左时钟 + 右文案 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 flex-1">
        <!-- 左：时钟 -->
        <div class="relative flex items-center justify-center">
          <div class="relative">
            <SketchClock :score="session.agentSuggestIndex" :size="360" />
            <div
              v-for="(b, i) in ringDeco"
              :key="i"
              class="absolute pointer-events-none"
              :style="{ top: b.top, left: b.left, right: b.right, bottom: b.bottom }"
            >
              <SketchCheckbox :size="b.size" :rotate="b.rotate" decorative />
            </div>
          </div>
        </div>

        <!-- 右：文案区 -->
        <div class="flex flex-col gap-8">
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

          <!-- 底部反馈操作区 -->
          <div class="mt-auto pt-6 sketch-border-t">
            <DualTextBlock
              v-if="!submitted"
              cn="你的决定"
              en="YOUR DECISION"
              size="sm"
              weight="normal"
            />
            <DualTextBlock
              v-else-if="accepted"
              cn="已接受并加入计划表，去做吧。"
              en="ACCEPTED & ADDED TO YOUR TO DO LIST."
              size="sm"
              weight="normal"
            />
            <DualTextBlock
              v-else
              cn="已记录你的拒绝，下次再纠结。"
              en="REJECTED. TILL NEXT TIME."
              size="sm"
              weight="normal"
            />

            <div v-if="!submitted" class="mt-4 flex flex-wrap gap-3">
              <LinearButton
                v-for="(meta, key) in choiceMeta"
                :key="key"
                size="md"
                @click="submitFeedback(key as FeedbackChoice)"
              >
                <span class="mr-1">{{ meta.symbol }}</span>
                <span>{{ meta.cn }}</span>
              </LinearButton>
            </div>
            <div v-else class="mt-4 flex flex-wrap gap-3">
              <LinearButton size="md" @click="router.push('/')">
                <span>返回首页</span>
              </LinearButton>
              <LinearButton size="md" @click="router.push(`/history/${session.sessionId}`)">
                <span>查看历史详情</span>
              </LinearButton>
              <LinearButton size="md" @click="router.push('/stats')">
                <span>查看统计</span>
              </LinearButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </PageWrapper>
</template>
