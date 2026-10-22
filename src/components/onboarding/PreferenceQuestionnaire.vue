<script lang="ts">
// 用户冷启动偏好问卷：注册后引导填写，老用户可在关键词页编辑
// 数据写入 user.preference（JSON），后续注入 LLM prompt 做个性化建议
import { ref } from "vue";
import type { UserPreference } from "@/api/userApi";

/** 问卷弹层开关（模块级共享：注册流程与关键词页都能控制） */
export const questionnaireOpen = ref(false);
/** 编辑时回填的已有偏好（null 表示新建） */
export const initialPreference = ref<UserPreference | null>(null);
/** 标记：本次新手引导关闭后要自动弹偏好问卷（注册流程专用，App.vue 监听消费） */
export const pendingAfterGuide = ref(false);

export function openQuestionnaire(pref?: UserPreference | null) {
  initialPreference.value = pref ?? null;
  questionnaireOpen.value = true;
}
function closeQuestionnaire() {
  questionnaireOpen.value = false;
}
</script>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { useUserStore } from "@/store/userStore";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchChip from "@/components/sketch/SketchChip.vue";

const userStore = useUserStore();

const INTEREST_OPTIONS = ["运动", "阅读", "游戏", "音乐", "美食", "旅行", "摄影", "编程", "社交", "追剧", "手工", "宠物"];
const AGONIZE_OPTIONS = ["要不要买东西", "要不要开始做", "选择太多", "怕后悔", "怕出错", "拖延", "权衡太久", "怕麻烦别人"];
const STYLE_OPTIONS = ["理性分析", "感性直觉", "听别人建议", "纠结很久", "快速拍板"];
const VALUE_OPTIONS = ["省钱", "效率", "体验", "健康", "成长", "人际关系", "开心", "稳定", "成就感", "自由"];

const form = reactive<UserPreference>({
  interests: [],
  agonizeOver: [],
  decisionStyle: "",
  values: [],
  customNote: "",
});

const index = ref(0);
const saving = ref(false);
const errorMsg = ref("");

const TOTAL_STEPS = 3;
const isFirst = computed(() => index.value === 0);
const isLast = computed(() => index.value === TOTAL_STEPS - 1);

watch(questionnaireOpen, (v) => {
  if (v) {
    index.value = 0;
    errorMsg.value = "";
    const init = initialPreference.value;
    form.interests = init?.interests ? [...init.interests] : [];
    form.agonizeOver = init?.agonizeOver ? [...init.agonizeOver] : [];
    form.decisionStyle = init?.decisionStyle ?? "";
    form.values = init?.values ? [...init.values] : [];
    form.customNote = init?.customNote ?? "";
  }
});

function toggle(list: string[], item: string) {
  const i = list.indexOf(item);
  if (i >= 0) list.splice(i, 1);
  else list.push(item);
}

function next() {
  if (isLast.value) return;
  index.value++;
}
function prev() {
  if (!isFirst.value) index.value--;
}

async function submit() {
  if (saving.value) return;
  saving.value = true;
  errorMsg.value = "";
  try {
    const res = await userStore.updatePreference({
      interests: form.interests,
      agonizeOver: form.agonizeOver,
      decisionStyle: form.decisionStyle,
      values: form.values,
      customNote: form.customNote.trim(),
    });
    if (!res.ok) {
      errorMsg.value = res.msg;
      return;
    }
    closeQuestionnaire();
  } catch (e) {
    errorMsg.value = (e as Error).message || "保存失败，请重试";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pref">
      <div
        v-if="questionnaireOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-label="偏好设置"
      >
        <div class="absolute inset-0 bg-sketch-line/35" @click="closeQuestionnaire" />
        <div class="pref-card relative w-full max-w-lg">
          <SketchBorder padding="2rem 2.25rem">
            <div class="flex items-start justify-between gap-3">
              <DualTextBlock cn="偏好设置" en="PREFERENCE" size="md" weight="normal" />
              <span class="shrink-0 pt-1 text-xs text-sketch-lineSub font-en tracking-widest">
                {{ index + 1 }} / {{ TOTAL_STEPS }}
              </span>
            </div>

            <!-- 第 1 步：兴趣 + 纠结点 -->
            <div v-if="index === 0" class="mt-5 space-y-6">
              <div>
                <p class="text-sm font-light text-sketch-line">你平时喜欢做什么？（可多选）</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <SketchChip
                    v-for="opt in INTEREST_OPTIONS"
                    :key="opt"
                    :selected="form.interests.includes(opt)"
                    @click="toggle(form.interests, opt)"
                  >
                    {{ opt }}
                  </SketchChip>
                </div>
              </div>
              <div>
                <p class="text-sm font-light text-sketch-line">你容易在什么事情上纠结？（可多选）</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <SketchChip
                    v-for="opt in AGONIZE_OPTIONS"
                    :key="opt"
                    :selected="form.agonizeOver.includes(opt)"
                    @click="toggle(form.agonizeOver, opt)"
                  >
                    {{ opt }}
                  </SketchChip>
                </div>
              </div>
            </div>

            <!-- 第 2 步：决策风格 + 价值观 -->
            <div v-else-if="index === 1" class="mt-5 space-y-6">
              <div>
                <p class="text-sm font-light text-sketch-line">你做决定时通常是什么风格？（单选）</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <SketchChip
                    v-for="opt in STYLE_OPTIONS"
                    :key="opt"
                    :selected="form.decisionStyle === opt"
                    @click="form.decisionStyle = opt"
                  >
                    {{ opt }}
                  </SketchChip>
                </div>
              </div>
              <div>
                <p class="text-sm font-light text-sketch-line">做决定时你最看重什么？（可多选）</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <SketchChip
                    v-for="opt in VALUE_OPTIONS"
                    :key="opt"
                    :selected="form.values.includes(opt)"
                    @click="toggle(form.values, opt)"
                  >
                    {{ opt }}
                  </SketchChip>
                </div>
              </div>
            </div>

            <!-- 第 3 步：补充说明 -->
            <div v-else class="mt-5">
              <p class="text-sm font-light text-sketch-line">还有什么想让我知道的？（选填）</p>
              <p class="mt-1 text-xs font-light text-sketch-lineSub">比如你的口头禅、忌讳、特殊情况，随便写两句。</p>
              <textarea
                v-model="form.customNote"
                class="sketch-input mt-3 w-full resize-none"
                rows="4"
                maxlength="200"
                placeholder="随便写两句…"
              />
            </div>

            <!-- 错误提示 -->
            <p v-if="errorMsg" class="mt-3 text-xs text-sketch-line border border-sketch-line/40 px-3 py-2">
              {{ errorMsg }}
            </p>

            <!-- 分页圆点 -->
            <div class="mt-5 flex items-center gap-2">
              <span
                v-for="i in TOTAL_STEPS"
                :key="i"
                class="h-2 w-2 rounded-full transition-colors"
                :style="{ background: i - 1 === index ? '#7FA89F' : 'rgba(99,68,66,0.25)' }"
              />
            </div>

            <div class="mt-5 flex items-center justify-between">
              <button
                class="text-xs text-sketch-lineSub hover:text-sketch-line transition-colors"
                @click="closeQuestionnaire"
              >
                稍后再说
              </button>
              <div class="flex gap-3">
                <LinearButton v-if="!isFirst" size="sm" @click="prev">
                  <span>上一步</span>
                </LinearButton>
                <LinearButton v-if="!isLast" size="sm" @click="next">
                  <span>下一步</span>
                </LinearButton>
                <LinearButton v-else size="sm" :disabled="saving" @click="submit">
                  <span>{{ saving ? "保存中…" : "完成" }}</span>
                </LinearButton>
              </div>
            </div>
          </SketchBorder>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pref-card {
  background: theme("colors.sketch.bg");
}
.pref-enter-active,
.pref-leave-active {
  transition: opacity 0.2s ease;
}
.pref-enter-active .pref-card,
.pref-leave-active .pref-card {
  transition:
    transform 0.25s cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 0.2s ease;
}
.pref-enter-from,
.pref-leave-to {
  opacity: 0;
}
.pref-enter-from .pref-card,
.pref-leave-to .pref-card {
  transform: scale(0.94) translateY(6px);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .pref-enter-active,
  .pref-leave-active,
  .pref-enter-active .pref-card,
  .pref-leave-active .pref-card {
    transition: none;
  }
}
</style>
