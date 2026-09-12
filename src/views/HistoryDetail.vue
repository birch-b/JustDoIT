<script setup lang="ts">
// 历史详情页 /history/:id：完整复现当时会话 + 用户真实反馈记录
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAgentStore } from "@/store/agentStore";
import type { HistoryDetail as HistoryDetailType } from "@/types";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchClock from "@/components/sketch/SketchClock.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import SketchCheckbox from "@/components/sketch/SketchCheckbox.vue";
import DecorDotCluster from "@/components/sketch/DecorDotCluster.vue";

interface Props {
  id: string | string[];
}
const props = defineProps<Props>();
const router = useRouter();
const store = useAgentStore();

const sessionId = computed(() => Number(props.id));
const detail = ref<HistoryDetailType | undefined>(undefined);
const notFound = ref(false);

onMounted(() => {
  store.seedDemoData();
  detail.value = store.getMockHistory(sessionId.value);
  if (!detail.value) notFound.value = true;
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
      <DualTextBlock class="mt-6" cn="未找到该历史记录" en="HISTORY NOT FOUND" size="lg" />
      <LinearButton class="mt-6" size="lg" @click="router.push('/')">返回首页</LinearButton>
    </div>

    <div v-else-if="detail" class="flex-1 flex flex-col">
      <!-- 顶部小标题 -->
      <div class="mb-8 flex items-center justify-between sketch-border-b pb-3">
        <DualTextBlock cn="历史详情" en="HISTORY DETAIL" size="md" weight="normal" />
        <span class="text-xs text-sketch-lineSub font-en tracking-widest">
          SESSION #{{ detail.session.sessionId }} · {{ formatDate(detail.createdAt) }}
        </span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-10 flex-1">
        <!-- 左：时钟 -->
        <div class="flex flex-col items-center lg:items-start">
          <SketchClock :score="detail.session.agentSuggestIndex" :size="280" />
          <div class="mt-4 flex items-center gap-2">
            <SketchCheckbox :size="16" decorative />
            <span class="text-xs font-en tracking-widest text-sketch-lineSub">
              ACTION INDEX · {{ detail.session.agentSuggestIndex }}
            </span>
          </div>
        </div>

        <!-- 右：完整复现 -->
        <div class="lg:col-span-2 flex flex-col gap-8">
          <!-- 结论 -->
          <SketchBorder padding="2rem">
            <DualTextBlock
              :cn="detail.session.conclusion"
              :en="detail.session.agentSuggestIndex >= 50 ? 'GO FOR IT NOW' : 'HOLD OFF TODAY'"
              size="xl"
              highlight
            />
            <div class="mt-4 flex items-center gap-3">
              <SketchCheckbox :size="18" decorative />
              <span class="text-xs font-en tracking-widest text-sketch-lineSub">
                {{ detail.session.persuadeMode.toUpperCase() }}
              </span>
            </div>
            <p class="mt-4 text-sm font-light leading-relaxed">
              {{ detail.session.persuadeText }}
            </p>
            <p v-if="detail.session.taroCard" class="mt-3 text-xs text-sketch-lineSub font-en tracking-wide">
              TAROT · {{ detail.session.taroCard }}
            </p>
          </SketchBorder>

          <!-- 当时任务输入 -->
          <div>
            <DualTextBlock cn="当时任务输入" en="ORIGINAL TASK INPUT" size="sm" weight="normal" />
            <div class="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-light">
              <div>
                <p class="text-[10px] text-sketch-lineSub font-en tracking-widest">CONTENT</p>
                <p class="mt-1">{{ detail.task.taskContent }}</p>
              </div>
              <div>
                <p class="text-[10px] text-sketch-lineSub font-en tracking-widest">WILL / ENERGY / IMPORTANCE</p>
                <p class="mt-1">{{ detail.task.willScore }} / {{ detail.task.energyScore }} / {{ detail.task.importance }}</p>
              </div>
              <div>
                <p class="text-[10px] text-sketch-lineSub font-en tracking-widest">EXPECT COST</p>
                <p class="mt-1">{{ detail.task.expectCostMin }} min</p>
              </div>
              <div>
                <p class="text-[10px] text-sketch-lineSub font-en tracking-widest">DEADLINE / LOCATION</p>
                <p class="mt-1">{{ detail.task.deadline }} · {{ detail.task.location || "—" }}</p>
              </div>
            </div>
          </div>

          <!-- 最小行动 -->
          <div>
            <DualTextBlock cn="最小行动提示" en="MINIMAL ACTION" size="sm" weight="normal" />
            <p class="mt-2 text-base font-light leading-relaxed">
              {{ detail.session.minAction }}
            </p>
          </div>

          <!-- 历史摘要 -->
          <div class="sketch-border-l">
            <DualTextBlock cn="历史真实行为摘要" en="HISTORY SUMMARY" size="sm" weight="normal" />
            <p class="mt-2 text-sm font-light text-sketch-lineSub leading-relaxed">
              {{ detail.session.historySummary }}
            </p>
          </div>

          <!-- 用户当时真实反馈 -->
          <SketchBorder padding="2rem">
            <DualTextBlock cn="用户当时真实反馈" en="YOUR ACTUAL FEEDBACK" size="md" weight="normal" />

            <div v-if="detail.record" class="mt-4 space-y-3 text-sm font-light">
              <div class="flex flex-wrap gap-4">
                <span class="border border-sketch-line/40 px-2 py-1 text-xs">
                  {{ detail.record.userAcceptSuggest ? "接受建议" : "拒绝建议" }}
                </span>
                <span class="border border-sketch-line/40 px-2 py-1 text-xs">
                  {{ detail.record.isExecute ? "已执行" : "未执行" }}
                </span>
                <span class="border border-sketch-line/40 px-2 py-1 text-xs">
                  实际耗时 {{ detail.record.actualCostMin }} min
                </span>
                <span class="text-[10px] text-sketch-lineSub font-en tracking-widest self-center">
                  {{ formatDate(detail.record.createdAt) }}
                </span>
              </div>
              <p v-if="detail.record.executeResult" class="text-sketch-lineSub">
                {{ detail.record.executeResult }}
              </p>
            </div>

            <div v-else class="mt-4 flex items-center gap-2 text-sm text-sketch-lineSub font-light">
              <SketchCheckbox :size="16" decorative />
              <span>该次会话尚未提交行为反馈。</span>
            </div>
          </SketchBorder>

          <!-- 底部操作 -->
          <div class="flex flex-wrap gap-3 pt-4 sketch-border-t">
            <LinearButton size="md" @click="router.push('/')">返回首页</LinearButton>
            <LinearButton size="md" @click="router.push('/stats')">查看统计</LinearButton>
            <LinearButton size="md" @click="router.push('/task-create')">新的一次纠结</LinearButton>
          </div>
        </div>
      </div>
    </div>
  </PageWrapper>
</template>
