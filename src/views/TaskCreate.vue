<script setup lang="ts">
// 任务填写页 /task-create：任务表单录入（意愿、精力、任务参数）
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAgentStore } from "@/store/agentStore";
import { agentApi } from "@/api/agentApi";
import type { TaskCreateReq, TaskCategory, WeatherInfo } from "@/types";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchCheckbox from "@/components/sketch/SketchCheckbox.vue";
import SketchChip from "@/components/sketch/SketchChip.vue";
import DecorDotCluster from "@/components/sketch/DecorDotCluster.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";

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
});

const submitting = ref(false);
const errorMsg = ref("");

// ── 今日天气加成：勾选 → 选城市查询 → 展示实时天气 → 1-10 打分 ──
const WEATHER_CITY_KEY = "jdi_weather_city";
// 暂时用手动下拉选城市（与后端 weather.service.ts 的 CITY_MAP 保持一致；以后再接定位/搜索）
const WEATHER_CITIES = [
  "北京", "上海", "广州", "深圳", "天津", "重庆", "成都", "杭州", "南京", "武汉",
  "西安", "苏州", "郑州", "长沙", "青岛", "大连", "宁波", "厦门", "福州", "合肥",
  "南昌", "济南", "昆明", "贵阳", "南宁", "太原", "石家庄", "哈尔滨", "长春", "沈阳",
  "兰州", "海口", "三亚", "乌鲁木齐", "呼和浩特", "银川", "西宁", "拉萨",
  "无锡", "佛山", "东莞", "珠海", "温州",
];
const weatherCityInput = ref(localStorage.getItem(WEATHER_CITY_KEY) ?? "");
const weatherLoading = ref(false);
const weatherError = ref("");
const weatherInfo = ref<WeatherInfo | null>(null);

/** 查询天气（勾选时自动带出上次城市触发，或点查询按钮手动触发） */
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
      weatherInfo.value = null;
      form.weatherText = null;
      form.weatherCity = null;
      form.weatherScore = null;
      weatherError.value = "这个城市的天气没查到，换一个试试；也可以直接生成（不带天气）";
      return;
    }
    weatherInfo.value = info;
    // 城市存用户选择的中文名（接口返回的是英文拼音，回显不友好）；记住城市下次自动带出
    form.weatherCity = city;
    form.weatherText = info.summary;
    if (form.weatherScore === null) form.weatherScore = 6;
    localStorage.setItem(WEATHER_CITY_KEY, city);
  } finally {
    weatherLoading.value = false;
  }
}

/** 勾选/取消天气加成 */
function toggleWeather(on: boolean) {
  form.enableWeather = on;
  if (!on) {
    // 取消勾选只清当次天气数据，城市记忆保留，下次勾选免输入
    weatherInfo.value = null;
    weatherError.value = "";
    form.weatherCity = null;
    form.weatherText = null;
    form.weatherScore = null;
    return;
  }
  // 勾选：有记住的城市就自动查一次
  if (weatherCityInput.value.trim()) void queryWeather();
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
  try {
    // 创建会话：后端计算行动指数/劝说模式，并生成答案之书与塔罗牌
    // 补充条件未填写时传空字符串，后端视为无补充
    const payload = { ...form, extraContext: form.extraContext?.trim() ?? "" };
    const session = await store.createSession(payload);
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
  weatherInfo.value = null;
  weatherError.value = "";
  errorMsg.value = "";
}
</script>

<template>
  <PageWrapper title="新的一次纠结" subtitle="CREATE A NEW DECISION">
    <!-- 散落装饰：波点簇 + 手绘方框 -->
    <DecorDotCluster
      :count="24"
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

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-10">
      <!-- 左侧：主表单 -->
      <div class="lg:col-span-3">
        <SketchBorder padding="3rem">
          <form class="space-y-8" @submit.prevent="submit">
            <!-- 任务内容 -->
            <div>
              <DualTextBlock cn="任务内容" en="TASK CONTENT" size="sm" weight="normal" />
              <textarea
                v-model="form.taskContent"
                class="sketch-input mt-2 w-full resize-none"
                rows="2"
                placeholder="例如：完成项目周报并同步给团队"
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
                <input type="number" min="1" v-model.number="form.expectCostMin" class="sketch-input mt-2 w-full" placeholder="—" />
              </div>
              <div>
                <DualTextBlock cn="截止时间（可选）" en="DEADLINE (OPTIONAL)" size="sm" weight="normal" />
                <input type="datetime-local" v-model="form.deadline" class="sketch-input mt-2 w-full text-sketch-line" />
              </div>
              <div>
                <DualTextBlock cn="地点（可选）" en="LOCATION (OPTIONAL)" size="sm" weight="normal" />
                <input type="text" v-model="form.location" class="sketch-input mt-2 w-full" placeholder="公司 / 家" />
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

              <!-- 天气面板：选城市 → 实时天气 → 给天气打分 -->
              <div v-if="form.enableWeather" class="ml-8 mt-2 space-y-4 border border-sketch-line/30 px-5 py-4">
                <div class="max-w-xs">
                  <DualTextBlock cn="城市" en="CITY" size="sm" weight="normal" />
                  <select
                    v-model="weatherCityInput"
                    class="sketch-input mt-1 w-full bg-transparent"
                    @change="queryWeather"
                  >
                    <option value="" disabled>选个城市</option>
                    <option v-for="c in WEATHER_CITIES" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>

                <p v-if="weatherLoading" class="text-xs font-light text-sketch-lineSub">正在看天…</p>
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

      <!-- 右侧：说明装饰 -->
      <div class="lg:col-span-2 space-y-6">
        <SketchBorder padding="2rem">
          <DualTextBlock cn="如何填写" en="HOW TO FILL" size="md" weight="normal" />
          <ul class="mt-4 space-y-3 text-sm font-light text-sketch-lineSub">
            <li class="flex gap-2"><SketchCheckbox :size="14" decorative /><span>尊重内心去填写意愿与精力。</span></li>
            <li class="flex gap-2"><SketchCheckbox :size="14" decorative /><span>行动指数由 Agent 综合推算。</span></li>
            <li class="flex gap-2"><SketchCheckbox :size="14" decorative /><span>提交后将跳转结果页，可反馈真实行为。</span></li>
            <li class="flex gap-2"><SketchCheckbox :size="14" decorative /><span>适当选择不同因素的介入，也许会有意外的答复。</span></li>
          </ul>
        </SketchBorder>

        <div class="flex justify-center">
          <SketchCheckbox :size="120" :rotate="3" decorative />
        </div>
      </div>
    </div>
  </PageWrapper>
</template>
