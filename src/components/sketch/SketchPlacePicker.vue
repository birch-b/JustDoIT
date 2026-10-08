<script setup lang="ts">
// 手绘风地点搜索：输入关键词 → 防抖调百度 POI → 下拉列表点选，保持与 SketchSelect 一致的奶米底 + 炭棕描边风格
import { ref, watch, onMounted, onUnmounted } from "vue";
import { agentApi } from "@/api/agentApi";

interface PlaceItem {
  name: string;
  address: string;
}

const props = withDefaults(defineProps<{
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
}>(), {
  disabled: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
}>();

const inputValue = ref(props.modelValue);
const open = ref(false);
const loading = ref(false);
const results = ref<PlaceItem[]>([]);
const activeIndex = ref(-1);

let timer: ReturnType<typeof setTimeout> | null = null;

// 定位策略优先级：① 浏览器坐标 → ② localStorage 天气城市 → ③ 全国
const coords = ref<{ lat: number; lng: number } | null>(null);
const fallbackCity = ref("");
onMounted(() => {
  // 先读天气城市（用户已选过的，大概率就是所在地）
  const cached = typeof localStorage !== "undefined" ? localStorage.getItem("jdi_weather_city") : "";
  if (cached) fallbackCity.value = cached;
  // 再尝试浏览器定位；成功则覆盖城市降级
  if (typeof navigator === "undefined" || !window.isSecureContext || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => { coords.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
    () => { /* 拒绝/超时：仍保留 weather_city 降级 */ },
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 10 * 60 * 1000 },
  );
});

watch(() => props.modelValue, (v) => {
  if (v !== inputValue.value) inputValue.value = v;
});

function onInput() {
  emit("update:modelValue", inputValue.value);
  open.value = true;
  activeIndex.value = -1;
  if (timer) clearTimeout(timer);
  const q = inputValue.value.trim();
  if (!q) {
    results.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  timer = setTimeout(async () => {
    const list = await agentApi.placeSearch(q, coords.value, fallbackCity.value || undefined);
    results.value = list ?? [];
    loading.value = false;
  }, 300);
}

function pick(item: PlaceItem) {
  inputValue.value = item.name;
  emit("update:modelValue", item.name);
  open.value = false;
  results.value = [];
}

function onBlur() {
  // 延迟收拢，让 mousedown 先触发 pick
  setTimeout(() => { open.value = false; }, 150);
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, -1);
  } else if (e.key === "Enter" && activeIndex.value >= 0 && results.value[activeIndex.value]) {
    e.preventDefault();
    pick(results.value[activeIndex.value]);
  } else if (e.key === "Escape") {
    open.value = false;
  }
}

onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="relative select-none" :class="disabled ? 'opacity-50 pointer-events-none' : ''">
    <!-- 输入框：保持 sketch-input 手绘波浪下划线风格 -->
    <div class="relative">
      <input
        v-model="inputValue"
        type="text"
        class="sketch-input h-9 w-full pr-8"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="onInput"
        @blur="onBlur"
        @focus="inputValue.trim() && (open = true)"
        @keydown="onKeydown"
      />
      <!-- 搜索 / 加载图标 -->
      <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg v-if="loading" class="w-4 h-4 animate-spin text-sketch-lineSub" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="60" stroke-dashoffset="30" stroke-linecap="round"/>
        </svg>
        <svg v-else class="w-4 h-4 text-sketch-lineSub" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"/>
          <path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
        </svg>
      </div>
    </div>

    <!-- 下拉结果：方形奶米底 + 手绘边框，同 SketchSelect -->
    <Transition name="drop">
      <div
        v-if="open && (results.length > 0 || loading)"
        class="absolute z-40 left-0 right-0 mt-1"
        style="background: #F7F1E5; border: 1.5px solid #634442; box-shadow: 3px 3px 0 rgba(99,68,66,0.15);"
      >
        <ul class="py-1 overflow-y-auto max-h-64">
          <li v-if="loading" class="px-3 py-2 text-sm text-sketch-lineSub font-light">
            正在搜索…
          </li>
          <template v-else>
            <li
              v-for="(item, idx) in results"
              :key="item.name + item.address"
              class="px-3 py-2 text-sm font-light cursor-pointer transition-colors"
              :class="idx === activeIndex ? 'bg-sketch-line/8' : 'hover:bg-sketch-line/8'"
              @mousedown.prevent="pick(item)"
            >
              <div class="text-sketch-line">{{ item.name }}</div>
              <div v-if="item.address" class="text-xs text-sketch-lineSub mt-0.5 truncate">{{ item.address }}</div>
            </li>
            <li v-if="results.length === 0" class="px-3 py-2 text-xs text-sketch-lineSub">
              没搜到相关地点
            </li>
          </template>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drop-enter-active, .drop-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
