# Vue3+TS｜线性极简艺术风前端完整方案（对标上面React版本）

> 完全对齐参考风格：**细线轮廓SVG、空心方框装饰、手绘时钟图形、中英对照文案、浅青碧底色、无大面积填充色块；全部SVG内联，不引入图片资源** 技术栈：Vue3 + TypeScript + Vite + TailwindCSS + Framer‑Motion‑Vue（线条动画）；项目为「今日行动师Agent」决策项目前端。

## 一、页面总数 & 页面清单（一共5个页面，和React版一一对应）

1. **首页 / 仪表盘 Dashboard**：总入口，历史会话卡片列表，新建决策按钮
2. **决策填写页 /task‑create**：任务表单录入（意愿、精力、任务参数），大量空心方框SVG装饰
3. **Agent结果页 /session/:id**【核心页面】渲染Agent输出，手绘时钟组件、中英对照文案、劝说模式、用户反馈按钮 ✅⭕❌
4. **历史记录详情页 /history/:id** 查看历史某次决策会话，展示当时结果+用户真实行为记录
5. **个人统计页 /stats**：行动数据可视化，纯SVG手绘线性图表

> 路由：Vue‑Router4；全局一套主题配色，PC横向布局，移动端自动纵向堆叠。

## 二、全局设计规范（颜色调浅，对标参考）

### 1. 颜色规范 tailwind.config.ts

| 用途            | 色值                       | 说明                               |
| ------------- | ------------------------ | -------------------------------- |
| 页面背景          | `#48bcb0`                | 浅青碧色，比原版绿色更浅                     |
| 线条、SVG描边、空心方框 | `#ffffff`                | 白色细线，`stroke‑width:1.2px`，只描边不填充 |
| 次要辅助文字        | `rgba(255,255,255,0.7)`  | 小号英文说明文本                         |
| hover交互蒙层     | `rgba(255,255,255,0.15)` | 悬浮微弱白色蒙层                         |
| 按钮边框          | `#ffffff`                | 只有描边，无背景填充，线性按钮                  |

> tailwind 配置片段

```
// tailwind.config.ts
import type { Config } from "tailwindcss";
export default {
  theme: {
    extend: {
      colors: {
        sketch: {
          bg: "#48bcb0",
          line: "#ffffff",
          lineSub: "rgba(255,255,255,0.7)",
          hover: "rgba(255,255,255,0.15)"
        }
      }
    }
  }
} satisfies Config;
```

### 2. 字体规范

- 中文：`Noto Sans SC`
- 英文：`Inter`
- 大标题：`font‑light`（字重300）
- 正文：`font‑light / font‑normal`（300‑400）
- 排版规则：**中文主文案在上，小号英文说明放在下方，中英对照布局**

### 3. 全局可复用公共组件（全部SFC单文件，SVG写在template内）

| 组件                   | 路径                                       | 作用                                         |
| -------------------- | ---------------------------------------- | ------------------------------------------ |
| `SketchClock.vue`    | `@/components/sketch/SketchClock.vue`    | 手绘缠绕时钟；入参`score(0‑100)`控制指针旋转角度，size控制画布大小 |
| `SketchCheckbox.vue` | `@/components/sketch/SketchCheckbox.vue` | 空心方框装饰组件，仅描边，可做装饰也可绑定v‑model               |
| `SketchBorder.vue`   | `@/components/sketch/SketchBorder.vue`   | 手绘不规则缠绕装饰边框SVG                             |
| `LinearButton.vue`   | `@/components/sketch/LinearButton.vue`   | 线性边框按钮，无背景填充，白色描边hover浮层                   |
| `DualTextBlock.vue`  | `@/components/sketch/DualTextBlock.vue`  | 中英对照文本块：主中文 + 小号英文说明                       |
| `PageWrapper.vue`    | `@/components/layout/PageWrapper.vue`    | 全局页面外壳，统一背景色、内边距                           |
| `NavBar.vue`         | `@/components/layout/NavBar.vue`         | 顶部导航栏                                      |

## 三、每个页面详细设计

### 📄页面1：首页 Dashboard `/`

**布局**

- 顶部：标题「今日行动师」，小字英文 *Today Action Agent*
- 中间：历史会话卡片列表，卡片为白色细描边；展示任务名称、行动指数、日期
- 悬浮主按钮：`<LinearButton>`【新建一次决策】跳转到 `/task‑create`
- 装饰：角落放缩小版 `<SketchClock>` 作为纯视觉装饰
- 空状态：无历史记录，展示手绘线条空状态插画

### 📄页面2：任务填写页 `/task‑create`

> 对标参考图大量空心方框排布 **表单字段** 任务内容、主观意愿滑块(1‑10)、精力滑块(1‑10)、重要度滑块(1‑10)、预计耗时、截止日期、地点、启用塔罗开关。

**视觉布局**

- 背景 `bg‑sketch‑bg`
- 页面散落多个 `<SketchCheckbox>`，部分仅做装饰，部分绑定表单v‑model
- 表单控件自定义：滑块轨道白色细线；输入框仅下边框，无填充背景
- 底部提交按钮；提交成功跳转 `/session/${sessionId}`

### 📄页面3：Agent结果页 `/session/:id`【核心页面】

PC布局：左侧大时钟SVG，右侧文案区域；移动端：时钟放顶部，文案垂直向下排布。

1. **左侧/顶部 `<SketchClock :score="agentSuggestIndex" :size="360"/>`**
   
   - 缠绕手绘环线；指针角度由后端返回行动指数控制；圆环四周散落`<SketchCheckbox>`装饰方框

2. **文案区域，使用 `<DualTextBlock>` 批量渲染**
   
   - 中文主结论：`去做 / 暂缓，今天不建议强行做` + 小号英文翻译
   - 劝说模式标签、劝说话术
   - 最小行动提示
   - 历史真实行为摘要展示块（中英对照）

3. **底部反馈操作区** 三个`<LinearButton>`
   
   > ✅我接受并完成｜⭕接受但未完成｜❌拒绝本次建议
   >  用户点击后弹出简易表单填写实际耗时、备注；调用接口提交`action_record`，提交后可跳转历史页面。

> SketchClock 入参ts声明

```
interface Props {
  score: number; // agentSuggestIndex 0‑100
  size: number; // svg画布像素大小
}
```

### 📄页面4：历史详情页 `/history/:id`

- 复用 `<SketchClock :score="xxx" :size="280"/>` 渲染该次会话行动指数
- 完整复现当时全部会话文案、劝说模式、历史摘要
- 明确展示**用户当时真实反馈记录**：是否执行、实际耗时、备注
- 保持全局中英对照、线性手绘风格统一

### 📄页面5：个人统计页 `/stats`

- 全部使用原生SVG手绘线条图表，不引入第三方图表库，保持风格统一
- 统计维度：历史任务执行率、各个劝说模式接受率分布、意愿分数‑完成率分布
- 页面四周散落`<SketchCheckbox>`小装饰方框

## 四、完整项目目录结构

```
src
├── assets                # 无图片资源，SVG全部写在组件template
├── components
│   ├── sketch            # 手绘线性组件
│   │   ├── SketchClock.vue
│   │   ├── SketchCheckbox.vue
│   │   ├── SketchBorder.vue
│   │   ├── LinearButton.vue
│   │   └── DualTextBlock.vue
│   └── layout            # 布局外壳
│       ├── PageWrapper.vue
│       └── NavBar.vue
├── views
│   ├── Dashboard.vue       # / 首页仪表盘
│   ├── TaskCreate.vue      # /task‑create 任务填写
│   ├── SessionResult.vue   # /session/:id Agent结果页
│   ├── HistoryDetail.vue   # /history/:id 历史详情
│   └── Stats.vue           # /stats 个人统计页
├── api
│   └── agentApi.ts         # 请求封装 createSession / submitActionRecord
├── types
│   └── index.ts            # TS接口定义
├── router
│   └── index.ts            # vue‑router4配置
├── store
│   └── agentStore.ts       # Pinia，mock阶段存储会话、历史
├── App.vue
└── main.ts
```

## 五、TS类型定义 `src/types/index.ts`（与Nest后端接口契约完全对齐）

```
// 创建任务请求体
export interface TaskCreateReq {
  taskContent: string;
  willScore: number;
  energyScore: number;
  importance: number;
  expectCostMin: number;
  deadline: string;
  location: string;
  enableTarot: boolean;
}

// Agent会话返回结果
export interface AgentSessionRes {
  sessionId: number;
  agentSuggestIndex: number;
  conclusion: string;
  persuadeMode: "温柔劝说模式" | "激将模式" | "理性分析模式" | "塔罗模式";
  persuadeText: string;
  minAction: string;
  taroCard?: string;
  historySummary: string;
}

// 用户提交行为反馈
export interface ActionRecordReq {
  sessionId: number;
  userAcceptSuggest: boolean;
  isExecute: boolean;
  actualCostMin: number;
  executeResult: string;
}
```

## 六、核心组件伪代码 SketchClock.vue

```
<template>
  <svg :width="size" :height="size" viewBox="0 0 400 400">
    <!-- 外圈手绘缠绕环线，只描边不填充 -->
    <path
      d="M200,40 C280,60 340,120 360,200 C330,290 260,350 200,360 C110,340 50,270 40,200 C70,110 130,55 200,40"
      fill="none"
      stroke="#ffffff"
      stroke‑width="1.2"
    />
    <!-- 基础刻度圆环 -->
    <circle cx="200" cy="200" r="150" fill="none" stroke="#ffffff" stroke‑width="1"/>
    <!-- 指针：分数映射为0‑360度旋转 -->
    <line
      x1="200" y1="200" x2="200" y2="70"
      stroke="#ffffff" stroke‑width="2"
      :transform="`rotate(${rotateDeg} 200 200)`"
    />
    <!-- 中心圆点 -->
    <circle cx="200" cy="200" r="4" fill="#ffffff"/>
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  score: number; // 0‑100
  size: number;
}
const props = defineProps<Props>();
const rotateDeg = computed(() => (props.score / 100) * 360);
</script>
```

## 七、动画方案（framer‑motion‑vue）

1. **时钟指针动画**：结果页面挂载后，指针从0度平滑转动到目标角度；
2. **装饰方框**：页面入场时方框逐个淡入；
3. **页面切换**：页面淡入淡出，风格安静克制，拒绝花哨动效。

> 安装依赖

```
npm install framer‑motion‑vue
```

## 八、接口对接流程

1. `/task‑create`收集表单`TaskCreateReq` → `POST /agent/session/create`拿到`AgentSessionRes`，携带`sessionId`跳转结果页。
2. `/session/:id`根据路由id拉取会话数据，渲染时钟（`score = agentSuggestIndex`）、中英对照文案、劝说模式。
3. 用户点击反馈按钮，调用`POST /agent/action/record`提交`ActionRecordReq`，保存真实行为。
4. `/history/:id`根据id拉取历史会话渲染。

> Mock模式：Pinia模拟后端返回，后端未完成即可完整演示全部页面交互；后端完成后关闭Mock，直接请求真实接口，页面逻辑无需改动。

## 九、迭代优先级

### V1（MVP优先实现）

- 5个页面骨架完成；基础手绘SVG组件`SketchClock`、`SketchCheckbox`、`LinearButton`完成；
- 任务填写页 + Agent结果页 + 历史详情页；mock模式跑通完整交互闭环；基础样式对齐视觉；动画可暂时简化。

### V2

- 接入framer‑motion‑vue，补全时钟入场、页面切换动画；完善`/stats`手绘SVG统计图表；完成移动端响应式适配。

### V3

- 开发塔罗展示组件；增加更多手绘装饰变体；增加主题切换（可以切换不同底色，不局限于青绿色）。

## 十、响应式适配

- PC端：结果页**横向布局**：时钟居左，文案居右；
- 移动端：全部改为纵向堆叠，时钟置于页面顶部，文案依次向下排布；SVG时钟根据屏幕宽度自动缩放。

# 
