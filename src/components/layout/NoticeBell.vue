<script setup lang="ts">
// 小铃铛：系统公告 + 意见反馈
// - 公告从后端拉取（只返回最近 7 天），localStorage 记录已读 id 与清除时间点
// - 「清除」后不再显示清除时点之前的公告，有新公告会重新出现
// - 反馈提交到后端 POST /api/feedback（需登录）
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  getAnnouncements,
  ANNOUNCEMENT_TYPE_LABEL,
  type Announcement,
  type AnnouncementItem,
} from "@/api/announcementApi";
import { feedbackApi } from "@/api/feedbackApi";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";

const LAST_READ_KEY = "jdi_notice_last_read";
const CLEARED_AT_KEY = "jdi_notice_cleared_at";

const open = ref(false);
const tab = ref<"notice" | "feedback">("notice");
const rootRef = ref<HTMLElement | null>(null);

const announcements = ref<Announcement[]>([]);
const lastRead = ref<string>(localStorage.getItem(LAST_READ_KEY) || "");
const clearedAt = ref<string>(localStorage.getItem(CLEARED_AT_KEY) || "");

// 清除时点之后的公告才显示（ISO 串可字典序比较）
const visible = computed(() =>
  announcements.value.filter((a) => !clearedAt.value || a.createdAt > clearedAt.value),
);
const hasUnread = computed(() => {
  const latest = visible.value[0];
  return !!latest && String(latest.id) !== lastRead.value;
});

onMounted(async () => {
  try {
    announcements.value = await getAnnouncements();
  } catch {
    announcements.value = [];
  }
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onPointerDown);
  document.removeEventListener("keydown", onKey);
});

function markRead() {
  const latest = visible.value[0];
  if (latest && String(latest.id) !== lastRead.value) {
    lastRead.value = String(latest.id);
    localStorage.setItem(LAST_READ_KEY, lastRead.value);
  }
}
function clearAll() {
  clearedAt.value = new Date().toISOString();
  localStorage.setItem(CLEARED_AT_KEY, clearedAt.value);
}

function toggleOpen() {
  open.value = !open.value;
  if (open.value && tab.value === "notice") markRead();
}
watch(tab, (v) => {
  if (v === "notice" && open.value) markRead();
});

// 点击外部 / Esc 关闭：pointerdown 同时覆盖鼠标与触摸
function onPointerDown(e: PointerEvent) {
  if (!open.value) return;
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    open.value = false;
  }
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) open.value = false;
}

// 类型标签颜色：新增薄荷绿底 / 优化奶米深底 / 修复空心描边
function tagClass(type: AnnouncementItem["type"]) {
  if (type === "new") return "bg-sketch-accent/25 border-sketch-accent/60";
  if (type === "improve") return "bg-sketch-hover border-sketch-line/30";
  return "bg-transparent border-sketch-line/40";
}

// ===== 意见反馈 =====
const content = ref("");
const sending = ref(false);
const feedbackError = ref("");
const feedbackDone = ref(false);

async function submitFeedback() {
  const text = content.value.trim();
  if (!text) {
    feedbackError.value = "先写点内容再提交吧";
    return;
  }
  if (sending.value) return;
  sending.value = true;
  feedbackError.value = "";
  try {
    await feedbackApi.submit(text);
    feedbackDone.value = true;
    content.value = "";
  } catch (e) {
    feedbackError.value = (e as Error).message || "提交失败，请重试";
  } finally {
    sending.value = false;
  }
}
// 切回反馈 tab 时重置成功态，允许继续写
watch(tab, (v) => {
  if (v === "feedback") {
    feedbackDone.value = false;
    feedbackError.value = "";
  }
});
</script>

<template>
  <div ref="rootRef" class="relative shrink-0">
    <!-- 铃铛按钮 -->
    <button
      class="relative flex h-10 w-10 items-center justify-center hover:bg-sketch-hover transition-colors"
      aria-label="公告与反馈"
      @click="toggleOpen"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3c-3.2 0-5 2.4-5 5.5 0 3.2-1.2 4.8-2 5.7-.3.4 0 1 .5 1h13c.5 0 .8-.6.5-1-.8-.9-2-2.5-2-5.7C17 5.4 15.2 3 12 3Z"
          class="sketch-stroke"
          stroke-width="1.7"
          stroke-linejoin="round"
        />
        <path
          d="M10 18.5c.4 1.2 1.1 2 2 2s1.6-.8 2-2"
          class="sketch-stroke"
          stroke-width="1.7"
          stroke-linecap="round"
        />
      </svg>
      <!-- 未读红点 -->
      <span
        v-if="hasUnread"
        class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
        style="background: #c96f5a"
      />
    </button>

    <!-- 弹层 -->
    <Transition name="bell">
      <div
        v-if="open"
        class="absolute right-0 top-12 z-50 w-[calc(100vw-2rem)] max-w-sm"
        role="dialog"
        aria-label="公告与反馈"
      >
        <SketchBorder padding="1.25rem 1.5rem">
          <div class="bg-sketch-bg">
            <!-- Tab 切换 -->
            <div class="flex gap-5 border-b border-sketch-line/20 pb-2">
              <button
                class="text-sm font-light transition-colors"
                :class="tab === 'notice' ? 'text-sketch-line' : 'text-sketch-lineSub hover:text-sketch-line'"
                @click="tab = 'notice'"
              >
                公告
                <span class="ml-1 text-[10px] font-en tracking-widest opacity-60">NOTICE</span>
                <span
                  class="mt-0.5 block h-px bg-sketch-accent transition-all duration-300"
                  :class="tab === 'notice' ? 'w-full' : 'w-0'"
                />
              </button>
              <button
                class="text-sm font-light transition-colors"
                :class="tab === 'feedback' ? 'text-sketch-line' : 'text-sketch-lineSub hover:text-sketch-line'"
                @click="tab = 'feedback'"
              >
                意见反馈
                <span class="ml-1 text-[10px] font-en tracking-widest opacity-60">FEEDBACK</span>
                <span
                  class="mt-0.5 block h-px bg-sketch-accent transition-all duration-300"
                  :class="tab === 'feedback' ? 'w-full' : 'w-0'"
                />
              </button>
            </div>

            <!-- 公告列表 -->
            <div v-if="tab === 'notice'" class="mt-3">
              <div v-if="visible.length" class="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
                <div v-for="a in visible" :key="a.id">
                  <div class="flex items-baseline justify-between gap-2">
                    <p class="text-sm font-light text-sketch-line">{{ a.title }}</p>
                    <span class="shrink-0 text-[10px] font-en tracking-wider text-sketch-lineSub">
                      {{ a.date }}
                    </span>
                  </div>
                  <ul class="mt-2 space-y-1.5">
                    <li
                      v-for="(item, i) in a.items"
                      :key="i"
                      class="flex items-start gap-1.5 text-xs font-light leading-relaxed text-sketch-lineSub"
                    >
                      <span
                        class="mt-0.5 inline-block shrink-0 border px-1 py-px text-[10px] leading-none"
                        :class="tagClass(item.type)"
                      >
                        {{ ANNOUNCEMENT_TYPE_LABEL[item.type] }}
                      </span>
                      <span class="min-w-0">{{ item.text }}</span>
                    </li>
                  </ul>
                </div>
                <div class="flex justify-end pt-1">
                  <button
                    class="text-[11px] text-sketch-lineSub hover:text-sketch-line transition-colors"
                    @click="clearAll"
                  >
                    清除全部
                  </button>
                </div>
              </div>
              <p v-else class="py-6 text-center text-xs font-light text-sketch-lineSub">
                最近 7 天没有新公告。
              </p>
            </div>

            <!-- 意见反馈 -->
            <div v-else class="mt-3">
              <template v-if="!feedbackDone">
                <p class="text-xs font-light text-sketch-lineSub">
                  哪里用着不顺、想要什么功能，直接说。
                </p>
                <textarea
                  v-model="content"
                  class="sketch-input mt-2 w-full resize-none"
                  rows="4"
                  maxlength="1000"
                  placeholder="写点什么…"
                />
                <p
                  v-if="feedbackError"
                  class="mt-2 border border-sketch-line/40 px-3 py-2 text-xs text-sketch-line"
                >
                  {{ feedbackError }}
                </p>
                <div class="mt-3 flex justify-end">
                  <LinearButton size="sm" :disabled="sending" @click="submitFeedback">
                    <span>{{ sending ? "提交中…" : "提交" }}</span>
                  </LinearButton>
                </div>
              </template>
              <template v-else>
                <p class="py-6 text-center text-sm font-light text-sketch-line">
                  收到了，谢谢你。
                </p>
                <p class="pb-2 text-center text-xs font-light text-sketch-lineSub">
                  每一条反馈都会认真看。
                </p>
              </template>
            </div>
          </div>
        </SketchBorder>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bell-enter-active,
.bell-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.bell-enter-from,
.bell-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
@media (prefers-reduced-motion: reduce) {
  .bell-enter-active,
  .bell-leave-active {
    transition: none;
  }
}
</style>
