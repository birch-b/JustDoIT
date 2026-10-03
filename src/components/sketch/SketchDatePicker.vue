<script setup lang="ts">
// 手绘风日期时间选择器：方形奶米底弹层 + 日历网格 + 时间选择，替换原生 datetime-local
// 用法：<SketchDatePicker v-model="form.deadline" placeholder="选个时间" />
import { computed, ref, watch } from "vue";

const props = withDefaults(defineProps<{
  modelValue: string | null; // ISO 字符串 "YYYY-MM-DDTHH:mm"
  placeholder?: string;
}>(), {
  placeholder: "选个时间",
});

const emit = defineEmits<{
  (e: "update:modelValue", v: string | null): void;
}>();

const open = ref(false);
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

function onHourChange(e: Event) {
  selHour.value = Number((e.target as HTMLInputElement).value);
  if (selectedDate.value) {
    selectedDate.value = new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), selectedDate.value.getDate(), selHour.value, selMinute.value);
    emitValue();
  }
}
function onMinuteChange(e: Event) {
  selMinute.value = Number((e.target as HTMLInputElement).value);
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

const displayText = computed(() => {
  if (!selectedDate.value) return props.placeholder;
  const d = selectedDate.value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
});

function onBlur() { open.value = false; }

// 小时/分钟选项
const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = [0, 15, 30, 45];
</script>

<template>
  <div class="relative select-none">
    <!-- 触发区 -->
    <button
      type="button"
      class="sketch-input w-full flex items-center justify-between gap-1 text-left"
      :aria-expanded="open"
      @click="open = !open"
      @blur="onBlur"
    >
      <span :class="selectedDate ? '' : 'text-sketch-lineSub'">{{ displayText }}</span>
      <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="#634442" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="12" height="11" rx="2" ry="2"/>
        <line x1="2" y1="7" x2="14" y2="7"/>
        <line x1="6" y1="1" x2="6" y2="5"/>
        <line x1="10" y1="1" x2="10" y2="5"/>
      </svg>
    </button>

    <!-- 弹层：方形奶米底 + 手绘边框 -->
    <Transition name="drop">
      <div
        v-if="open"
        class="absolute z-40 mt-1 left-0 w-64"
        style="background: #F7F1E5; border: 1.5px solid #634442; box-shadow: 3px 3px 0 rgba(99,68,66,0.15);"
        @mousedown.prevent
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

        <!-- 时间选择 -->
        <div class="flex items-center justify-center gap-2 px-3 py-1.5" style="border-top: 1px dashed rgba(99,68,66,0.2)">
          <select
            class="bg-transparent text-sm font-light text-sketch-line outline-none cursor-pointer"
            :value="selHour"
            @change="onHourChange"
          >
            <option v-for="h in hours" :key="h" :value="h">{{ String(h).padStart(2, "0") }}</option>
          </select>
          <span class="text-sketch-line text-sm">:</span>
          <select
            class="bg-transparent text-sm font-light text-sketch-line outline-none cursor-pointer"
            :value="selMinute"
            @change="onMinuteChange"
          >
            <option v-for="m in minutes" :key="m" :value="m">{{ String(m).padStart(2, "0") }}</option>
          </select>
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
