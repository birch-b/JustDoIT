# HANDOFF - 拍板大王 JUST DO IT 交接文档

> 更新时间：2026-10-23

决策辅助应用：帮纠结的用户做「做不做」的决定。Vue3 前端 + NestJS 后端（DeepSeek LLM 生成行动建议 + 答案之书/塔罗牌/天气等神秘加成）。



## 0. 工程结构

- 前端：`d:\just do it\src`（Vue3 + Vite + Pinia + Tailwind + TypeScript），**包管理器 pnpm 10.19.0**
- 后端：`d:\just do it\action-agent-nest`（NestJS + TypeORM + MySQL），**包管理器 npm**
- 同一个 Git 仓库（分支 `dev`），前端在根目录、后端在 `action-agent-nest/` 子目录
- ⚠️ 锁文件治理（2026-09-17）：根目录只留 `pnpm-lock.yaml`（`/package-lock.json`、`/yarn.lock` 被根 `.gitignore` 锚定忽略）；后端 `action-agent-nest/package-lock.json` 正常保留
- 前端 `/api` 由 Vite 代理到 `http://localhost:3000`

---

## 一、当前总体状态

**前后端主链路全部打通，无 mock 依赖（神秘加成公开接口失败时有本地兜底）。**

| 模块                                    | 状态                                                    |
| ------------------------------------- | ----------------------------------------------------- |
| 用户注册/登录（JWT，用户名或邮箱均可）                 | ✅ 真实接口                                                |
| 邮箱验证码（注册/找回密码/注销，QQ 邮箱 SMTP）          | ✅ **已迁移 Redis**（TTL 5min，2026-10-06，commit `6275d12`） |
| 用户资料更新（username/email/bio）            | ✅ `PATCH /user/profile`                               |
| Agent 会话创建/列表/详情/历史/反馈/删除             | ✅ 真实接口                                                |
| 统计聚合                                  | ✅ `GET /agent/stats`，SQL 层聚合                          |
| 计划表待办 CRUD + 归档 + 「接受→执行」回写           | ✅ 真实接口                                                |
| **完成打卡 + Agent 回应**（两阶段弹窗）               | ✅ `POST /todos/:id/reflect`，见 §2.5                      |
| **定时「做了吗」询问**（站内卡 + 邮件）              | ✅ node-cron 每 30 分钟扫 + 前端 checkinDueAt 判断，见 §2.5  |
| 答案之书 / 塔罗牌（含 LLM 同向解读）                | ✅ 第三方接口，失败本地兜底                                        |
| 今日天气（省市联动/📍定位 → 天气 + 打分 → 注入 prompt） | ✅ whyta.cn + mxnzp + 百度地图                             |
| 消费购物钱包评估（价格/余额/宽裕度 → prompt）          | ✅ 仅 shopping 分类                                       |
| **地点搜索**（百度 POI 联想 + 定位三级兜底）          | ✅ 2026-10-07 新增，见 §2.6                                |
| 记忆综合论述（统计页 LLM 整体画像）                  | ✅ `/memory/summary`，30min 缓存                          |
| 关键词汇总页（记忆 CRUD）                       | ✅ `/keywords`                                         |
| 历史会话/已完成待办/归档记录分类折叠抽屉                 | ✅ 默认全折叠                                               |
| DeepSeek LLM 建议                       | ✅ 失败自动降级规则引擎                                          |
| 用户长期记忆 Memory                         | ✅ 表 + CRUD + Prompt 注入 + 规则更新(3.4) + LLM 提炼(3.5)      |
| **新手引导**（4 步 Onboarding + 悬浮帮助按钮 + SketchTooltip） | ✅ 2026-10-22 新增                                    |
| 部署安全加固                                | ✅ 字段级加密 + CORS 白名单 + 本地服务绑 127.0.0.1（2026-10-06）      |
| **后台管理 `/admin`**（仅 role=admin）          | ✅ 2026-10-22 新增，见 §2.8                                |

⚠️ 后端在 `action-agent-nest` 目录执行 `npm run start:dev`（端口 3000）。改 `.env` 必须手动重启（watch 只监听 .ts）。**启动前若 3000 端口被旧 dist/main 进程占着会 EADDRINUSE，且 dist 目录残缺会导致 MODULE_NOT_FOUND（app.module 缺失）——先 Stop-Process 再 `Remove-Item -Recurse -Force dist`**。

---

## 二、功能模块详解

### 2.1 后端 Agent 模块（`src/agent/`，除公开接口外均需 JWT）

| 方法     | 路径                                             | 说明                                                                           |
| ------ | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| POST   | `/agent/session/create`                        | 创建会话：存任务 → LLM/规则算建议 → 神秘加成 → 存会话                                            |
| GET    | `/agent/sessions`                              | 历史列表（SQL 层 userId 过滤）                                                        |
| GET    | `/agent/stats`                                 | 统计聚合（totalSessions/executedCount/acceptRate/modeDistribution/willVsComplete） |
| GET    | `/agent/session/:id`                           | 会话详情（校验归属）                                                                   |
| GET    | `/agent/history/:id`                           | 历史详情（会话+任务+反馈）                                                               |
| POST   | `/agent/action/record`                         | 行为反馈 upsert；`withReply:true` 时二次调 LLM 生成 Agent 回应                            |
| DELETE | `/agent/session/:id`                           | 删除会话：级联删 待办→反馈→会话→任务                                                         |
| GET    | `/agent/answer-book`                           | 公开，答案之书（uapis.cn）                                                            |
| POST   | `/agent/tarot`                                 | 公开，塔罗抽 1 张（妖狐 API + 本地兜底牌面）                                                  |
| GET    | `/agent/weather?city=武汉`                       | 公开，今日天气（whyta.cn），失败 data:null                                               |
| GET    | `/agent/cities`                                | 公开，全国省/市两级联动（mxnzp，31省341市，内存缓存 24h）                                         |
| GET    | `/agent/place-search?keyword=&lat=&lng=&city=` | 公开，地点搜索（百度 suggestion），见 §2.6                                                |

### 2.2 LLM 建议链路（DeepSeek，2026-09-18 接入）

- `llm.service.ts`：唯一调 DeepSeek 的入口，`response_format: json_object`；超时/解析失败一律返回 `null`，**不影响建会话主流程**
- `agent.prompt.ts`：`buildSystemPrompt()` + `buildUserPrompt()`；返回 JSON：`{ shouldGo, agentSuggestIndex, conclusion, persuadeMode, persuadeText, minAction }`
- **方向一致性对齐**：后端强制 `shouldGo=true→指数≥55`、`false→≤45`，保证中文结论/指数/英文标题三者同向
- **劝说模式 3 选 1**（塔罗模式已删）：激将＝不想做但该做（意愿≤4且重要度≥7）；温柔＝想做但做不动（精力≤4）；理性＝需权衡决断。prompt 写明心理阻力判定标准 + 要求三模式频率均衡
- **回答质量约束**（2026-10-01，system 第 4~7 条）：【数据先行】严禁编造数字/估算展示计算过程；【直接回答】问数量必须给数字；【钱包约束】walletScore≤3 建议金额≤缺口1.5倍、≤2 砍非必需项；【结论一致性】同类问题方向与上次一致（最近一次会话注入 prompt），改口需说明理由
- **规则兜底** `computeAdviceByRule`：指数 = will×7 + energy×3 + importance×2 − 10（钳 5–98）；<40 激将、40–69 温柔、≥70 理性
- **历史注入**（2026-09-19）：`createSession` 先算 `buildHistorySummary`（最近50会话：整体/同类执行率 + 跨维度行为规律 top3，防噪声：样本≥2且差≥25pp），注入 prompt【用户历史行为】段。该函数照常运行但**仅用于 prompt，不再向用户展示**（2026-10 起 SessionResult 已移除历史摘要区块、getSessions/getHistory 不再返回 historySummary）
- **反馈二次对话**：`withReply:true` 时把原建议+用户态度+是否入表+评论打包，LLM 按原模式口吻回 30~60 字一句话；`chatText()` 纯文本不强制 JSON。**纯聊天不写记忆，agentReply 永不进记忆提炼输入**（防自我强化）
- **纠结分类扩展**（2026-10-22）：work/study/life/shopping/health/social/**finance/relationship/family**/other，共 10 类。行为记忆关键词前缀取分类名前两字（如「财务听劝」），避免四字分类生成 6 字关键词超限。同步修改：前端 `TaskCategory` 类型 + 3 个中文映射表；后端 `agent.prompt.ts` / `behavior-memory.service.ts` / `llm-memory.service.ts` / `agent.service.ts` 四处 CATEGORY_LABEL。

### 2.3 神秘加成（全部在 createSession 主 LLM 调用前后处理）

- **塔罗**：先抽牌（第三方失败本地随机兜底）→ 牌面注入 prompt → 主回答多返回 `tarotReading`（≤40字，与结论同向）
- **答案之书**：uapis.cn 随机原文**照调照显**（保留随机感）→ 原文注入 prompt → 主回答多返回 `answerBookReading`（顺着意象把矛盾圆回结论，禁止承认矛盾）
- **今日天气**：`weather.service.ts` 调 whyta.cn（内置中文城市→英文映射、风向映射；兼容 `weatherDesc` 字符串/`[{value}]` 数组两种结构）。task 的 `weatherCity/weatherText/weatherScore` 齐全才注入 prompt。低分共情降门槛、户外任务提示天气成本、纯室内不强行谈天气。无效 key 时返回用户友好文案「这个城市的天气没查到…可直接生成」
- 解读字段只在 LLM 成功路径有值；规则兜底时为 null，前端不显示解读行（塔罗解读失败静默置空不阻塞会话）

### 2.4 Memory 模块（`src/memory/`，需 JWT + 归属校验）

| 方法                | 路径                | 说明                               |
| ----------------- | ----------------- | -------------------------------- |
| GET               | `/memory`         | 全部记忆（updatedAt 倒序）               |
| GET               | `/memory/summary` | LLM 综合论述（2-3 句整体画像，30min 内容哈希缓存） |
| POST/PATCH/DELETE | `/memory[/:id]`   | 手动增改删                            |

- **表**：`user_memory`（memory_type / content / confidence 0~1 / memory_key 可空=LLM upsert 键 / keyword varchar(10) 可空=3-5字汉字标签）
- **3.4 规则引擎**（`behavior-memory.service.ts`）：反馈后 `syncFromFeedback(userId, category)` 重算该类别 → 增/改/翻转/回收受管模板记忆（关键词带类别前缀防碰撞，如「工作听劝」）。阈值：**每类样本 ≥5 且 ≥4/5 同向（或 ≤1/5）才生成**；样本不足 5 的类别旧关键词自动回收。方案 A 放弃判定：有 deadline 按 deadline+2天、否则反馈后 7 天，窗口内不进执行率分母
- **3.5 LLM 提炼**（`llm-memory.service.ts`）：反馈后异步 fire-and-forget，内存节流 10min；**攒够 10 条有反馈的会话才第一次调 LLM**，行为流水取最近 10 条。输出硬校验：keyword 须匹配 `/^[一-龥]{3,5}$/`（不合法置 null 不丢条）、同 key 豁免 Dice 去重（否则老记忆永远无法被改写）、新 key 与已有记忆 Dice ≥0.6 丢弃。存量上限 12 条
- 评论入流水：`留言:xxx` 截断 60 字，弱辅助证据（≥3 次同向才可用），**绝不附 agentReply**
- 删会话：规则受管记忆随重算回收；LLM 记忆（memoryKey）与会话无绑定不删，用户可在关键词页手动删

### 2.5 User/Todo 模块

- User：`send-code`/`register`（注册即发 JWT）/`login`（用户名或邮箱）/`reset-password`/`send-delete-code`/`delete-account`/`PATCH /user/profile`/`PATCH /user/preference`（冷启动偏好问卷 JSON 整体覆盖）。user 表有 `bio varchar(200)`、`preference simple-json`（可空）、**`role varchar(10) default 'user'`**（admin 角色访问后台管理 `/api/admin`）
- **验证码已迁 Redis**（2026-10-06，P0.2）：ioredis + `REDIS_URL=redis://localhost:6379`（默认127.0.0.1），`SET key val EX 300`；VerifyCodeService 启动探活失败即拒绝启动，不退回内存。本地 Docker：`redis:7-alpine` 容器名 redis，端口6379，restart unless-stopped
- **APP_URL**（2026-10-22 新增）：`.env` 配置邮件链接跳转的站点地址，默认 `https://8.166.131.200`（服务器 IP）。改 `.env` 需手动重启后端
- **CORS_ORIGINS**：生产环境需包含前端域名 `https://8.166.131.200`，否则跨域被拒
- Todo 接口扩展：

| 方法   | 路径                     | 说明                                                                    |
| ---- | ---------------------- | --------------------------------------------------------------------- |
| GET  | `/todos`               | 未归档（含未完成 + 已完成）                                                       |
| GET  | `/todos/archived`      | 已归档（仅已完成且归档）                                                           |
| POST | `/todos`               | 新建待办：自动计算 `checkinDueAt`（有 DDL → DDL-createdAt 的 1/3 时点；无 DDL → +24h） |
| PATCH | `/todos/:id`          | 更新（勾选 done=true 写 completedAt）                                        |
| PATCH | `/todos/:id/archive`  | 单条归档                                                                  |
| DELETE | `/todos/clear-done`   | 批量归档全部已完成                                                            |
| DELETE | `/todos/:id`          | 移出计划表（物理删除）                                                          |
| **POST** | **`/todos/:id/reflect`** | **完成打卡**：标记 done + 可选感受（reflectionComment）+ LLM 生成 Agent 回应（reflectionReply），两阶段弹窗见 §2.7 |
| **POST** | **`/todos/:id/postpone`** | **答了「还没」顺延**：有未来 DDL → 剩余时间 1/3；无 DDL 或 DDL 已过 → +24h；最短 10min |

- **Todo 实体新增字段**：`reflectionComment text nullable（加密）`、`reflectionReply text nullable（加密）`、`checkinDueAt datetime nullable`、`lastCheckinAt datetime nullable`
- **定时「做了吗」邮件**（`TodoCheckinService`，2026-10-23 新增）：node-cron 每 30 分钟扫 `:07/:37`，条件 `done=false AND archived=false AND checkinDueAt <= NOW()`；同一轮只发一封（`lastCheckinAt >= checkinDueAt` 跳过）；启动 20s 预热补跑；邮件正文含按钮链接 `${APP_URL}/login?redirect=/`，已登录浏览器自动跳首页，未登录登录后自动回跳
- action_record 有 `addToTodo tinyint default 0`：用户做决定时记录「是否选择加入计划表」，用于会话详情页准确显示待办状态（待办在表中/已完成/已归档/已删除可重加/从未加入 五种文案）；历史数据已回填

### 2.6 地点搜索（2026-10-07 新增）

- **前端 `SketchPlacePicker.vue`**：手绘风搜索框（sketch-input 波浪下划线 + 奶米弹层 + 薄荷高亮，与 SketchSelect 同款），300ms 防抖，键盘上下/回车/Esc
- **后端 `place.service.ts`**：百度 **`place/v2/suggestion`**（⚠️ 不要用 `place/v2/search`——它在 region=全国 时只返回「各城市命中数量」统计列表 result_type=city_type，拿不到门店）；复用 `BAIDU_MAP_AK`；过滤空壳联想项（uid/address 全空的输入原文回显）
- **定位三级兜底**（解决「人在潮州搜出兰州麦当劳」）：
  1. 浏览器 `navigator.geolocation` 坐标 → 后端 `location=lat,lng&coordtype=wgs84ll`（百度按距离排序，服务端自动转坐标系）
  2. 坐标拿不到 → localStorage `jdi_weather_city`（天气功能选过的城市）→ 后端 `region=该城市` 只召回本市
  3. 都没有 → region=全国
- 实测：潮州坐标搜「麦当劳」返回潮安区南风里/奎元广场/瓷兴路店，由近到远

### 2.7 前端要点

- **数据层**：`http.ts` 的 `authRequest` 统一带 token、401 抛 `UnauthorizedError`；`isNetworkError`/`sleep` 支持加载失败自动重试两次（0.7s/1.5s），最终失败显示「重新加载」按钮，**不再误判为空账号**
- **userStore**：JWT + user + `lastActiveAt` 存 `jdi_current_user`；连续 24h 未活动自动登出（路由跳转时 checkActivity）
- **页面**：
  - `Dashboard.vue`（首页，title=拍板大王/JUST DO IT）：计划表 + 历史会话分类抽屉（默认全折叠）+ 管理模式批量删除；**已移除归档记录区块**；**定时「做了吗」询问卡**（顶部横条，按 `checkinDueAt <= now` 过滤期待办；「做了」→ 弹完成打卡；「还没」→ `POST /todos/:id/postpone` 顺延 + 卡消失）
  - `TaskCreate.vue`：分类按钮组 + 三滑块 + 耗时/截止/**地点（SketchPlacePicker）**；神秘加成三开关（答案之书默认开/塔罗/天气）；购物分类显示钱包面板；补充条件 textarea；**「纠结内容」「前提条件」label 右侧各有一个 SketchTooltip `?` 手绘圆圈提示**（桌面 hover、移动 touch 切换，点外部关闭）
  - `SessionResult.vue`：会话+历史详情统一页；反馈区（可选评论 + 接受先追问是否入表）；按待办状态显示五种文案；已移除历史摘要区块
  - `Stats.vue`：关键词墨圈气泡卡 + LLM 综合论述 + 五个统计板块（纯 SVG 零三方图表库）+ **归档记录抽屉（按分类分组，默认全折叠，条数显示，每条带✕删除+手绘确认框）**
  - `MemoryKeywords.vue`：墨圈气泡 + 记忆卡片 CRUD；类型选择已复用 `SketchSelect`（无原生 select）
  - `Register.vue`：注册成功后弹 **PreferenceQuestionnaire.vue**（3 步手绘问卷），问卷关闭后自动弹 OnboardingGuide；App.vue 监听 guideOpen 事件，Register 只打标记不在卸载前弹
  - `Login.vue`：**已登录用户访问 `/login` 自动跳到目标页**（邮件链接带 `?redirect=/`）
  - `NotFound.vue`：404 兜底页，手绘卡片居中显示 404 + 「页面不存在」+「回首页」按钮；router 末尾 `/:pathMatch(.*)*` 兜底
- **新手引导**（2026-10-22）：
  - `OnboardingGuide.vue`：4 步手绘卡片（这是什么 / 创建纠结 / 建议与计划表 / 打卡询问与关键词统计），小圆点分页 + 可跳过；首次进首页自动弹（localStorage `jdi_onboarded`）
  - `FloatingHelpButton.vue`：NavBar 右侧「?」按钮，随时可重开引导
  - `SketchTooltip.vue`：18px 手绘 `?` 圆圈，hover 显示奶米底手绘气泡提示；桌面 mouseenter/mouseleave、移动端 click 切换、点外部关闭（document mousedown 监听模式，同 SketchDatePicker）
- **完成打卡两阶段**（`SketchReflectDialog`）：输入感受 → 提交后同弹窗展示「我：评价」+「Agent：回应」，点「回到计划表」关闭；`todoStore.reflectDone` 返回更新后的待办对象；评价与回应落库并在「已完成」抽屉内可回看
- **手绘组件库**：SketchBorder / LinearButton / SketchCheckbox / SketchClock / DecorDotCluster / DualTextBlock / PageWrapper / SketchSelect / SketchDatePicker / **SketchPlacePicker** / SketchConfirmDialog / **SketchTooltip** / **SketchReflectDialog**
- **全站已无 `window.alert` / `window.confirm`**（2026-10-07 清零）：错误提示统一行内错误条（`text-xs + border-sketch-line/40`），删除确认统一 SketchConfirmDialog
- **加载动画**：Teleport 挂 body，fixed inset-0 全屏奶米底 95% 不透明，波点 18px 居中；至少展示 1.6s，接口返回后再停留 0.8s

### 2.8 后台管理（2026-10-22 新增）

- **Admin 模块**（`src/admin/`）：仅 role=admin 可见可进，AdminGuard（JwtAuthGuard 后查 `user.role === 'admin'`）
  - `GET /api/admin/overview`：用户总数/总访问量/今日访问/今日活跃/最近20活跃用户+最后活跃时间
  - `GET /api/admin/feedbacks`：带用户名倒序100条反馈
  - 公告 CRUD `/api/admin/announcements`
- **公告后端化**：`announcement` 表（title/date/items simple-json/createdAt）；`GET /api/announcements` 用户端只返回最近 7 天；前端 NoticeBell 改 API 拉取
- **访问统计**：`visit` 表（userId 可空/createdAt）；`POST /api/track/visit` 用 OptionalJwtGuard（登录匿名均可）；App.vue onMounted 每会话上报一次（sessionStorage `jdi_visited` 去重）
- **Admin.vue**（前端）：统计卡片 + 活跃用户列表 + 反馈收集 + 公告管理；路由 meta `requiresAdmin` 守卫；NavBar admin 用户显示「管理」链接

---

## 三、变更日志（近期在上）

### 2026-10-23 邮件定时询问 + 完成打卡 Agent 回应 + 纠结分类扩展 + 新手引导

1. **邮件定时「做了吗」询问**：
   - 后端 `TodoCheckinService`（`node-cron`）每 30 分钟扫 `:07/:37`，条件 `done=false AND archived=false AND checkinDueAt <= NOW()`；同一轮只发一封（`lastCheckinAt >= checkinDueAt` 跳过）；启动 20s 预热补跑
   - `.env` 新增 `APP_URL=https://8.166.131.200`，邮件按钮链接改为 `${APP_URL}/login?redirect=/`，已登录浏览器自动跳首页
   - 前端 Dashboard 顶部横条：`checkinDueAt <= now` 的未完成待办展示「到点问问：做了吗？」，「做了」→ 弹完成打卡；「还没」→ `POST /todos/:id/postpone` 顺延
   - 顺延规则：有未来 DDL → 剩余时间 1/3；无 DDL 或 DDL 已过 → +24h；最短 10min
2. **完成打卡 Agent 回应**：
   - 后端 `POST /todos/:id/reflect`：标记 done + 存 `reflectionComment` + 调 LLM 生成 `reflectionReply`（30-60字，第二人称口语化）
   - Todo 实体新增 `reflectionComment / reflectionReply / checkinDueAt / lastCheckinAt` 四个列
   - 前端 `SketchReflectDialog` 两阶段：输入感受 → 提交后同弹窗展示「我：评价」+「Agent：回应」，不写也能跳过直接完成
3. **纠结分类扩展**：新增 `finance（财务理财）/relationship（情感关系）/family（家庭）`，共 10 类。同步修改前端 `TaskCategory` 类型 + Dashboard/SessionResult/Stats 三个中文映射表 + TaskCreate 下拉；后端 `agent.prompt.ts` / `behavior-memory.service.ts` / `llm-memory.service.ts` / `agent.service.ts` 四处 CATEGORY_LABEL。行为记忆关键词前缀取分类名前两字（如「财务听劝」），避免四字分类生成 6 字关键词超限
4. **新手引导**：`OnboardingGuide.vue`（4 步）+ `FloatingHelpButton.vue`（NavBar「?」重开）+ `SketchTooltip.vue`（TaskCreate 纠结内容/前提条件 label 右侧手绘 `?` 圆圈提示）
5. **修复**：
   - `FeedbackModule` 和 `AdminModule` 缺 `PassportModule.register({ defaultStrategy: 'jwt' })`，Nest 启动时 JwtAuthGuard 依赖解析失败 → 两个 module 都补上
   - `OptionalJwtGuard.handleRequest` 返回类型 `{}` 不兼容基类签名 → 改为 `<TUser = any>(err, user, info, context): TUser | null`
   - 后端 watch 增量编译失败后 dist 目录残缺（`Cannot find module './app.module'`）→ 杀掉进程 + `Remove-Item -Recurse -Force dist` 全清后重启
   - `user.entity.ts` 加 `role varchar(10) default 'user'` 以支持 AdminGuard（已存在则跳过）

### 2026-10-22 后台管理系统 + 公告后端化 + 访问统计

1. **后台管理 `/admin`**（仅 role=admin 可见可进）：
   - user 表加 `role varchar(10) default 'user'`；管理员设置：`UPDATE user SET role='admin' WHERE username='xxx'`
   - 后端 `admin` 模块：AdminGuard（JwtAuthGuard 后查 role）；`GET /api/admin/overview`（用户总数/总访问量/今日访问/今日活跃/最近20活跃用户+最后活跃时间）；`GET /api/admin/feedbacks`（带用户名倒序100条）；公告 CRUD `/api/admin/announcements`
   - 前端 `Admin.vue`：统计卡片 + 活跃用户列表 + 反馈收集 + 公告管理（新建/编辑/删除，条目类型按钮点击循环切换 新增→优化→修复）；路由 meta `requiresAdmin` 守卫；NavBar admin 用户显示「管理」链接
2. **公告后端化**：`announcement` 表（title/date/items simple-json/createdAt）；用户端 `GET /api/announcements` 只返回最近 7 天；前端硬编码 announcements.ts 已删除，NoticeBell 改 API 拉取；铃铛公告 tab 加「清除全部」（localStorage `jdi_notice_cleared_at` 过滤，新公告会重新出现）
3. **访问统计**：`visit` 表（userId 可空/createdAt）；`POST /api/track/visit` 用 OptionalJwtGuard（登录匿名均可）；前端 App.vue onMounted 每会话上报一次（sessionStorage `jdi_visited` 去重）

### 2026-10-22 小铃铛（公告+意见反馈）+ 偏好问卷修复

1. **小铃铛（NavBar 右侧，仅登录可见）**：`NoticeBell.vue` 手绘铃铛按钮 + 弹层，两个 tab
   - **公告**：前端硬编码 `src/data/announcements.ts`（发版时维护，新的在前），localStorage `jdi_notice_last_read` 记录已读，未读显示红点；条目标签分 新增/优化/修复
   - **意见反馈**：后端 `feedback` 模块补全（module 骨架早已注册但 entity/controller/service 缺失）——`feedback` 表（userId/content/createdAt），`POST /api/feedback` 需 JWT，前端 `feedbackApi.submit`
2. **注册后偏好问卷不弹修复**：根因是 `openGuide()` 后立刻 `router.push("/")`，Register.vue 卸载导致内部 watch 销毁；改为 Register 只打 `pendingAfterGuide` 标记，App.vue（永不卸载）监听 guideOpen 关闭后弹问卷

### 2026-10-21 用户偏好问卷（冷启动数据）+ 404 兜底页 + 完成打卡结果展示 + 引导补充

1. **用户偏好问卷（冷启动数据）**：
   - 后端：`user` 表新增 `preference` 列（simple-json，可空），存储 `{interests, agonizeOver, decisionStyle, values, customNote}`；新增 `PATCH /api/user/preference` 整体覆盖；`toUserResponse` 返回 preference
   - 前端：`PreferenceQuestionnaire.vue`（3 步手绘问卷：兴趣+纠结点 / 决策风格+价值观 / 补充说明），注册成功后新手引导关闭自动弹出；`MemoryKeywords.vue` 标题右侧加「偏好设置」按钮，老用户可随时编辑并回填已有数据
   - LLM 注入：`createSession` 读取用户 preference，拼成可读摘要注入 prompt【用户主动填写的偏好】段，system 规则 12.1 说明偏好优先级高于长期记忆、用于个性化措辞与策略
2. **404 兜底页**：新增 `NotFound.vue`（手绘卡片居中：404 / PAGE NOT FOUND / 页面不存在 + 「回首页」按钮），`router/index.ts` 末尾加 `/:pathMatch(.*)*`，未匹配路由不再空白
3. **完成打卡结果展示**：`SketchReflectDialog` 改为两阶段——输入感受 → 提交后同弹窗展示「我：评价」+「Agent：回应」，点「回到计划表」关闭；`todoStore.reflectDone` 返回更新后的待办对象；评价与回应仍落库并在「已完成」抽屉内可回看
4. **新手引导补充**：`OnboardingGuide` 第 4 步新增「完成后的评价 / REVIEW AFTER DONE」，说明勾选完成弹完成打卡、可写感受让 Agent 再回应、不写可直接完成

### 2026-10-07 UI 统一 + 地点搜索 + 归档分类

1. **站名定为「拍板大王」**：NavBar 副标题 + Dashboard 首页标题
2. **风格一致性清查修复**：
   - SessionResult 3 处 + Dashboard 1 处 `window.alert` → 行内错误条（按错误来源分区显示，重试前自动清空）——**全站 alert/confirm 清零**
   - MemoryKeywords 两处原生 `<select>` → 复用 `SketchSelect`
   - Dashboard 标题中英颠倒修正（拍板大王 / JUST DO IT）
3. **归档记录分类**（Stats.vue）：归档抽屉内按 7 分类再分小抽屉，默认全折叠
4. **地点搜索上线**：见 §2.6。踩坑：`place/v2/search` 全国只返回城市统计；suggestion 空壳联想项需过滤；浏览器定位成功率低需三级兜底
5. **DecorDotCluster 卡死修复**：do-while 拒绝采样 → 确定性环形生成（四周环带均匀取点+抖动）；`onUnmounted` 取消 rAF 后 `rafId=null` 防 HMR 泄漏叠加；`animate` 开头 `document.hidden` 检查暂停后台动画

### 2026-10-06 部署安全加固 + Redis 验证码

1. **P0.2 验证码迁 Redis**（commit `6275d12`）：见 §2.5
2. **字段级 AES-256-GCM 加密**：`DATA_ENCRYPTION_KEY` 在 .env，密文前缀 `enc:v1`，老数据迁移 `npm run encrypt:data`
3. **CORS 收紧**：`.env` 的 `CORS_ORIGINS` 白名单（默认 localhost:5174）
4. **本地服务绑回环**：Redis 容器仅绑 127.0.0.1:6379；MySQL80 my.ini 设 bind-address/mysqlx-bind-address=127.0.0.1（备份 my.ini.bak-harden）
5. **服务器部署待办**：HTTPS、防火墙只开 22/80/443、关闭 synchronize

### 2026-10-01 资料更新 + 统计聚合 + 计划表重构

- `PATCH /user/profile`（username/email/bio，唯一冲突查重）
- `GET /agent/stats` SQL 聚合；`GET /sessions` 改 SQL 层过滤
- 关键词汇总页 `/keywords`（墨圈气泡 + 记忆 CRUD）
- 历史会话分类抽屉；计划表「归档已完成」（archived 列）；删除改「移出计划表」
- 消费购物钱包评估（itemPrice/walletBalance/walletScore，仅 shopping）
- LLM 回答质量优化（数据先行/直接回答/钱包约束/结论一致性）
- 反馈二次对话（withReply + comment + agentReply）；补充条件 extraContext
- 接受建议先追问是否入计划表；window.confirm 换 SketchConfirmDialog

### 2026-09-29/30 天气 + 统一解读 + 综合论述（commit `75280d8`）

- 今日天气加成（whyta + 城市映射 + 1-10 打分注入 prompt）
- 塔罗/答案之书解读并入主 LLM 一次调用（tarotReading/answerBookReading）
- `/memory/summary` LLM 综合论述（30min 哈希缓存）
- user_memory 加 keyword 列；3.5 Dice 去重豁免同 key 修复
- 天气📍自动定位（WGS84 → 百度逆地理，coordtype=wgs84ll 服务端转系）
- 全国省/市联动（mxnzp 341 城，24h 缓存）；SketchSelect/SketchDatePicker 自绘控件
- 加载失败自动重试（isNetworkError）

### 2026-09-15 ~ 09-23 基础建设

- `949a271`/`eae085c`/`ab25930`：后端模块 + 前端页面 + 锁文件
- `6900a5d`：DeepSeek LLM 接入（规则→LLM，前端零改动）
- `91caa89`：历史行为注入 prompt（方案 B 跨维度规律）
- `9f50839`：Memory 3.1-3.3（表 + CRUD + prompt 注入）；3.4/3.5 后续完成
- 登录滑动过期（24h 不活跃登出）

---

## 四、卡住的问题 / 已知限制

| 问题           | 状态      | 说明                                   |
| ------------ | ------- | ------------------------------------ |
| ~~验证码内存存储~~  | **已解决** | 2026-10-06 迁 Redis，启动探活失败即拒启动        |
| ts-jest 单测全挂 | 已知限制    | 项目级 rootDir 配置问题，与业务代码无关             |
| 浏览器定位成功率低    | 已兜底     | 地点搜索三级兜底（坐标→天气城市→全国），见 §2.6          |
| 服务器部署加固      | 待做      | HTTPS、防火墙只开 22/80/443、关闭 synchronize |
| ~~后端启动依赖解析失败（PassportModule）~~ | **已解决** | FeedbackModule/AdminModule 各补 `PassportModule.register({ defaultStrategy: 'jwt' })` |

---

## 五、踩过的坑（按主题归类）

### 5.1 后端/数据库

1. **MySQL Access denied**：.env 密码是占位符 → 改真实密码
2. **BLOB/TEXT 列不能设 default** → `nullable: true`
3. **EADDRINUSE :::3000**：`Get-NetTCPConnection -LocalPort 3000 -State Listen` 找 PID → Stop-Process
4. **改 .env 不生效**：watch 只监听 .ts，必须手动重启
5. **TypeORM 加列再回滚（ER_DROP_INDEX_FK）**：唯一索引列被外键阻塞 → 手动按「删外键→删索引→删列→重建外键」SQL 清理
6. **`isolatedModules` 装饰器类型导入（TS1272）**：entity 字段类型用 `string`，枚举只做运行时校验
7. **`GET /sessions` 曾内存过滤 userId** → 已改 SQL 层 where
8. **ECONNREFUSED 排查顺序固定**：`docker ps`（Redis）→ `netstat :3000`（后端）—— vite 代理报错是后端没起，ioredis 报错是 Redis 没起
9. **后端 watch 增量编译失败后 dist 目录残缺** → 杀掉进程 + `Remove-Item -Recurse -Force dist` 全清后重启；否则会报 `Cannot find module './app.module'`，新进程抢不到 3000
10. **AdminModule/FeedbackModule 使用 JwtAuthGuard 但未 import PassportModule** → Nest 启动时报 `AuthModuleOptions` 依赖解析失败；每个用 JwtAuthGuard 的模块都要 `PassportModule.register({ defaultStrategy: 'jwt' })`
11. **OptionalJwtGuard.handleRequest 返回类型 `{}` 不兼容基类签名** → 改为 `<TUser = any>(err: any, user: TUser, _info?: any, _context?: any): TUser | null`

### 5.2 LLM/第三方 API

12. **LLM 指数和结论打架** → prompt 加 shouldGo 布尔，后端强制对齐 ≥55/≤45
13. **DeepSeek 默认不爱用激将** → 必须写清心理阻力类型 + 数值信号 + 要求频率均衡
14. **LLM 同类问题结论摇摆/编造数字** → 数据先行/直接回答/钱包约束/结论一致性四条 + 注入最近会话
15. **随机神谕与结论打架** → 随机结果保留随机感，主 LLM 同次调用输出同向解读；切忌让 LLM 自己编"随机"答案
16. **whyta 天气结构与文档不符**：外层包 {status,message,data}，weatherDesc 是 [{value}] 数组；key 无效时 HTTP 200 + message 报错 → 解析须兼容两种结构
17. **3.5 Dice 去重必须豁免同 key**：否则 LLM 复用 key 改写老记忆时被当重复丢弃
18. **塔罗 API 坑**：缘分居示例 key 是假的；最终用妖狐 API，SPREAD_COUNT=1
19. **百度 `place/v2/search` 不支持全国搜门店**：region=全国 返回城市统计列表（city_type）；地点联想用 `place/v2/suggestion`，且要过滤空壳回显项（uid/address 全空）
20. **LLM key 占位符含全角连字符 `‑`** → 填真实 key 用半角 `-`

### 5.3 前端/UI

21. **Vue 组件没 import**：渲染为空且无报错，vue-tsc 能查出
22. **401 处理**：`UnauthorizedError` 要主动清登录态跳登录，不要当普通报错
23. **原生控件风格割裂**：select/datetime-local/confirm/alert 全部自绘或行内化——**全站已零原生弹窗零原生下拉**；新需求复用 SketchSelect/SketchDatePicker/SketchPlacePicker/SketchConfirmDialog/**SketchTooltip**，**别新建重复组件**
24. **SketchBorder 宽卡片边框内缩压线**：`preserveAspectRatio="none"` 非等比拉伸，viewBox 距边 6~12 单位在整行宽卡片上拉到 ~40px → 宽卡片 padding ≥`2rem 3rem`，气泡区 `3.5rem 4rem`；记忆卡片左 padding 44px
25. **加载失败误显示空状态** → isNetworkError 自动重试两次 + 「重新加载」按钮
26. **散点图 y 轴刻度必须与层距同源** → 从基线起每层等距
27. **DecorDotCluster 卡死四根因**（2026-10-07）：do-while 拒绝采样死循环 → 确定性环形生成；每帧改响应式数组 → 普通对象/markRaw；ResizeObserver 自激 → 防抖下限 50ms + fullscreen 用 innerWidth/Height；rAF 泄漏 → onUnmounted 置 null + animate 幂等保护 `if (rafId !== null) return` + `import.meta.hot?.dispose()` 清理。**改该文件后必做冒烟测试**：DevTools CPU 4x slowdown，切路由+缩放窗口 10 秒
28. **动画通用守则**：每帧数据用普通对象+markRaw 或直接操作 DOM；循环加预算守卫（document.hidden 检查、连续10帧>50ms 自动降级）；参数 prop 在 watch 中 clamp 合法性
29. **邮件跳转 redirect**：邮件里「去计划表看看」必须带 `/login?redirect=/`；登录页已登录时要主动 `router.push(redirect)` 避免卡在登录表单

### 5.4 工具链

30. **PowerShell**：不支持 `&&`（改 `;`）、curl 是别名（用 `curl.exe`）、commit 消息不能用 heredoc（改多个 `-m`）、中文经请求体会变 `?`（含中文一律 node fetch）
31. **pnpm 10 拦构建脚本**：esbuild 走平台可选依赖、vue-demi 自动适配，无需 approve-builds
32. **E2E 基建**：注册需验证码，用 node 脚本直插 DB 造账号；`actualCostMin` 是 DTO 必传整数；3.5 提炼有 10min 内存节流，连续测试需重启后端

---

## 附：常用命令

```powershell
# 前端（d:\just do it，pnpm；端口以 vite 日志为准）
pnpm install
pnpm dev             # Vite，/api 代理到 3000
pnpm vue-tsc --noEmit
pnpm build

# 后端（d:\just do it\action-agent-nest，npm）
npm install
npm run start:dev    # 端口 3000，watch（改 .env 需手动重启）
npm test
npm run encrypt:data # 老数据字段级加密迁移

# 本地依赖服务
docker ps            # 确认 redis 容器在跑（redis:7-alpine，127.0.0.1:6379）

# 测试公开接口（PowerShell 用 curl.exe 或 irm）
irm "http://localhost:3000/api/agent/answer-book?question=test"
irm "http://localhost:3000/api/agent/tarot" -Method Post -ContentType "application/json" -Body '{}'
curl.exe -s "http://localhost:3000/api/agent/weather?city=武汉"
curl.exe -s "http://localhost:3000/api/agent/cities"
curl.exe -s "http://localhost:3000/api/agent/place-search?keyword=麦当劳&city=潮州"
curl.exe -s "http://localhost:3000/api/announcements"

# 测试受保护接口（先登录拿 token）
$h = @{ Authorization = "Bearer <token>" }
irm "http://localhost:3000/api/agent/sessions" -Headers $h
irm "http://localhost:3000/api/agent/stats" -Headers $h
irm "http://localhost:3000/api/memory" -Headers $h
irm "http://localhost:3000/api/todos/archived" -Headers $h
irm "http://localhost:3000/api/todos/1/archive" -Method Patch -Headers $h
irm "http://localhost:3000/api/admin/overview" -Headers $h  # 需 role=admin

# Git（前后端同一仓库，根目录操作）
git status
git add action-agent-nest/   # 按子系统分批暂存
git add src/
git commit -m "title" -m "body"   # PowerShell 用多个 -m，勿用 heredoc
git push
```
