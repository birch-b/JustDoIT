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
/** 时间子下拉：'hour' / 'minute' / null（同一时间只展开一个） */
const openTimeMenu = ref<"hour" | "minute" | null>(null);
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

function setHour(h: number) {
  selHour.value = h;
  openTimeMenu.value = null;
  if (selectedDate.value) {
    selectedDate.value = new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), selectedDate.value.getDate(), selHour.value, selMinute.value);
    emitValue();
  }
}
function setMinute(m: number) {
  selMinute.value = m;
  openTimeMenu.value = null;
  if (selectedDate.value) {
    selectedDate.value = new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), selectedDate.value.getDate(), selHour.value, selMinute.value);
    emitValue();
  }
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
    openTimeMenu.value = null;
  }
}
function toggleOpen() {
  open.value = !open.value;
  if (!open.value) openTimeMenu.value = null;
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

        <!-- 时间选择（自绘下拉，与手绘风一致；不能用原生 select + mousedown.prevent） -->
        <div class="relative flex items-center justify-center gap-2 px-3 py-1.5" style="border-top: 1px dashed rgba(99,68,66,0.2)">
          <!-- 小时 -->
          <div class="relative">
            <button
              type="button"
              class="flex items-center gap-1 bg-transparent text-sm font-light text-sketch-line outline-none cursor-pointer"
              @click="openTimeMenu = openTimeMenu === 'hour' ? null : 'hour'"
            >
              {{ pad2(selHour) }}
              <svg class="w-2.5 h-2.5" viewBox="0 0 12 8" fill="none">
                <path d="M1,1.5 L6,6.5 L11,1.5" stroke="#634442" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <ul
              v-if="openTimeMenu === 'hour'"
              class="absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 py-1 overflow-y-auto"
              style="width:4.5rem;max-height:8.4rem;background:#F7F1E5;border:1.5px solid #634442;box-shadow:2px 2px 0 rgba(99,68,66,0.15)"
            >
              <li
                v-for="h in hours"
                :key="h"
                class="px-2 py-0.5 text-center text-sm font-light cursor-pointer"
                :class="h === selHour ? '' : 'text-sketch-line hover:bg-sketch-line/8'"
                :style="h === selHour ? 'color:#7FA89F;background:rgba(127,168,159,0.15)' : ''"
                @click="setHour(h)"
              >
                {{ pad2(h) }}
              </li>
            </ul>
          </div>

          <span class="text-sketch-line text-sm">:</span>

          <!-- 分钟 -->
          <div class="relative">
            <button
              type="button"
              class="flex items-center gap-1 bg-transparent text-sm font-light text-sketch-line outline-none cursor-pointer"
              @click="openTimeMenu = openTimeMenu === 'minute' ? null : 'minute'"
            >
              {{ pad2(selMinute) }}
              <svg class="w-2.5 h-2.5" viewBox="0 0 12 8" fill="none">
                <path d="M1,1.5 L6,6.5 L11,1.5" stroke="#634442" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
         <ul
  v-if="openTimeMenu === 'minute'"
  class="absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 py-1 overflow-y-auto"
  style="width:4.5rem;max-height:8.4rem;background:#F7F1E5;border:1.5px solid #634442;box-shadow:2px 2px 0 rgba(99,68,66,0.15)"
>

              <li
                v-for="m in minutes"
                :key="m"
                class="px-2 py-0.5 text-center text-sm font-light cursor-pointer"
                :class="m === selMinute ? '' : 'text-sketch-line hover:bg-sketch-line/8'"
                :style="m === selMinute ? 'color:#7FA89F;background:rgba(127,168,159,0.15)' : ''"
                @click="setMinute(m)"
              >
                {{ pad2(m) }}
              </li>
            </ul>
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
</style>
