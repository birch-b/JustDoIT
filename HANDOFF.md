# HANDOFF · 拍板大王 JUST DO IT

> 更新时间：2026-10-25　|　分支：`dev`　|　前后端同一仓库
> 一句话：帮纠结的人决定「做不做」。Vue3 前端 + NestJS 后端 + DeepSeek LLM。

---

## 0. 工程速览

| 项 | 内容 |
| --- | --- |
| 前端 | `src/` · Vue3 + Vite + Pinia + Tailwind + TS · **pnpm 10.19.0** |
| 后端 | `action-agent-nest/` · NestJS + TypeORM + MySQL · **npm** |
| 端口 | 前端 Vite（`/api` 代理到 `http://localhost:3000`）· 后端 `3000` |
| 依赖服务 | Redis（Docker `redis:7-alpine`，`127.0.0.1:6379`）、MySQL80 |
| 锁文件 | 根目录只留 `pnpm-lock.yaml`；后端保留 `action-agent-nest/package-lock.json` |

**启动顺序**：`docker ps` 确认 Redis → 后端 `npm run start:dev` → 前端 `pnpm dev`

**三条硬规则**

1. 改 `.env` 必须手动重启后端（watch 只监听 `.ts`）。
2. watch 增量编译失败会让 `dist` 残缺（报 `Cannot find module './app.module'`）→ 杀进程 + `Remove-Item -Recurse -Force dist` 再重启。
3. 3000 被旧进程占用会 `EADDRINUSE` → `Get-NetTCPConnection -LocalPort 3000` 找 PID 后 Stop-Process。

---

## 1. 功能状态

| 模块 | 状态 | 备注 |
| --- | --- | --- |
| 注册/登录（JWT，用户名或邮箱） | ✅ | 登录态存 `jdi_current_user`，24h 不活跃自动登出 |
| 邮箱验证码（注册/找回/注销） | ✅ | 已迁 Redis，TTL 5min |
| 用户资料 / 偏好 | ✅ | `PATCH /user/profile`、`PATCH /user/preference` |
| Agent 会话创建/列表/详情/历史/反馈/删除 | ✅ | 真实接口 |
| DeepSeek LLM 建议 | ✅ | 失败自动降级规则引擎 |
| 答案之书 / 塔罗牌 / 天气 | ✅ | 第三方失败有本地兜底 |
| 计划表待办 CRUD + 归档 | ✅ | 含「接受→执行」回写 |
| 完成打卡 + Agent 回应 | ✅ | `POST /todos/:id/reflect`，两阶段弹窗 |
| 定时「做了吗」询问（站内卡 + 邮件） | ✅ | cron 每分钟扫 + 前端 `checkinDueAt` 判断 |
| 记忆关键词 + 自我探索手册 | ✅ | 规则引擎 3.4 + LLM 提炼 3.5 + 手册 |
| 地点搜索 | ✅ | 百度 suggestion + 定位三级兜底 |
| 后台管理 `/admin` | ✅ | 仅 `role=admin` |
| 公告 / 意见反馈 / 访问统计 | ✅ | 公告后端化，铃铛拉接口 |
| 新手引导 / 偏好问卷 | ✅ | 注册后问卷 → 引导；随时可重开 |
| 部署安全加固 | ✅ | 字段级 AES-256-GCM + CORS 白名单 |

---

## 2. 功能模块

### 2.1 Agent 接口（`src/agent/`，除公开接口外均需 JWT）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/agent/session/create` | 建会话：存任务 → LLM/规则算建议 → 神秘加成 → 存会话 |
| GET | `/agent/sessions` | 历史列表（SQL 层 userId 过滤） |
| GET | `/agent/stats` | 统计聚合（会话数/执行数/接受率/模式分布/意愿vs完成） |
| GET | `/agent/session/:id` | 会话详情（校验归属） |
| GET | `/agent/history/:id` | 历史详情（会话+任务+反馈） |
| POST | `/agent/action/record` | 行为反馈 upsert；`withReply:true` 时二次调 LLM 生成回应 |
| DELETE | `/agent/session/:id` | 级联删：待办→反馈→会话→任务 |
| GET | `/agent/answer-book` | 公开，答案之书（uapis.cn） |
| POST | `/agent/tarot` | 公开，塔罗抽 1 张（妖狐 API + 本地兜底） |
| GET | `/agent/weather?city=武汉` | 公开，今日天气（whyta.cn），失败 `data:null` |
| GET | `/agent/cities` | 公开，省市两级联动（mxnzp，31 省 341 市，缓存 24h） |
| GET | `/agent/place-search?keyword=&lat=&lng=&city=` | 公开，地点联想（百度 suggestion） |

### 2.2 LLM 建议链路

**调用入口**

- `llm.service.ts` 是唯一调 DeepSeek 的地方，`response_format: json_object`。
- 超时/解析失败一律返回 `null`，不影响建会话主流程。
- 输出字段：`{ shouldGo, agentSuggestIndex, conclusion, persuadeMode, persuadeText, minAction }`。

**一致性**

- 后端强制 `shouldGo=true → 指数 ≥55`、`false → ≤45`，保证结论/指数/英文标题同向。
- 同类问题结论需与上一次一致，改口必须说明理由（最近一次会话注入 prompt）。

**劝说模式（3 选 1）**

| 模式 | 适用场景 |
| --- | --- |
| 激将 | 不想做但该做（意愿 ≤4 且重要度 ≥7） |
| 温柔 | 想做但做不动（精力 ≤4） |
| 理性 | 需要权衡决断 |

prompt 写明心理阻力判定标准 + 数值信号，并要求三种模式频率均衡。

**二选一模式（2026-10-25 新增）**

- 第 16 条规则：用户勾选「这是二选一」时，必须明确点选 A 或 B，禁止和稀泥。
- `persuadeText` 对比两选项差异，`minAction` 落到所选选项的第一步。
- 前端把 A/B 与倾向滑块拼进补充条件，强制结论选边。

**回答质量约束（system 第 4~7 条）**

- 【数据先行】禁止编造数字，展示计算过程。
- 【直接回答】问数量必须给具体数字。
- 【钱包约束】`walletScore ≤3` 建议金额 ≤ 缺口 1.5 倍；`≤2` 砍非必需项。
- 【结论一致性】见上。

**兜底与历史**

- 规则兜底 `computeAdviceByRule`：指数 = `will×7 + energy×3 + importance×2 − 10`（钳 5–98）；`<40` 激将、`40–69` 温柔、`≥70` 理性。
- 历史注入：`buildHistorySummary`（最近 50 会话：整体/同类执行率 + 跨维度规律 top3，样本 ≥2 且差 ≥25pp）**只进 prompt，不再展示给用户**。

**反馈二次对话**

- `withReply:true` 时把「原建议 + 用户态度 + 是否入表 + 评论」打包，LLM 按原模式口吻回 30~60 字。
- `chatText()` 纯文本不强制 JSON；纯聊天不写记忆，`agentReply` 永不进记忆提炼输入。

**纠结分类（10 类）**

`work / study / life / shopping / health / social / finance / relationship / family / other`

- 行为记忆关键词前缀取分类名前两字（如「财务听劝」），避免四字分类生成 6 字关键词超限。
- 同步点：前端 `TaskCategory` + 3 张中文映射表；后端 `agent.prompt.ts` / `behavior-memory.service.ts` / `llm-memory.service.ts` / `agent.service.ts`。

### 2.3 神秘加成

- **塔罗**：先抽牌（第三方失败本地随机兜底）→ 牌面注入 prompt → 主回答多返回 `tarotReading`（≤40 字，与结论同向）。
- **答案之书**：uapis.cn 原文照调照显（保留随机感）→ 原文注入 prompt → 主回答多返回 `answerBookReading`（把矛盾圆回结论）。
- **天气**：`weather.service.ts` 调 whyta.cn，task 的 `weatherCity/weatherText/weatherScore` 齐全才注入；低分共情降门槛、户外任务提示天气成本、纯室内不谈天气；无效 key 返回「这个城市的天气没查到…可直接生成」。
- 解读字段只在 LLM 成功路径有值；规则兜底时为 `null`，前端不显示解读行。

### 2.4 Memory + 自我探索

**接口**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/memory` | 全部记忆（`updatedAt` 倒序） |
| GET | `/memory/summary` | LLM 综合论述（2-3 句，30min 内容哈希缓存） |
| GET | `/memory/insight?refresh=1` | 探索手册（2~3 章场景叙事 + 开导 + 自问） |
| POST/PATCH/DELETE | `/memory[/:id]` | 手动增改删 |

**表结构 `user_memory`**

| 字段 | 说明 |
| --- | --- |
| `memory_type` | 记忆类型 |
| `content` | 内容 |
| `confidence` | 0~1 |
| `memory_key` | 可空，LLM upsert 键 |
| `keyword` | 可空，3-5 字汉字标签（统计页气泡用） |

**3.4 规则引擎（`behavior-memory.service.ts`）**

- 反馈后 `syncFromFeedback(userId, category)` 重算该类别：增/改/翻转/回收。
- 阈值：每类样本 ≥5 且 ≥4/5 同向（或 ≤1/5）才生成；样本不足 5 的旧关键词自动回收。
- 方案 A 放弃判定：有 deadline 按 deadline+2 天、否则反馈后 7 天，窗口内不进执行率分母。

**3.5 LLM 提炼（`llm-memory.service.ts`）**

- 反馈后异步 fire-and-forget，内存节流 10min。
- 门槛：攒够 10 条有反馈的会话才第一次调用，流水取最近 10 条。
- 校验：
  - `keyword` 必须匹配 `/^[一-龥]{3,5}$/`，不合法置 `null` 但不丢条。
  - 同 key 豁免 Dice 去重（否则老记忆永远改不了）。
  - 新 key 与已有记忆 Dice ≥0.6 丢弃。
  - 存量上限 12 条。
- 评论作为弱辅助证据（≥3 次同向才可用），绝不附 `agentReply`；偏好问卷作背景参照，须与行为互证。

**探索手册（2026-10-25 新增）**

- 门槛：5 条有反馈的纠结；快照存 Redis（180 天，连不上退内存），每 7 天自动重写。
- 手动「重新生成」10 分钟节流；输出超长自动裁剪。
- prompt 要求场景叙事 + 开导 + 自问，禁止罗列数据。

**删除语义**

- 删会话：规则受管记忆随重算回收；LLM 记忆（`memoryKey`）不删，用户可在关键词页手动删。

### 2.5 User / Todo

**User**

- 接口：`send-code` / `register`（注册即发 JWT）/ `login` / `reset-password` / `send-delete-code` / `delete-account` / `PATCH /user/profile` / `PATCH /user/preference`。
- 字段：`bio varchar(200)`、`preference simple-json`（可空）、`role varchar(10) default 'user'`。
- 验证码：ioredis + `REDIS_URL`，`SET key val EX 300`；启动探活失败即拒绝启动，不退回内存。
- `APP_URL`：邮件跳转站点地址，默认 `https://8.166.131.200`。
- `CORS_ORIGINS`：生产需包含前端域名。

**Todo 接口**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/todos` | 未归档（未完成 + 已完成） |
| GET | `/todos/archived` | 已归档 |
| POST | `/todos` | 新建，自动算 `checkinDueAt` |
| PATCH | `/todos/:id` | 更新（`done=true` 写 `completedAt`） |
| PATCH | `/todos/:id/archive` | 单条归档 |
| DELETE | `/todos/clear-done` | 批量归档全部已完成 |
| DELETE | `/todos/:id` | 移出计划表（物理删除） |
| POST | `/todos/:id/reflect` | 完成打卡 + Agent 回应 |
| POST | `/todos/:id/postpone` | 答「还没」顺延 |

**提醒规则（2026-10-25 调整）**

- 有截止时间：`checkinDueAt` = **截止时刻**（原为时长 1/3）。
- 无截止时间：`checkinDueAt` = 创建 + 24h。
- 顺延：有未来 DDL → 剩余时间 1/3；无 DDL 或已过 → +24h；最短 10min。
- 邮件：`TodoCheckinService` cron **每分钟**扫一次，条件 `done=false AND archived=false AND checkinDueAt <= NOW()`；同一轮只发一封（`lastCheckinAt >= checkinDueAt` 跳过）；启动 20s 预热补跑。
- 邮件按钮链接 `${APP_URL}/login?redirect=/`，已登录自动跳首页。

**Todo 字段**

- `reflectionComment text nullable`（加密）
- `reflectionReply text nullable`（加密）
- `checkinDueAt datetime nullable`
- `lastCheckinAt datetime nullable`

**action_record**

- `addToTodo tinyint default 0`：记录用户是否选择加入计划表。
- 会话详情据 5 种状态显示文案：待办在表中 / 已完成 / 已归档 / 已删除可重加 / 从未加入。

### 2.6 地点搜索

- 前端 `SketchPlacePicker.vue`：手绘风搜索框 + 奶米弹层 + 薄荷高亮，300ms 防抖，键盘上下/回车/Esc。
- 后端 `place.service.ts` 用百度 **`place/v2/suggestion`**（不要用 `place/v2/search`，全国时只返回城市统计），复用 `BAIDU_MAP_AK`，过滤空壳联想项。
- 三级兜底：
  1. 浏览器定位坐标 → `location=lat,lng&coordtype=wgs84ll`（按距离排序）。
  2. 无坐标 → localStorage `jdi_weather_city` → `region=该城市`。
  3. 都没有 → `region=全国`。

### 2.7 前端要点

**数据层**

- `http.ts` 的 `authRequest` 统一带 token，401 抛 `UnauthorizedError`。
- 网络错误自动重试两次（0.7s / 1.5s），最终失败显示「重新加载」，不再误判为空账号。
- `userStore`：JWT + user + `lastActiveAt` 存 `jdi_current_user`。

**页面**

| 页面 | 要点 |
| --- | --- |
| `Dashboard.vue` | 计划表 + 历史会话分类抽屉（默认全折叠）+ 管理模式批量删除；顶部「到点问问」卡 |
| `TaskCreate.vue` | 分类按钮 + 三滑块 + 耗时/截止/地点；神秘加成三开关；购物钱包面板；**二选一模式**；两个 `SketchTooltip` 提示 |
| `SessionResult.vue` | 标题「结果」；反馈区；按待办状态显示 5 种文案；已移除历史摘要 |
| `Stats.vue` | 墨圈气泡 + LLM 论述 + 五个统计板块（纯 SVG）+ 归档记录抽屉 |
| `MemoryKeywords.vue` | 「自我探索」页，关键词 / 探索手册双页切换（移动端可滑动） |
| `Register.vue` | 注册成功 → 偏好问卷（3 步）→ 新手引导 |
| `Login.vue` | 已登录访问 `/login` 自动跳 `redirect` |
| `NotFound.vue` | 404 手绘卡片 + 回首页；路由末尾 `/:pathMatch(.*)*` |

**新手引导**

- `OnboardingGuide.vue`：手绘卡片分步，小圆点分页 + 可跳过；首次进首页自动弹（`jdi_onboarded`）。
- `FloatingHelpButton.vue`：右侧悬浮「?」，随时重开。
- `SketchTooltip.vue`：18px 手绘 `?` 圆圈；桌面 hover、移动 click 切换、点外部关闭。

**完成打卡**

- `SketchReflectDialog` 两阶段：输入感受 → 提交后展示「我：评价」+「Agent：回应」。
- 2026-10-25 新增：打卡成功播放 10 秒五彩纸屑（`canvas-confetti`，尊重 reduced-motion）。

**手绘组件库**

`SketchBorder` / `LinearButton` / `SketchCheckbox` / `SketchClock` / `DecorDotCluster` / `DualTextBlock` / `PageWrapper` / `SketchSelect` / `SketchDatePicker` / `SketchPlacePicker` / `SketchConfirmDialog` / `SketchTooltip` / `SketchReflectDialog`

**全局约束**

- 全站无 `window.alert` / `window.confirm`：错误用行内错误条（`text-xs + border-sketch-line/40`），删除确认用 `SketchConfirmDialog`。
- 加载动画：Teleport 挂 body，全屏奶米底 95% 不透明，波点 18px 居中；最少 1.6s，返回后再停 0.8s。
- 2026-10-25 起页面统一中文单标题，`DualTextBlock` 不再渲染英文行。

### 2.8 后台管理

- **Admin 模块**（`src/admin/`）：`AdminGuard` 在 JwtAuthGuard 后校验 `user.role === 'admin'`。
- 接口：
  - `GET /api/admin/overview`：用户总数 / 总访问 / 今日访问 / 今日活跃 / 最近 20 活跃用户。
  - `GET /api/admin/feedbacks`：带用户名倒序 100 条。
  - 公告 CRUD `/api/admin/announcements`。
- **公告后端化**：`announcement` 表（`title/date/items simple-json/createdAt`）；`GET /api/announcements` 只返回最近 7 天。
- **访问统计**：`visit` 表（`userId` 可空 / `createdAt`）；`POST /api/track/visit` 用 `OptionalJwtGuard`；App.vue 每会话上报一次（`jdi_visited` 去重）。
- **Admin.vue**：统计卡片 + 活跃用户 + 反馈收集 + 公告管理；路由 `meta.requiresAdmin`；NavBar 仅管理员显示「管理」。
- 设置管理员：`UPDATE user SET role='admin' WHERE username='xxx';`

---

## 3. 变更日志（新的在上）

### 3.1 2026-10-25（当前工作区，未提交）

**新增**

- **二选一模式**：`TaskCreate` 新增「这是二选一」勾选，自动按「还是/或者」切 A/B，配 1~10 倾向滑块并实时显示倾向文字。
- **自我探索页**：`MemoryKeywords` 更名，新增「关键词 / 探索手册」双页切换与过渡动画。
- **探索手册**：后端 `GET /api/memory/insight` + `memory-insight.prompt.ts`，Redis 快照 180 天、7 天自动重写。
- **打卡纸屑**：`canvas-confetti` 10 秒动效。

**优化**

- 提醒规则：有 DDL 时 `checkinDueAt` 直接取截止时刻；cron 改为每分钟扫。
- 邮件扫描加日志，到点 1 分钟内送达。
- 金额字段支持两位小数（价格下限 0.01），影响 `itemPrice` / `walletBalance`。
- 记忆提炼 prompt 接入偏好问卷，要求与行为互相印证。
- `SessionResult` 标题改为「结果」，分类/截止改中文标签并格式化日期。
- `NoticeBell` 下拉面板贴铃铛右下，按视口收缩，窄屏不铺满。
- 全站去掉英文副标题与单位：`Dashboard` / `Stats` / `Profile` / `Admin` / `NotFound` / `OnboardingGuide` / `SketchClock` / `SketchNetworkGate` / `DualTextBlock`。

**修复**

- 二选一提交时结论和稀泥 → prompt 第 16 条强制选边。

### 3.2 2026-10-23

**新增**

- 邮件定时「做了吗」询问：`node-cron` + `APP_URL` 跳转链接。
- 完成打卡 Agent 回应：`POST /todos/:id/reflect` + 两阶段弹窗。
- 新手引导：4 步 `OnboardingGuide` + `FloatingHelpButton` + `SketchTooltip`。
- 纠结分类扩到 10 类（新增财务 / 情感 / 家庭）。

**修复**

- `FeedbackModule` / `AdminModule` 缺 `PassportModule.register({ defaultStrategy: 'jwt' })` → 补齐。
- `OptionalJwtGuard.handleRequest` 返回类型不兼容 → 改泛型签名。
- `dist` 残缺导致 `MODULE_NOT_FOUND` → 清空重编。
- `user.entity.ts` 补 `role` 列。

### 3.3 2026-10-22

- **后台管理 `/admin`**：统计概览、反馈列表、公告 CRUD，`AdminGuard` 守卫。
- **公告后端化**：`announcement` 表；前端硬编码公告文件删除，铃铛改拉接口；新增「清除全部」。
- **访问统计**：`visit` 表 + `POST /api/track/visit`。
- **小铃铛**：公告 + 意见反馈两个 tab；`feedback` 表（`userId/content/createdAt`），`POST /api/feedback` 需 JWT。
- **偏好问卷修复**：改由 App.vue 监听引导关闭后弹问卷（Register 卸载导致 watch 销毁）。

### 3.4 2026-10-21

- **偏好问卷**：`preference` 列（`interests/agonizeOver/decisionStyle/values/customNote`）+ `PATCH /user/preference`；`PreferenceQuestionnaire.vue` 3 步问卷；LLM prompt 注入【用户主动填写的偏好】。
- **404 兜底页**：`NotFound.vue` + 兜底路由。
- **打卡结果展示**：两阶段弹窗，评价与回应可回看。
- **引导补充**：第 4 步讲完成后的评价。

### 3.5 2026-10-07

- 站名定为「拍板大王」（NavBar + Dashboard）。
- 风格统一：alert 清零、原生 select 换 `SketchSelect`。
- 归档记录按分类再分抽屉，默认全折叠。
- 地点搜索上线（百度 suggestion + 三级兜底）。
- `DecorDotCluster` 卡死修复（确定性环形生成 / rAF 幂等 / `document.hidden` 暂停）。

### 3.6 2026-10-06

- 验证码迁 Redis（commit `6275d12`）。
- 字段级 AES-256-GCM 加密（`DATA_ENCRYPTION_KEY`，前缀 `enc:v1`，迁移 `npm run encrypt:data`）。
- CORS 收紧为 `CORS_ORIGINS` 白名单。
- 本地 Redis 容器与 MySQL 只绑回环地址。
- 待办：HTTPS、防火墙只开 22/80/443、生产关闭 `synchronize`。

### 3.7 2026-10-01

- `PATCH /user/profile`；`GET /agent/stats` SQL 聚合；`/sessions` 改 SQL 过滤。
- 关键词汇总页（墨圈气泡 + 记忆 CRUD）。
- 历史会话分类抽屉；「归档已完成」；删除改「移出计划表」。
- 购物钱包评估（`itemPrice/walletBalance/walletScore`，仅 shopping）。
- LLM 回答质量四条约束；反馈二次对话；接受先追问是否入表。

### 3.8 2026-09-29/30

- 天气加成（whyta + 城市映射 + 打分注入）。
- 塔罗/答案之书解读并入主 LLM 一次调用。
- `/memory/summary` 综合论述（30min 哈希缓存）。
- `user_memory` 加 `keyword`；3.5 Dice 去重豁免同 key。
- 天气自动定位；省市联动（341 城，24h 缓存）；`SketchSelect` / `SketchDatePicker`。
- 加载失败自动重试。

### 3.9 2026-09-15 ~ 09-23

- `949a271` / `eae085c` / `ab25930`：后端模块 + 前端页面 + 锁文件。
- `6900a5d`：DeepSeek 接入。
- `91caa89`：历史行为注入 prompt。
- `9f50839`：Memory 3.1-3.3。
- 登录 24h 滑动过期。

---

## 4. 已知限制

| 问题 | 状态 | 说明 |
| --- | --- | --- |
| ts-jest 单测全挂 | 已知限制 | 项目级 `rootDir` 配置问题，与业务无关 |
| 浏览器定位成功率低 | 已兜底 | 地点搜索三级兜底 |
| 服务器部署加固 | 待做 | HTTPS、防火墙、关闭 `synchronize` |
| 探索手册联调 | 待验证 | 依赖新接口，尚未实测 |

---

## 5. 踩坑记录

### 5.1 后端 / 数据库

1. **MySQL Access denied**：`.env` 密码是占位符 → 改真实密码。
2. **TEXT/BLOB 不能设 default** → `nullable: true`。
3. **`EADDRINUSE :::3000`**：查 PID 后 Stop-Process。
4. **改 `.env` 不生效**：watch 只监听 `.ts`，手动重启。
5. **TypeORM 回滚列遇外键（ER_DROP_INDEX_FK）**：按「删外键→删索引→删列→重建外键」处理。
6. **`isolatedModules` 装饰器类型导入（TS1272）**：entity 字段用 `string`，枚举只做运行时校验。
7. **ECONNREFUSED 排查顺序**：`docker ps`（Redis）→ `netstat :3000`（后端）；vite 代理报错＝后端没起，ioredis 报错＝Redis 没起。
8. **`dist` 残缺** → 清空重编，否则新进程抢不到 3000。
9. **模块用了 `JwtAuthGuard` 却没 import `PassportModule`** → 启动依赖解析失败，每个模块都要 `PassportModule.register({ defaultStrategy: 'jwt' })`。
10. **`OptionalJwtGuard.handleRequest` 返回类型 `{}` 不兼容** → 改泛型签名。

### 5.2 LLM / 第三方 API

11. **指数与结论打架** → 加 `shouldGo` 布尔并强制对齐 55/45。
12. **DeepSeek 不爱用激将** → 写清心理阻力类型 + 数值信号 + 频率均衡。
13. **结论摇摆 / 编造数字** → 数据先行、直接回答、钱包约束、结论一致性，并注入最近会话。
14. **随机神谕与结论打架** → 原文保留随机感，主 LLM 同次输出同向解读。
15. **whyta 天气结构与文档不符**：外层 `{status,message,data}`，`weatherDesc` 可能是 `[{value}]`；key 无效时 HTTP 200 + message 报错 → 两种结构都要兼容。
16. **Dice 去重必须豁免同 key**，否则老记忆无法改写。
17. **塔罗 API**：缘分居示例 key 是假的，最终用妖狐 API。
18. **百度 `place/v2/search` 全国搜不到门店** → 改用 `suggestion`，并过滤空壳回显项。
19. **LLM key 占位符含全角连字符 `‑`** → 换半角 `-`。

### 5.3 前端 / UI

20. **Vue 组件没 import**：渲染空白且无报错，`vue-tsc` 能查。
21. **401 必须主动清登录态跳登录**，不要当普通报错。
22. **原生控件风格割裂**：全站零原生弹窗零原生下拉；复用 `SketchSelect` / `SketchDatePicker` / `SketchPlacePicker` / `SketchConfirmDialog` / `SketchTooltip`，别新建重复组件。
23. **`SketchBorder` 宽卡片压线**：`preserveAspectRatio="none"` 会等比拉伸，宽卡片 padding ≥ `2rem 3rem`，气泡区 `3.5rem 4rem`，记忆卡片左 padding 44px。
24. **加载失败误显示空状态** → 自动重试 + 「重新加载」。
25. **散点图 y 轴刻度必须与层距同源**。
26. **`DecorDotCluster` 卡死四根因**：拒绝采样死循环 / 每帧改响应式数组 / ResizeObserver 自激 / rAF 泄漏。改完必做冒烟测试：DevTools CPU 4x slowdown，切路由 + 缩放窗口 10 秒。
27. **动画通用守则**：`markRaw` 或直接操作 DOM；加 `document.hidden` 与耗时预算守卫；参数 prop 在 watch 中 clamp。
28. **邮件跳转必须带 `/login?redirect=/`**，登录页已登录时要 `router.push(redirect)`。

### 5.4 工具链

29. **PowerShell**：不支持 `&&`（用 `;`）、curl 是别名（用 `curl.exe`）、commit 不能用 heredoc（多个 `-m`）、中文经请求体会变 `?`（用 node fetch）。
30. **pnpm 10 拦构建脚本**：esbuild / vue-demi 走可选依赖，无需 approve-builds。
31. **E2E**：注册要验证码，用 node 脚本直插 DB 造账号；`actualCostMin` 是必传整数；3.5 提炼 10min 节流，连续测试需重启后端。

---

## 6. 常用命令

```powershell
# 前端（d:\just do it，pnpm）
pnpm install
pnpm dev
pnpm vue-tsc --noEmit
pnpm build

# 后端（d:\just do it\action-agent-nest，npm）
npm install
npm run start:dev
npm test
npm run encrypt:data

# 本地依赖
docker ps

# 公开接口
irm "http://localhost:3000/api/agent/answer-book?question=test"
irm "http://localhost:3000/api/agent/tarot" -Method Post -ContentType "application/json" -Body '{}'
curl.exe -s "http://localhost:3000/api/agent/weather?city=武汉"
curl.exe -s "http://localhost:3000/api/agent/cities"
curl.exe -s "http://localhost:3000/api/agent/place-search?keyword=麦当劳&city=潮州"
curl.exe -s "http://localhost:3000/api/announcements"

# 受保护接口（先登录拿 token）
$h = @{ Authorization = "Bearer <token>" }
irm "http://localhost:3000/api/agent/sessions" -Headers $h
irm "http://localhost:3000/api/agent/stats" -Headers $h
irm "http://localhost:3000/api/memory" -Headers $h
irm "http://localhost:3000/api/memory/insight" -Headers $h
irm "http://localhost:3000/api/todos/archived" -Headers $h
irm "http://localhost:3000/api/admin/overview" -Headers $h

# Git（根目录操作）
git status
git add action-agent-nest/ src/
git commit -m "title" -m "body"
git push
```
