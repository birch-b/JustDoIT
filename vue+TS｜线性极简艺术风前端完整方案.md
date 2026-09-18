# Vue3+TS｜线性极简艺术风前端完整方案

> 技术栈：Vue 3.5 + TypeScript + Vite 5 + Pinia 2 + Vue Router 4 + TailwindCSS 3
> 项目：「JUST DO IT · 今日行动师」决策辅助应用前端（已与 NestJS 后端真实联调）
> 更新时间：2026-09-18

## 一、项目定位与总体架构

帮助纠结的用户做「做不做」的决定：填写任务 → Agent 给出行动指数/劝说/最小行动 → 用户接受/拒绝 → 接受者加入计划表追踪完成情况 → 统计页聚合回顾。

- **仓库结构**：单 Git 仓库，前端在根目录、后端在 `action-agent-nest/` 子目录，共用 `.git`
- **包管理器**：前端 **pnpm 10.19.0**（根目录只留 `pnpm-lock.yaml`，根 `.gitignore` 已用 `/` 锚定忽略 `package-lock.json` 与 `yarn.lock`）；后端子工程仍用 npm
- **开发端口**：前端 Vite 5174，`/api` 代理到后端 3000
- **鉴权**：JWT Bearer，token 存 localStorage，`src/api/http.ts` Axios 拦截器统一注入 + 401 回登录
- **动画**：纯 CSS `transition` + `cubic-bezier`，未引入 framer-motion-vue（风格克制）

---

## 二、页面清单（8 页，对应 `src/views/`）

| 路由 | 组件 | 权限 | 说明 |
|---|---|---|---|
| `/` | Dashboard.vue | 公开 | 首页：计划表 + 历史会话卡片 |
| `/task-create` | TaskCreate.vue | 登录 | 任务表单 + 神秘加成开关 |
| `/session/:id` | SessionResult.vue | 登录 | 会话统一页（Agent 结果 + 历史 + 反馈 + 删除） |
| `/history/:id` | — | — | **已合并进 `/session/:id`**，旧链接 301 重定向 |
| `/stats` | Stats.vue | 登录 | 原生 SVG 统计图表 |
| `/login` | Login.vue | 公开 | 用户名或邮箱登录 |
| `/register` | Register.vue | 公开 | 注册（需邮箱验证码） |
| `/forgot-password` | ForgotPassword.vue | 公开 | 找回密码（邮箱验证码 + 重置） |
| `/profile` | Profile.vue | 登录 | 个人中心、注销账户（验证码） |

**路由守卫**（`router/index.ts`）：
- `requiresAuth` 未登录 → 跳 `/login?redirect=<原路径>`，登录后原路返回
- 已登录访问 login/register/forgot-password → 跳 `/profile`
- `/history/:id` → `redirect` 到 `/session/:id`
- `scrollBehavior` 每次回到顶部
- `afterEach` 设置文档标题

---

## 三、全局设计规范

### 1. 配色（`tailwind.config.ts`）

从早期「青碧底 + 白线」调整为更柔和的「**奶米底 + 深棕线 + 薄荷灰绿点缀**」：

| 用途 | Token | 色值 | 说明 |
|---|---|---|---|
| 页面背景 | `sketch.bg` | `#FFF2E1` | 奶米色 (255,242,225) |
| 主描边/文字 | `sketch.line` | `#634442` | 深棕 (99,68,66) |
| 次要文字 | `sketch.lineSub` | `rgba(99,68,66,0.65)` | 65% 透明深棕 |
| hover 浮层 | `sketch.hover` | `rgba(99,68,66,0.12)` | 12% 透明 |
| 点缀色 | `sketch.accent` | `#A9C8C2` | 薄荷灰绿 (169,200,194) |

边框统一 `borderWidth.sketch = 1.5px`，与 SVG `stroke-width: 1.8px` 风格一致。

### 2. 字体与字重

- 中文：`Noto Sans SC`；英文：`Inter`
- 字重整体偏粗：`light=500 / normal=600 / medium=700 / semibold=700`
- 中英对照排版：中文主文案在上，小号英文说明（`text-[12px]` + `tracking-widest`）在下

### 3. 全局可复用组件（`src/components/`）

**手绘线性组件**（`components/sketch/`，共 8 个）：

| 组件 | 作用 | 关键 props |
|---|---|---|
| `SketchClock.vue` | 手绘缠绕时钟，指针角度映射分数 | `score`(0-100)、`size`、`animated` |
| `SketchCheckbox.vue` | 空心方框勾选框，可装饰可绑定 | `modelValue`、`decorative`、`size`、`rotate` |
| `SketchBorder.vue` | 手绘不规则缠绕边框卡片 | `padding`（SVG 边框已向边缘收缩避免文字重叠） |
| `LinearButton.vue` | 贝塞尔波浪边框按钮，hover 薄荷绿 | `size`、`disabled` |
| `DualTextBlock.vue` | 中英对照文本块 | `cn`、`en`、`size`、`weight`、`highlight` |
| `DecorDotCluster.vue` | 随机波点装饰簇（引用 SketchDot） | `count`、`spread`、`safe-inset`、`hollow-ratio` |
| `SketchDot.vue` | 单个波点 | — |
| `SketchChip.vue` | 线性标签 chip | — |
| `EmailCodeInput.vue` | 邮箱验证码输入（注册/找回/注销共用） | — |

**布局外壳**（`components/layout/`，2 个）：

| 组件 | 作用 |
|---|---|
| `PageWrapper.vue` | 全局页面外壳，统一背景/内边距，`full` 模式供登录注册等无 NavBar 页 |
| `NavBar.vue` | 顶部导航栏，可收起/展开（汉堡→X 动画），登录后显示个人中心 + 退出 |

---

## 四、页面详细设计

### 页面 1：首页 Dashboard `/`

- 顶部：标题区 + 时钟装饰
- **我的计划表 TO DO LIST**：勾选完成（对勾 + 删除线 + 变淡），未完成优先展示，已完成折叠区可展开/取消/清除
  - 标题右侧实时显示 `X PENDING · Y DONE`
  - 勾选完成时回写 `ActionRecord.isExecute`，打通「接受→执行」链路
  - 首次登录时 localStorage 旧待办自动迁移到后端
- 下方：历史会话卡片列表（任务名 + 行动指数 + 日期 + 是否已反馈）
- 空状态：手绘线条空状态插画
- 主按钮：新建决策 → `/task-create`

### 页面 2：任务填写 `/task-create`

- **纠结分类按钮组**（work/study/life/shopping/health/social/other）
- **三滑块**：意愿 / 精力 / 重要度（1-10）
- 可选：预计耗时、截止日期、地点
- **神秘加成两开关**：答案之书（默认勾选）、塔罗牌单张（默认不勾），整行 label 可点
- 提交 → 调真实后端创建会话 + 答案之书/塔罗接口 → 跳 `/session/:id`
- 视觉：散落多个 `SketchCheckbox` 装饰，滑块轨道为白色细线，输入框仅下边框

### 页面 3：会话统一页 `/session/:id`【核心页面】

合并了原方案的「Agent 结果页 + 历史详情页」。

- **顶部**：小标题 + SESSION #ID · 时间 + 删除记录按钮（悬浮下划线与 NavBar 链接一致）
- **左侧**：大时钟 `<SketchClock :score="agentSuggestIndex" :size="320">` + 四周装饰方框 + ACTION INDEX 标签
- **右侧**：
  - 结论卡（`SketchBorder`）：中英对照结论（`agentSuggestIndex >= 50 ? GO FOR IT NOW : HOLD OFF TODAY`）+ 劝说模式 + 劝说文案
  - 答案之书：`「{{ answerBook }}」` 引用块（可选）
  - 塔罗牌：单张牌名 + 正逆位（可选）
  - 当时任务输入：任务内容 / 意愿·精力·重要度 / 预计耗时 / 分类·截止
  - 最小行动提示
  - 历史真实行为摘要（动态生成，同类任务 ≥3 条按同类统计，否则按整体执行率）
  - **你的决定与反馈**：
    - 未反馈：两个按钮 ✓ 我接受 / ✕ 我拒绝（接受 → 自动加入计划表）
    - 已反馈：回显接受/拒绝 + 执行状态 + 实际耗时 + 备注 + 计划状态
    - 接受后若待办被删，提供「重新加入计划表」按钮（重置执行状态）
- **删除记录**：级联删除任务输入/Agent 建议/反馈/对应待办，二次确认

### 页面 4：统计 `/stats`

- 全部原生 SVG 手绘线条图表，不引入图表库
- 维度：历史任务执行率、劝说模式接受率分布、意愿分数-完成率分布、分类分布
- 页面四周散落 `SketchCheckbox` 小装饰方框

### 页面 5：登录 `/login`

- 用户名或邮箱 + 密码登录
- 已登录访问自动跳 `/profile`
- 登录后按 `redirect` query 回跳原页面

### 页面 6：注册 `/register`

- 用户名 + 邮箱 + 邮箱验证码（QQ 邮箱 SMTP）+ 密码
- `EmailCodeInput` 组件统一处理验证码输入与 60 秒频控

### 页面 7：找回密码 `/forgot-password`

- 邮箱 + 验证码 + 新密码
- 验证码与注册验证码隔离（5 分钟有效）

### 页面 8：个人中心 `/profile`

- 展示用户信息
- 注销账户（需邮箱验证码二次确认）
- 退出登录（清 userStore + agentStore + 跳 `/login`）

---

## 五、目录结构

```
src
├── components
│   ├── sketch           # 手绘线性组件
│   │   ├── SketchClock.vue
│   │   ├── SketchCheckbox.vue
│   │   ├── SketchBorder.vue
│   │   ├── LinearButton.vue
│   │   ├── DualTextBlock.vue
│   │   ├── DecorDotCluster.vue
│   │   ├── SketchDot.vue
│   │   ├── SketchChip.vue
│   │   └── EmailCodeInput.vue
│   └── layout           # 布局外壳
│       ├── PageWrapper.vue
│       └── NavBar.vue
├── views                # 8 个页面（见上表）
│   ├── Dashboard.vue
│   ├── TaskCreate.vue
│   ├── SessionResult.vue
│   ├── Stats.vue
│   ├── Login.vue
│   ├── Register.vue
│   ├── ForgotPassword.vue
│   └── Profile.vue
├── api                  # 真实后端接口封装（mock 已全部移除）
│   ├── http.ts          # Axios 实例 + 拦截器（注入 token、401 回登录）
│   ├── userApi.ts       # 登录/注册/找回密码/验证码/注销
│   ├── agentApi.ts      # 会话 CRUD + 反馈 + 历史 + 答案之书/塔罗
│   └── todoApi.ts       # 计划表 CRUD
├── store                # Pinia
│   ├── userStore.ts     # 当前用户 + JWT + init/logout
│   ├── agentStore.ts    # 会话列表/详情/创建/反馈/删除
│   └── todoStore.ts     # 计划表 + loadTodos/add/update/toggle/clear
├── types
│   └── index.ts         # 与后端契约对齐的 TS 类型
├── router
│   └── index.ts         # 路由 + 守卫 + 重定向 + 标题
├── App.vue
└── main.ts
```

---

## 六、TS 类型契约（`src/types/index.ts`）

与 Nest 后端接口契约完全对齐，关键类型：

```ts
// 劝说模式
export type PersuadeMode =
  | "温柔劝说模式" | "激将模式" | "理性分析模式" | "塔罗模式";

// 纠结分类
export type TaskCategory =
  | "work" | "study" | "life" | "shopping"
  | "health" | "social" | "other";

// 创建任务请求体
export interface TaskCreateReq {
  taskContent: string;
  category: TaskCategory;
  willScore: number;
  energyScore: number;
  importance: number;
  expectCostMin?: number | null;
  deadline?: string | null;
  location: string;
  enableTarot: boolean;      // 塔罗牌（抽 1 张）
  enableAnswerBook: boolean; // 答案之书
}

// 待办项（计划表）
export interface TodoItem {
  id: number;
  taskContent: string;
  category: TaskCategory;
  deadline?: string | null;
  done: boolean;
  sessionId?: number | null;
  completedAt?: string | null;
  createdAt: string;
}

// Agent 会话返回结果
export interface AgentSessionRes {
  sessionId: number;
  agentSuggestIndex: number;
  conclusion: string;
  persuadeMode: PersuadeMode;
  persuadeText: string;
  minAction: string;
  taroCard?: string;
  tarotCards?: string[];   // 塔罗牌（单张，如 "愚人 · 正位"）
  answerBook?: string;     // 答案之书
  historySummary: string;  // 动态生成的历史摘要
}

// 用户行为反馈
export interface ActionRecordReq {
  sessionId: number;
  userAcceptSuggest: boolean;
  isExecute: boolean;
  actualCostMin: number;
  executeResult: string;
}

export interface ActionRecord extends ActionRecordReq {
  recordId: number;
  createdAt: string;
}

// 历史详情（会话页一次性加载）
export interface HistoryDetail {
  session: AgentSessionRes;
  task: TaskCreateReq;
  record: ActionRecord | null;
  createdAt: string;
}

// 首页列表条目
export interface SessionCardItem {
  sessionId: number;
  taskContent: string;
  agentSuggestIndex: number;
  conclusion: string;
  persuadeMode: PersuadeMode;
  createdAt: string;
  hasFeedback: boolean;
}

// 统计维度
export interface StatsData {
  totalSessions: number;
  executedCount: number;
  acceptRate: number;
  modeDistribution: Record<PersuadeMode, number>;
  willVsComplete: { willScore: number; completed: boolean }[];
}
```

---

## 七、数据流与接口对接

### Axios 实例（`src/api/http.ts`）

- 请求拦截器：自动注入 `Authorization: Bearer <token>`
- 响应拦截器：401 → 清 userStore + 跳 `/login?redirect=...`
- 统一错误抛出，组件层 `try/catch` 显示 message

### 状态管理（Pinia）

| Store | 职责 |
|---|---|
| `userStore` | `currentUser`、`token`、`isLoggedIn`、`init()`(从 localStorage 恢复)、`login/logout/register` |
| `agentStore` | `sessions[]`、`fetchHistory(id)`、`createSession(task)`、`submitRecord(req)`、`deleteSession(id)`、`getSessionWithTask(id)` |
| `todoStore` | `list[]`、`loadTodos()`、`addTodo/updateTodo/toggleTodo/removeTodo/clearDone`；`loaded` 标记避免重复加载 |

### 关键交互闭环

1. **决策闭环**：填表 → 创建会话 → 跳结果页 → 接受/拒绝 → 接受者入计划表
2. **执行回写**：首页勾选待办 → `toggleTodo` → 调 `submitRecord` 把 `isExecute=true` 回写 ActionRecord
3. **重新加入**：计划表删除后，结果页可「重新加入计划表」（重置 `isExecute=false`）
4. **删除记录**：`deleteSession` 级联删除任务输入/Agent 建议/反馈记录 + 关联待办
5. **历史摘要动态生成**：后端按用户真实数据计算（同类 ≥3 条按同类统计，否则按整体执行率）

---

## 八、响应式适配

- **PC**：结果页横向 `grid lg:grid-cols-3`，时钟居左（1 列），文案居右（2 列）
- **移动端**：`grid-cols-1`，时钟置顶，文案纵向堆叠，SVG 时钟按宽度自适应
- 导航栏：PC 展开菜单 + 收起按钮；移动端默认收起，汉堡切换

---

## 九、迭代优先级（当前进度）

### V1 ✅ 已完成

- 8 页面骨架与交互闭环
- 手绘 SVG 组件库（9 个 sketch + 2 个 layout）
- 真实后端联调（JWT + 邮箱验证码 + Agent 全接口 + Todo CRUD + 答案之书/塔罗）
- 计划表勾选回写 `isExecute`
- 路由守卫、重定向、标题切换
- 统计页原生 SVG 图表
- 删除记录、重新加入计划表
- pnpm 统一包管理 + vite build 通过

### V2（待办）

1. **接入 DeepSeek LLM**（最高优先）：行动指数/结论/劝说文案目前是规则计算，需替换为 LLM 生成
2. 个人资料更新接口
3. 统计聚合接口（目前前端基于会话列表计算）
4. 塔罗关键词/牌面图展示（后端已返回 `keywords`/`description`/`imageUrl`，前端只显示牌名 + 正逆位）
5. 验证码存储从内存换 Redis（部署前）

### V3（可选）

- 主题切换（不局限于奶米色）
- 更多手绘装饰变体
- 移动端进一步打磨

---

## 十、常用命令

```powershell
# 前端（d:\just do it，用 pnpm）
pnpm install
pnpm dev             # Vite，端口 5174，/api 代理到 3000
pnpm build           # vue-tsc 类型检查 + vite 构建
pnpm vue-tsc --noEmit # 仅类型检查

# 后端（d:\just do it\action-agent-nest，独立工程，用 npm）
npm install
npm run start:dev    # Nest，端口 3000，watch 模式（改 .env 需手动重启）
npm test
```

---

## 十一、踩过的坑（精简版）

1. **MySQL TEXT 列不能设 default**：`executeResult` 用 `default:''` 报错 → 改 `nullable: true`
2. **PowerShell 不支持 Linux curl 语法**：测试接口用 `irm`（Invoke-RestMethod）
3. **`Missing script start:dev`**：必须在 `action-agent-nest` 子目录跑（根目录只有 `dev/build/preview`）
4. **EADDRINUSE :::3000**：旧 dev server 拖留占端口，`Get-NetTCPConnection -LocalPort 3000` 找 PID → `Stop-Process -Id <pid> -Force`
5. **改 .env 后端不生效**：`nest start --watch` 只监听 .ts，改 .env 必须手动重启
6. **编辑器改 .env 未保存**：磁盘还是旧 key，排查半天其实是未保存
7. **塔罗 API**：缘分居示例 key 假的、试用账号不含解读接口 → 换妖狐 API（免费单张抽牌）
8. **Vue 组件模板用了但没 import**：Dashboard 用了 SketchCheckbox 没 import，渲染为空且无报错；`vue-tsc --noEmit` 能查出
9. **Vue 模板内联事件在 label 外点文字不生效**：勾选行包 `<label>` 后整行可点
10. **.env 全角连字符**：占位符 `LLM_API_KEY=sk‑xxxx` 里的 `‑` 是全角（U+2011），填真实 key 注意用半角 `-`
11. **SketchBorder 内容与边框重叠**：单调 padding 不够，需调整 SVG 元素位置（边框向边缘收缩）
12. **锁文件混用**（2026-09-17 解决）：前端根目录统一 pnpm，删 `package-lock.json` 并在根 `.gitignore` 用 `/` 锚定忽略（不影响后端 npm）；`package.json` 写 `packageManager: pnpm@10.19.0`
13. **pnpm 10 拦截 esbuild/vue-demi postinstall**：esbuild 走平台可选依赖、vue-demi 在 Vue3 自动适配，`vite build` 实测正常，无需 `pnpm approve-builds`
