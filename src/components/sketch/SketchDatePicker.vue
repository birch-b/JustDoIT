<script setup lang="ts">
// 手绘风日期时间选择器：方形奶米底弹层 + 日历网格 + 时间选择，替换原生 datetime-local
// 用法：<SketchDatePicker v-model="form.deadline" placeholder="选个时间" />
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(defineProps<{
  modelValue: string | null; // ISO 字符串 "YYYY-MM-DDTHH:mm"
  placeholder?: string;
}>(), {
});

const emit = defineEmits<{
  (e: "update:modelValue", v: string | null): void;
}>();

const open = ref(false);
/** 组件根元素，用于点外部关闭 */
const rootEl = ref<HTMLElement | null>(null);
const today = new Date();

// 当前浏览的月份
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth()); // 0-11

// 已选中的日期时间
const selectedDate = ref<Date | null>(props.modelValue ? new Date(props.modelValue) : null);
const selHour = ref(today.getHours());
const selMinute = ref(0);

// 外部 v-model 变化时同步（如 reset）
watch(() => props.modelValue, (v) => {
  selectedDate.value = v ? new Date(v) : null;
  if (v) {
    const d = new Date(v);
    selHour.value = d.getHours();
    selMinute.value = d.getMinutes();
    scrollWheelsToCurrent();
  }
});

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

/** 当月日历网格：null=空白占位 */
const calendarDays = computed<(number | null)[]>(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1);
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate();
  // 周一为起始：0=周一 ... 6=周日
  let startWeekday = first.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
});

const monthLabel = computed(() => `${viewYear.value} 年 ${viewMonth.value + 1} 月`);

function prevMonth() {
  if (viewMonth.value === 0) { viewYear.value--; viewMonth.value = 11; }
  else viewMonth.value--;
}
function nextMonth() {
  if (viewMonth.value === 11) { viewYear.value++; viewMonth.value = 0; }
  else viewMonth.value++;
}

function isToday(day: number) {
  return viewYear.value === today.getFullYear()
    && viewMonth.value === today.getMonth()
    && day === today.getDate();
}

function isSelected(day: number) {
  if (!selectedDate.value) return false;
  return viewYear.value === selectedDate.value.getFullYear()
    && viewMonth.value === selectedDate.value.getMonth()
    && day === selectedDate.value.getDate();
}

function pickDay(day: number) {
  selectedDate.value = new Date(viewYear.value, viewMonth.value, day, selHour.value, selMinute.value);
  emitValue();
}

function emitValue() {
  if (!selectedDate.value) { emit("update:modelValue", null); return; }
  const d = selectedDate.value;
  const pad = (n: number) => String(n).padStart(2, "0");
  emit("update:modelValue", `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(selHour.value)}:${pad(selMinute.value)}`);
}

// ===== 时间滚轴（微信提醒式：scroll-snap 滚动选择，时/分两列） =====
const WHEEL_ITEM_H = 32;
const hourColEl = ref<HTMLElement | null>(null);
const minuteColEl = ref<HTMLElement | null>(null);
let wheelRaf = 0;

function syncTime() {
  if (!selectedDate.value) return;
  const d = selectedDate.value;
  selectedDate.value = new Date(d.getFullYear(), d.getMonth(), d.getDate(), selHour.value, selMinute.value);
  emitValue();
}

function onWheelScroll(kind: "hour" | "minute", e: Event) {
  const el = e.target as HTMLElement;
  cancelAnimationFrame(wheelRaf);
  wheelRaf = requestAnimationFrame(() => {
    const max = kind === "hour" ? 23 : 59;
    const idx = Math.max(0, Math.min(max, Math.round(el.scrollTop / WHEEL_ITEM_H)));
    if (kind === "hour" && idx !== selHour.value) { selHour.value = idx; syncTime(); }
    if (kind === "minute" && idx !== selMinute.value) { selMinute.value = idx; syncTime(); }
  });
}

function scrollWheelsToCurrent() {
  hourColEl.value?.scrollTo({ top: selHour.value * WHEEL_ITEM_H });
  minuteColEl.value?.scrollTo({ top: selMinute.value * WHEEL_ITEM_H });
}

function clearDate() {
  selectedDate.value = null;
  emit("update:modelValue", null);
  open.value = false;
}

function confirmDate() {
  if (!selectedDate.value) {
    // 未选日期时默认今天
    selectedDate.value = new Date(viewYear.value, viewMonth.value, today.getDate(), selHour.value, selMinute.value);
    emitValue();
  }
  open.value = false;
}

function onDocMouseDown(e: MouseEvent) {
  if (!open.value) return;
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    open.value = false;
  }
}
function toggleOpen() {
  open.value = !open.value;
  if (open.value) {
    // 打开后滚轴定位到当前时间
    requestAnimationFrame(() => scrollWheelsToCurrent());
  }
}

onMounted(() => document.addEventListener("mousedown", onDocMouseDown));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocMouseDown));

const displayText = computed(() => {
  if (!selectedDate.value) return props.placeholder;
  const d = selectedDate.value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
});

// 小时/分钟选项
const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = Array.from({ length: 60 }, (_, i) => i);
const pad2 = (n: number) => String(n).padStart(2, "0");
</script>

<template>
  <div ref="rootEl" class="relative select-none">
    <!-- 触发区：高度/图标定位与 SketchPlacePicker 完全一致，保证三列下划线齐平、图标对齐 -->
    <button
      type="button"
      class="sketch-input relative h-9 w-full pr-8 text-left"
      :aria-expanded="open"
      @click="toggleOpen"
    >
      <span :class="selectedDate ? '' : 'text-sketch-lineSub'">{{ displayText }}</span>
      <span class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg class="w-4 h-4 shrink-0 text-sketch-lineSub" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="12" height="11" rx="2" ry="2"/>
          <line x1="2" y1="7" x2="14" y2="7"/>
          <line x1="6" y1="1" x2="6" y2="5"/>
          <line x1="10" y1="1" x2="10" y2="5"/>
        </svg>
      </span>
    </button>

    <!-- 弹层：方形奶米底 + 手绘边框 -->
    <Transition name="drop">
      <div
        v-if="open"
        class="absolute z-40 mt-1 left-0 w-64"
        style="background: #F7F1E5; border: 1.5px solid #634442; box-shadow: 3px 3px 0 rgba(99,68,66,0.15);"
      >
        <!-- 月份导航 -->
        <div class="flex items-center justify-between px-3 pt-2 pb-1">
          <button type="button" class="p-1 hover:bg-sketch-line/8 transition-colors" @mousedown.prevent="prevMonth">
            <svg class="w-3 h-3" viewBox="0 0 8 12" fill="none"><path d="M6.5,1 L1.5,6 L6.5,11" stroke="#634442" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <span class="text-sm font-light text-sketch-line">{{ monthLabel }}</span>
          <button type="button" class="p-1 hover:bg-sketch-line/8 transition-colors" @mousedown.prevent="nextMonth">
            <svg class="w-3 h-3" viewBox="0 0 8 12" fill="none"><path d="M1.5,1 L6.5,6 L1.5,11" stroke="#634442" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <!-- 星期表头 -->
        <div class="grid grid-cols-7 px-2 text-center">
          <span v-for="w in WEEKDAYS" :key="w" class="text-xs text-sketch-lineSub py-0.5">{{ w }}</span>
        </div>

        <!-- 日历网格 -->
        <div class="grid grid-cols-7 px-2 pb-1 text-center">
          <template v-for="(cell, i) in calendarDays" :key="i">
            <span v-if="cell === null" class="py-1" />
            <button
              v-else
              type="button"
              class="py-1 text-sm font-light transition-colors cursor-pointer"
              :class="[
                isSelected(cell) ? 'text-white' : isToday(cell) ? 'font-normal' : 'text-sketch-line',
              ]"
              :style="isSelected(cell) ? 'background:#7FA89F' : isToday(cell) ? 'background:rgba(127,168,159,0.2)' : ''"
              @mousedown.prevent="pickDay(cell)"
            >{{ cell }}</button>
          </template>
        </div>

        <!-- 时间滚轴（微信提醒式：日期在上面日历选，时间在这里滚动选） -->
        <div class="relative px-3 py-1.5" style="border-top: 1px dashed rgba(99,68,66,0.2)">
          <div class="relative flex justify-center gap-6">
            <!-- 中心指示条 -->
            <div
              class="pointer-events-none absolute left-2 right-2 top-1/2 -translate-y-1/2"
              style="height:32px;border-top:1.5px solid rgba(99,68,66,0.25);border-bottom:1.5px solid rgba(99,68,66,0.25)"
            ></div>
            <!-- 小时列 -->
            <div
              ref="hourColEl"
              class="wheel-col"
              @scroll.passive="onWheelScroll('hour', $event)"
            >
              <div style="height:32px"></div>
              <div
                v-for="h in hours"
                :key="h"
                class="wheel-item"
                :class="h === selHour ? 'text-sketch-line' : 'text-sketch-lineSub/50'"
              >{{ pad2(h) }} 时</div>
              <div style="height:32px"></div>
            </div>
            <!-- 分钟列 -->
            <div
              ref="minuteColEl"
              class="wheel-col"
              @scroll.passive="onWheelScroll('minute', $event)"
            >
              <div style="height:32px"></div>
              <div
                v-for="m in minutes"
                :key="m"
                class="wheel-item"
                :class="m === selMinute ? 'text-sketch-line' : 'text-sketch-lineSub/50'"
              >{{ pad2(m) }} 分</div>
              <div style="height:32px"></div>
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="flex justify-between px-3 py-1.5" style="border-top: 1px dashed rgba(99,68,66,0.2)">
          <button type="button" class="text-xs text-sketch-lineSub hover:text-sketch-line transition-colors" @mousedown.prevent="clearDate">清除</button>
          <button type="button" class="text-xs hover:underline transition-colors" style="color:#7FA89F" @mousedown.prevent="confirmDate">确定</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drop-enter-active, .drop-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-4px); }

/* 时间滚轴：scroll-snap 让每行自动吸附到中心，隐藏滚动条 */
.wheel-col {
  height: 96px; /* 3 行 */
  width: 4.5rem;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  text-align: center;
}
.wheel-col::-webkit-scrollbar { display: none; }
.wheel-item {
  height: 32px;
  line-height: 32px;
  scroll-snap-align: center;
  font-size: 0.875rem;
  font-weight: 300;
  transition: color 0.15s;
}
@media (prefers-reduced-motion: reduce) {
  .wheel-item { transition: none; }
}
</style>
