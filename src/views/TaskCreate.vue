<script setup lang="ts">
// 任务填写页 /task-create：任务表单录入（意愿、精力、任务参数）
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAgentStore } from "@/store/agentStore";
import { agentApi } from "@/api/agentApi";
import type { TaskCreateReq, TaskCategory, WeatherInfo, CityGroup } from "@/types";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchCheckbox from "@/components/sketch/SketchCheckbox.vue";
import SketchChip from "@/components/sketch/SketchChip.vue";
import DecorDotCluster from "@/components/sketch/DecorDotCluster.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import SketchSelect from "@/components/sketch/SketchSelect.vue";
import SketchDatePicker from "@/components/sketch/SketchDatePicker.vue";
import SketchPlacePicker from "@/components/sketch/SketchPlacePicker.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import SketchThinkingDots from "@/components/sketch/SketchThinkingDots.vue";

const router = useRouter();
const store = useAgentStore();

const form = reactive<TaskCreateReq>({
  taskContent: "",
  category: "other",
  willScore: 6,
  energyScore: 6,
  importance: 6,
  expectCostMin: null,
  deadline: null,
  location: "",
  enableTarot: false,
  enableAnswerBook: true,
  extraContext: "",
  enableWeather: false,
  weatherCity: null,
  weatherText: null,
  weatherScore: null,
  itemPrice: null,
  walletBalance: null,
  walletScore: 6,
});

const submitting = ref(false);
const errorMsg = ref("");

// 「思考中」动画节奏：接口返回太快时至少展示 1.6s；返回慢时答案出来后再停留 0.8s，
// 避免加载动画一闪而过、用户感知不到
const THINKING_MIN_MS = 2000;
const THINKING_LINGER_MS = 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── 今日天气加成：勾选 → 省份/城市选择或📍自动定位 → 展示实时天气 → 1-10 打分 ──
const WEATHER_CITY_KEY = "jdi_weather_city";
// 全国城市接口失败时的兜底：单组常用城市（与后端 weather.service.ts 的 CITY_MAP 基本一致）
const FALLBACK_CITY_GROUPS: CityGroup[] = [{
  name: "常用城市",
  cities: [
    "北京", "上海", "广州", "深圳", "天津", "重庆", "成都", "杭州", "南京", "武汉",
    "西安", "苏州", "郑州", "长沙", "青岛", "大连", "宁波", "厦门", "福州", "合肥",
    "南昌", "济南", "昆明", "贵阳", "南宁", "太原", "石家庄", "哈尔滨", "长春", "沈阳",
    "兰州", "海口", "三亚", "乌鲁木齐", "呼和浩特", "银川", "西宁", "拉萨",
    "无锡", "佛山", "东莞", "珠海", "温州",
  ],
}];
const cityGroups = ref<CityGroup[]>(FALLBACK_CITY_GROUPS);
let cityGroupsLoaded = false;
const weatherProvinceInput = ref("");
const weatherCityInput = ref(localStorage.getItem(WEATHER_CITY_KEY) ?? "");
const weatherLoading = ref(false);
const locating = ref(false);
const weatherError = ref("");
const weatherInfo = ref<WeatherInfo | null>(null);

/** 当前选中省份下的城市列表 */
const currentCities = computed(
  () => cityGroups.value.find((g) => g.name === weatherProvinceInput.value)?.cities ?? [],
);

/** 下拉选项：label/value 一致（SketchSelect 需要对象形式） */
const provinceOptions = computed(() => cityGroups.value.map((g) => ({ label: g.name, value: g.name })));
const cityOptions = computed(() => currentCities.value.map((c) => ({ label: c, value: c })));

/** 拉一次全国城市列表（后端有 7 天缓存）；失败静默沿用内置兜底 */
async function ensureCityGroups() {
  if (cityGroupsLoaded) return;
  cityGroupsLoaded = true;
  const groups = await agentApi.fetchCityGroups();
  if (groups) cityGroups.value = groups;
}

/** 找城市所属省份名；不在任何分组返回空串 */
function findProvince(city: string): string {
  return cityGroups.value.find((g) => g.cities.includes(city))?.name ?? "";
}

/** 清空当次天气结果（不碰城市选择与 localStorage，方便重试） */
function clearWeather() {
  weatherInfo.value = null;
  weatherError.value = "";
  form.weatherCity = null;
  form.weatherText = null;
  form.weatherScore = null;
}

/** 应用一次成功的天气查询结果 */
function applyWeather(info: WeatherInfo, city: string) {
  weatherInfo.value = info;
  form.weatherCity = city;
  form.weatherText = info.summary;
  if (form.weatherScore === null) form.weatherScore = 6;
  localStorage.setItem(WEATHER_CITY_KEY, city);
}

/** 按城市查询天气（勾选时自动带出上次城市，或选完城市触发） */
async function queryWeather() {
  const city = weatherCityInput.value.trim();
  weatherError.value = "";
  if (!city) {
    weatherError.value = "先选个城市";
    return;
  }
  weatherLoading.value = true;
  try {
    const info = await agentApi.fetchWeather(city);
    if (!info) {
      clearWeather();
      weatherError.value = "这个城市的天气没查到，换一个试试；也可以直接生成（不带天气）";
      return;
    }
    applyWeather(info, city);
  } finally {
    weatherLoading.value = false;
  }
}

/** 换省份：旧城市与天气结果作废，等用户在新省份下选市 */
function onProvinceChange() {
  weatherCityInput.value = "";
  clearWeather();
}

/** 📍 自动定位：浏览器取经纬度(WGS84) → 后端百度逆地理转城市 → 查天气；返回是否成功 */
async function locateWeather(): Promise<boolean> {
  weatherError.value = "";
  if (!window.isSecureContext || typeof navigator === "undefined" || !navigator.geolocation) {
    weatherError.value = "当前环境不支持定位（需要 HTTPS），手动选个城市吧";
    return false;
  }
  locating.value = true;
  clearWeather();
  try {
    await ensureCityGroups();
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
      });
    });
    const info = await agentApi.fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
    if (!info || !info.city) {
      weatherError.value = "没定位到可用的城市天气，手动选一个吧；也可以直接生成（不带天气）";
      return false;
    }
    const city = info.city.trim();
    // 定位城市不在全国列表（少见，如自治州）时，动态补一个"定位城市"分组保证可回显
    let province = findProvince(city);
    if (!province) {
      cityGroups.value = [
        ...cityGroups.value.filter((g) => g.name !== "定位城市"),
        { name: "定位城市", cities: [city] },
      ];
      province = "定位城市";
    }
    weatherProvinceInput.value = province;
    weatherCityInput.value = city;
    applyWeather(info, city);
    return true;
  } catch (e) {
    const code = (e as GeolocationPositionError)?.code;
    weatherError.value = code === 1
      ? "你拒绝了定位授权，可以手动选择城市"
      : code === 2
        ? "暂时获取不到位置，可以手动选择城市"
        : code === 3
          ? "定位超时，再试一次或手动选择城市"
          : "定位失败，可以手动选择城市";
    return false;
  } finally {
    locating.value = false;
  }
}

/** 勾选/取消天气加成 */
async function toggleWeather(on: boolean) {
  form.enableWeather = on;
  if (!on) {
    // 取消勾选只清当次天气数据，城市记忆保留，下次勾选免输入
    clearWeather();
    return;
  }
  // 勾选：优先自动定位；失败（拒绝/超时/不支持）时回退记忆城市自动查一次，再不行才让用户手动选
  const ok = await locateWeather();
  if (!ok) {
    const remembered = weatherCityInput.value.trim();
    if (remembered) {
      weatherProvinceInput.value = findProvince(remembered);
      void queryWeather();
    }
  }
}

// 纠结分类选项
const categories: { value: TaskCategory; cn: string }[] = [
  { value: "work", cn: "工作" },
  { value: "study", cn: "学习" },
  { value: "life", cn: "生活琐事" },
  { value: "shopping", cn: "消费购物" },
  { value: "health", cn: "健康" },
  { value: "social", cn: "社交" },
  { value: "other", cn: "其他" },
];

// 页面散落装饰：手绘方框（波点由 DecorDotCluster 统一渲染）
interface BoxDeco {
  top: string;
  left?: string;
  right?: string;
  rotate?: number;
  size: number;
}
const decos: BoxDeco[] = [
  { top: "8%", left: "4%", rotate: -8, size: 36 },
  { top: "88%", left: "8%", rotate: 6, size: 24 },
];

async function submit() {
  errorMsg.value = "";
  if (!form.taskContent.trim()) {
    errorMsg.value = "请填写任务内容 / Please enter task content";
    return;
  }
  submitting.value = true;
  const startedAt = Date.now();
  try {
    // 创建会话：后端计算行动指数/劝说模式，并生成答案之书与塔罗牌
    // 补充条件未填写时传空字符串，后端视为无补充
    // 非购物分类不传钱包字段，避免误落库
    const payload: TaskCreateReq = {
      ...form,
      extraContext: form.extraContext?.trim() ?? "",
      itemPrice: form.category === "shopping" ? form.itemPrice ?? null : null,
      walletBalance: form.category === "shopping" ? form.walletBalance ?? null : null,
      walletScore: form.category === "shopping" ? form.walletScore ?? null : null,
    };
    const session = await store.createSession(payload);
    // 答案已返回：补足最短展示时长；响应慢时也再停留片刻，让动画被看见
    const elapsed = Date.now() - startedAt;
    await sleep(Math.max(THINKING_MIN_MS - elapsed, THINKING_LINGER_MS));
    router.push(`/session/${session.sessionId}`);
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}

function reset() {
  form.taskContent = "";
  form.category = "other";
  form.willScore = 6;
  form.energyScore = 6;
  form.importance = 6;
  form.expectCostMin = null;
  form.deadline = null;
  form.location = "";
  form.enableTarot = false;
  form.enableAnswerBook = true;
  form.extraContext = "";
  form.enableWeather = false;
  form.weatherCity = null;
  form.weatherText = null;
  form.weatherScore = null;
  form.itemPrice = null;
  form.walletBalance = null;
  form.walletScore = 6;
  weatherInfo.value = null;
  weatherError.value = "";
  errorMsg.value = "";
}
</script>

<template>
  <PageWrapper title="新的一次纠结" subtitle="CREATE A NEW DECISION">
    <!-- 散落装饰：波点簇 + 手绘方框 -->
    <DecorDotCluster
      :count="40"
      :spread="100"
      :safe-inset="60"
      :hollow-ratio="0.35"
    />
    <div
      v-for="(b, i) in decos"
      :key="i"
      class="pointer-events-none absolute"
      :style="{
        top: b.top,
        left: b.left,
        right: b.right,
      }"
    >
      <SketchCheckbox
        :size="b.size"
        :rotate="b.rotate"
        decorative
      />
    </div>

    <!-- Agent 思考中全屏遮罩：Teleport 到 body 居中展示，波点从小到大再从大到小波动 -->
    <Teleport to="body">
      <Transition name="thinking-fade">
        <div
          v-if="submitting"
          class="fixed inset-0 z-50 flex items-center justify-center bg-sketch-bg/95"
        >
          <SketchThinkingDots label="Agent 思考中" sub-label="THINKING" />
        </div>
      </Transition>
    </Teleport>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-10">
      <!-- 左侧：主表单（移动端排第二：先看指南再填） -->
      <div class="lg:col-span-3 order-2 lg:order-1">
        <!-- 响应式内边距：手机 1.5rem / 平板 3rem / 桌面 5rem，避免窄屏内容被压挤 -->
        <SketchBorder class="p-6 md:p-12 lg:p-20">
          <form class="space-y-8" @submit.prevent="submit">
            <!-- 任务内容 -->
            <div>
              <DualTextBlock cn="任务内容" en="TASK CONTENT" size="sm" weight="normal" />
              <textarea
                v-model="form.taskContent"
                class="sketch-input mt-2 w-full resize-none"
                rows="2"
              />
            </div>

            <!-- 纠结分类 -->
            <div>
              <DualTextBlock cn="纠结分类" en="CATEGORY" size="sm" weight="normal" />
              <div class="mt-3 flex flex-wrap gap-2">
                <SketchChip
                  v-for="c in categories"
                  :key="c.value"
                  :selected="form.category === c.value"
                  @click="form.category = c.value"
                >
                  {{ c.cn }}
                </SketchChip>
              </div>
            </div>

            <!-- 滑块组 -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div v-for="s in [
                { key: 'willScore', cn: '主观意愿', en: 'WILL' },
                { key: 'energyScore', cn: '你的精力', en: 'ENERGY' },
                { key: 'importance', cn: '重要度', en: 'IMPORTANCE' },
              ]" :key="s.key">
                <div class="flex items-baseline justify-between">
                  <DualTextBlock :cn="s.cn" :en="s.en" size="sm" weight="normal" />
                  <span class="text-lg font-light font-en">
                    {{ (form as any)[s.key] }}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  class="sketch-range mt-2"
                  v-model.number="(form as any)[s.key]"
                />
                <div class="flex justify-between text-[10px] text-sketch-lineSub font-en tracking-widest">
                  <span>LOW</span><span>HIGH</span>
                </div>
              </div>
            </div>

            <!-- 预计耗时 + 截止 + 地点（均可选，生活类纠结可留空） -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <DualTextBlock cn="预计耗时（可选）" en="COST (MIN, OPTIONAL)" size="sm" weight="normal" />
                <input type="number" min="1" v-model.number="form.expectCostMin" class="sketch-input mt-2 h-9 w-full" placeholder="—" />
              </div>
              <div>
                <DualTextBlock cn="截止时间（可选）" en="DEADLINE (OPTIONAL)" size="sm" weight="normal" />
                <SketchDatePicker v-model="form.deadline"  class="mt-2" />
              </div>
              <div>
                <DualTextBlock cn="地点（可选）" en="LOCATION (OPTIONAL)" size="sm" weight="normal" />
                <SketchPlacePicker v-model="form.location" class="mt-2" />
              </div>
            </div>

            <!-- 消费购物·钱包评估：价格/余额算占比 + 宽裕度滑块 -->
            <div v-if="form.category === 'shopping'" class="space-y-4">
              <DualTextBlock cn="钱包评估" en="WALLET CHECK" size="sm" weight="normal" />
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <DualTextBlock cn="商品价格（元，可选）" en="ITEM PRICE" size="sm" weight="normal" />
                  <input
                    type="number"
                    min="1"
                    v-model.number="form.itemPrice"
                    class="sketch-input mt-2 w-full"
                  />
                </div>
                <div>
                  <DualTextBlock cn="钱包余额（元，可选）" en="WALLET BALANCE" size="sm" weight="normal" />
                  <input
                    type="number"
                    min="0"
                    v-model.number="form.walletBalance"
                    class="sketch-input mt-2 w-full"
                  />
                </div>
              </div>
              <p v-if="form.itemPrice && form.walletBalance && form.walletBalance > 0" class="text-sm font-light text-sketch-lineSub">
                这笔消费约占钱包余额的
                <span class="text-sketch-accent">{{ ((form.itemPrice / form.walletBalance) * 100).toFixed(1) }}%</span>
              </p>
              <div>
                <div class="flex items-baseline justify-between">
                  <DualTextBlock cn="钱包宽裕度" en="WALLET ROOM" size="sm" weight="normal" />
                  <span class="text-lg font-light font-en">{{ form.walletScore }}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  class="sketch-range mt-2"
                  v-model.number="form.walletScore"
                />
                <div class="flex justify-between text-[10px] text-sketch-lineSub font-en tracking-widest">
                  <span>吃紧</span><span>宽裕</span>
                </div>
              </div>
            </div>

            <!-- 神秘加成：答案之书 / 塔罗牌（单张） / 今日天气 -->
            <div class="space-y-3">
              <label class="flex items-center gap-3 cursor-pointer select-none">
                <SketchCheckbox v-model="form.enableAnswerBook" :size="22" />
                <DualTextBlock cn="答案之书（随机一句神谕）" en="ANSWER BOOK" size="sm" weight="normal" />
              </label>
              <label class="flex items-center gap-3 cursor-pointer select-none">
                <SketchCheckbox v-model="form.enableTarot" :size="22" />
                <DualTextBlock cn="塔罗牌（抽 1 张）" en="TAROT" size="sm" weight="normal" />
              </label>
              <label class="flex items-center gap-3 cursor-pointer select-none">
                <SketchCheckbox :model-value="form.enableWeather" :size="22" @update:model-value="toggleWeather" />
                <DualTextBlock cn="今日天气（看看天再决定）" en="TODAY'S WEATHER" size="sm" weight="normal" />
              </label>

              <!-- 天气面板：省份/城市选择或自动定位 → 实时天气 → 给天气打分 -->
              <div v-if="form.enableWeather" class="ml-8 mt-2 space-y-4 border border-sketch-line/30 px-5 py-4">
                <div class="flex flex-wrap items-end gap-x-4 gap-y-3">
                  <div class="w-32">
                    <DualTextBlock cn="省份" en="PROVINCE" size="sm" weight="normal" />
                    <SketchSelect
                      v-model="weatherProvinceInput"
                      :options="provinceOptions"
                      placeholder="选省份"
                      class="mt-1"
                      @select="onProvinceChange"
                    />
                  </div>
                  <div class="w-32">
                    <DualTextBlock cn="城市" en="CITY" size="sm" weight="normal" />
                    <SketchSelect
                      v-model="weatherCityInput"
                      :options="cityOptions"
                      :placeholder="weatherProvinceInput ? '选城市' : '先选省份'"
                      :disabled="!weatherProvinceInput"
                      class="mt-1"
                      @select="queryWeather"
                    />
                  </div>
                  <button
                    type="button"
                    class="pb-1 text-xs font-light text-sketch-lineSub underline decoration-sketch-line/40 underline-offset-4 transition-colors hover:text-sketch-line disabled:opacity-50"
                    :disabled="locating"
                    @click="locateWeather"
                  >
                    {{ locating ? "定位中…" : "📍 自动定位" }}
                  </button>
                </div>

                <p v-if="locating" class="text-xs font-light text-sketch-lineSub">正在看你在哪片天空下…</p>
                <p v-else-if="weatherLoading" class="text-xs font-light text-sketch-lineSub">正在看天…</p>
                <p v-else-if="weatherError" class="text-xs font-light text-sketch-line leading-relaxed">
                  {{ weatherError }}
                </p>

                <!-- 天气卡 + 打分 -->
                <template v-if="weatherInfo">
                  <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span class="text-lg font-light">{{ weatherInfo.weatherDesc }}</span>
                    <span class="text-sm font-light font-en">{{ weatherInfo.tempC }}°C</span>
                    <span class="text-xs font-light text-sketch-lineSub font-en">
                      体感 {{ weatherInfo.feelsLikeC }}°C
                    </span>
                    <span v-if="weatherInfo.humidity" class="text-xs font-light text-sketch-lineSub">
                      湿度 {{ weatherInfo.humidity }}%
                    </span>
                    <span v-if="weatherInfo.windText" class="text-xs font-light text-sketch-lineSub">
                      {{ weatherInfo.windText }}
                    </span>
                  </div>
                  <div>
                    <div class="flex items-baseline justify-between">
                      <DualTextBlock cn="给今天天气打个分" en="WEATHER MOOD" size="sm" weight="normal" />
                      <span class="text-lg font-light font-en">{{ form.weatherScore }}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      class="sketch-range mt-2"
                      v-model.number="form.weatherScore"
                    />
                    <div class="flex justify-between text-[10px] text-sketch-lineSub font-en tracking-widest">
                      <span>讨厌</span><span>一般</span><span>舒服</span>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <!-- 补充条件（可选）：一句话描述不全时补充背景或约束，留空即为无补充 -->
            <div>
              <DualTextBlock cn="补充条件（可选）" en="EXTRA CONTEXT (OPTIONAL)" size="sm" weight="normal" />
              <textarea
                v-model="form.extraContext"
                class="sketch-input mt-2 w-full resize-none"
                rows="2"
                maxlength="500"
              />
            </div>

            <!-- 错误提示 -->
            <p v-if="errorMsg" class="text-xs text-sketch-line border border-sketch-line/40 px-3 py-2">
              {{ errorMsg }}
            </p>

            <!-- 操作区（不再使用顶部分隔线：补充条件输入框自带下划线，多一条横线会被误以为还能填写） -->
            <div class="flex flex-wrap gap-3 pt-6">
              <LinearButton type="submit" size="lg" :disabled="submitting">
                <span>{{ submitting ? "生成中…" : "生成行动建议" }}</span>
              </LinearButton>
              <LinearButton type="button" size="lg" @click="reset">
                <span>重置</span>
              </LinearButton>
              <LinearButton type="button" size="lg" @click="router.push('/')">
                <span>取消</span>
              </LinearButton>
            </div>
          </form>
        </SketchBorder>
      </div>

      <!-- 右侧：说明装饰（移动端排第一，指南先展示） -->
      <div class="lg:col-span-2 order-1 lg:order-2 space-y-6">
        <SketchBorder padding="2rem">
          <DualTextBlock cn="如何填写" en="HOW TO FILL" size="md" weight="normal" />
          <ul class="mt-4 space-y-3 text-sm font-light text-sketch-lineSub">
            <li class="flex gap-2"><SketchCheckbox :size="14" decorative /><span>尊重内心去填写意愿与精力。</span></li>
            <li class="flex gap-2"><SketchCheckbox :size="14" decorative /><span>行动指数由 Agent 综合推算。</span></li>
            <li class="flex gap-2"><SketchCheckbox :size="14" decorative /><span>提交后将跳转结果页，可反馈真实行为。</span></li>
            <li class="flex gap-2"><SketchCheckbox :size="14" decorative /><span>适当选择不同因素的介入，也许会有意外的答复。</span></li>
          </ul>
        </SketchBorder>

        <div class="hidden lg:flex justify-center">
          <SketchCheckbox :size="120" :rotate="3" decorative />
        </div>
      </div>
    </div>
  </PageWrapper>
</template>

<style scoped>
.thinking-fade-enter-active,
.thinking-fade-leave-active {
  transition: opacity 0.25s ease;
}
.thinking-fade-enter-from,
.thinking-fade-leave-to {
  opacity: 0;
}
</style>
