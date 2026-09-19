# HANDOFF - JUST DO IT（今日行动师）交接文档

> 更新时间：2026-09-19

决策辅助应用：帮助纠结的用户做「做不做」的决定。Vue3 前端 + NestJS 后端（**DeepSeek LLM 生成行动建议** + 答案之书/塔罗牌第三方 API）。

- 前端：`d:\just do it\src`（Vue3 + Vite + Pinia + Tailwind + TypeScript），**包管理器 pnpm 10.19.0**
- 后端：`d:\just do it\action-agent-nest`（NestJS + TypeORM + MySQL），独立工程，**包管理器 npm**
- 同一个 Git 仓库（分支 `dev`），前端在根目录、后端在 `action-agent-nest/` 子目录，共用一个 `.git`
- ⚠️ 两个子系统包管理器不同：根目录只留 `pnpm-lock.yaml`（`package-lock.json` 已被根 `.gitignore` 用 `/` 锚定忽略），后端的 `action-agent-nest/package-lock.json` 正常保留，互不影响

---

## 一、当前总体状态

**前后端主链路已全部打通，无 mock 依赖（神秘加成公开接口失败时仍有本地兜底）。**

2026-09-15 提交了 3 个 commit（已推送 `origin/dev`）：

1. `949a271` feat(backend): agent/todo/user 模块 & 邮件验证码
2. `eae085c` feat(frontend): 登录注册/计划表/会话结果页等页面与交互
3. `ab25930` chore: 更新依赖锁文件

2026-09-17 锁文件治理：前端统一 pnpm——`git rm package-lock.json`、根 `.gitignore` 忽略 `/package-lock.json` 和 `/yarn.lock`、`package.json` 增加 `packageManager: pnpm@10.19.0`；后端仍用 npm。

2026-09-18 **第一步 DeepSeek LLM 接入**（commit `6900a5d` 已推送）：规则判断 → LLM 判断，前端零改动；劝说模式 4→3；统计页图表改 lieflat glance 风格。

2026-09-19 **第二步：把历史行为喂给 LLM（本地改动待提交）**：`createSession` 在保存本次任务前先算 `buildHistorySummary`，注入 user prompt 的【用户历史行为】段；并把摘要从"次数/执行率"增强为**跨维度行为规律**（方案 B）。实测 LLM 已能引用真实执行率做个性化激将（如"5 个任务只完成 1 次，25% 执行率"）。**未引入 Memory/向量库/RAG**。详见下文「LLM 建议链路」。

| 模块 | 状态 |
|---|---|
| 用户注册/登录（JWT，用户名或邮箱均可登录） | ✅ 真实接口 |
| 邮箱验证码（注册 / 找回密码 / 注销账户，QQ 邮箱 SMTP） | ✅ |
| Agent 会话创建/列表/详情/历史/反馈/删除 | ✅ 真实接口 |
| 计划表待办 CRUD + 「接受→执行」回写 | ✅ 真实接口 |
| 答案之书 / 塔罗牌（单张） | ✅ 第三方真实接口，失败本地兜底 |
| 统计页（前端基于会话列表计算，lieflat 风纯 SVG 图表） | ✅ |
| **DeepSeek LLM 大模型建议** | ✅ **已接入**：LLM 生成指数/结论/劝说/最小行动，失败自动降级规则引擎 |

⚠️ 后端需要时在 `action-agent-nest` 目录执行 `npm run start:dev`（端口 3000）。

---

## 二、已完成的内容

### 后端（NestJS，全局前缀 `/api`）

**Agent 模块**（`src/agent/agent.controller.ts` / `agent.service.ts`，除两个公开接口外均需 JWT）：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/agent/session/create` | 创建会话：存任务 → 算指数/劝说模式 → 神秘加成 → 存会话 |
| GET | `/agent/sessions` | 当前用户历史列表（含 task + record，动态 historySummary） |
| GET | `/agent/session/:id` | 会话详情（校验归属） |
| GET | `/agent/history/:id` | 历史详情（会话 + 任务输入 + 反馈 + 时间） |
| POST | `/agent/action/record` | 行为反馈 **upsert**（按 sessionId，校验归属） |
| DELETE | `/agent/session/:id` | 删除会话：级联删 关联待办 → 反馈 → 会话 → 任务 |
| GET | `/agent/answer-book` | 公开，答案之书（uapis.cn） |
| POST | `/agent/tarot` | 公开，塔罗抽 1 张（妖狐 API，后端另有本地兜底牌面） |

- **LLM 建议链路**（2026-09-18 接入，DeepSeek，OpenAI 兼容接口）：
  - `llm.service.ts`：唯一负责调 DeepSeek `POST {LLM_BASE_URL}/v1/chat/completions`，model 取 `LLM_MODEL`（默认 deepseek-chat），`response_format: { type: "json_object" }`；超时/网络错/JSON 解析失败/字段非法一律 catch 返回 `null`（**LLM 故障不影响创建会话主流程**）
  - `agent.prompt.ts`：`buildSystemPrompt()` + `buildUserPrompt(task)`；system 要求严格只返回 JSON：`{ shouldGo, agentSuggestIndex, conclusion, persuadeMode, persuadeText, minAction }`
  - `agent.service.ts` 的 `generateAdvice`：先调 LlmService，拿到合法结果就用；否则 `computeAdviceByRule()` 走原规则公式兜底
  - **方向一致性对齐**：LLM 返回 `shouldGo`，后端强制 `shouldGo=true → 指数 ≥55`、`false → ≤45`（模型给的指数越界时夹到边界），保证中文结论（去做/暂缓）、指数、前端英文（GO FOR IT NOW / HOLD OFF TODAY，阈值 50）三者永远同向
  - **劝说模式 3 选 1**（已删「塔罗模式」，塔罗仅作附加神谕不影响模式）：`温柔劝说模式 / 激将模式 / 理性分析模式`；prompt 按**心理阻力类型**给判定标准——
    - 激将＝**不想做但该做**（意愿 ≤4 但重要度 ≥7，或临近截止），锋利点破拖延
    - 温柔＝**想做但做不动**（精力 ≤4 或意愿/重要度拉扯），降门槛先做一点
    - 理性＝**能做、需权衡决断**（意愿精力均 ≥5 或要算成本），摆事实
    - 并要求三模式频率大致均衡、不要回避激将；激将模式已实测可稳定触发
  - **规则兜底** `computeAdviceByRule`（LLM 不可用时）：指数 = `willScore*7 + energyScore*3 + importance*2 - 10`（钳 5–98）；指数 <40 激将、40–69 温柔、≥70 理性；结论/文案走内置模板 `PERSUADE_TEXTS`
  - `llm.service.ts` 内 `VALID_MODES` 白名单校验，模型返回已废弃模式名时映射降级
  - 配置：`.env` 的 `LLM_BASE_URL`（https://api.deepseek.com）/ `LLM_API_KEY`（已填真实 key，**.env 不入库**）/ `LLM_MODEL`；改 .env 必须手动重启
- **第二步·历史注入（2026-09-19）**：
  - `createSession` 在**保存本次任务之前**先调 `buildHistorySummary(userId, category)`（只含过去、不含本次），同一份摘要既传给 `llmService.generateAdvice(dto, historySummary)` → `buildPrompt` 的【用户历史行为】段，又用于结果页展示，避免重复查询
  - system prompt 第 7 条：要求结合真实历史针对性劝说（"常接受却没执行"就点破并把 minAction 压到极小），**只能依据给出的历史、严禁臆造**；无历史（新用户）则不传该段
  - 这仍是当次上下文，**不是 Memory**：不建表、不持久化画像、无 embedding/RAG/多轮
- **行为摘要 `buildHistorySummary`（方案 B 增强，2026-09-19）**：取最近 50 个会话 + 其 action_record，一次查全，输出三层：
  1. 整体：任务数 / 反馈数 / 整体执行率
  2. 同类（该 category 累计 ≥3 次才提）：次数 / 反馈数 / 执行率
  3. **跨维度行为规律（top3，新增）**：意愿(≥7 vs ≤4)、精力(≥7 vs ≤4)、重要度(≥8 vs ≤4)、预计耗时(≥60min vs <60min) 各自的执行率对比；以及"接受 ≥3 次但 ≥2 次没执行"
     - 防噪声：每组样本 ≥2、执行率差 ≥25 个百分点才算显著，按差异排序只留 top3，小样本维度直接跳过
  - 每次读取实时计算，不入库；前端 SessionResult「历史真实行为摘要」直接展示同一段
- 所有查询带归属校验，越权抛 `ForbiddenException`

**Todo 模块**（`src/agent/todo.controller.ts` / `todo.service.ts`，`/todos` 全部需 JWT）：

- `GET /todos`、`POST /todos`、`PATCH /todos/:id`（勾选/取消，自动写 `completedAt`）
- `DELETE /todos/:id`、`DELETE /todos/clear-done`（一键清除已完成）
- `deleteBySession(sessionId)` 供删会话时级联清理

**User 模块**（`src/user/user.controller.ts` / `user.service.ts`）：

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | `/user/send-code` | 公开 | 发验证码，`type=register/reset`；注册场景校验邮箱未被占用 |
| POST | `/user/register` | 公开 | 验证码通过后注册并**直接签发 JWT**（前端免登录） |
| POST | `/user/login` | 公开 | username 字段支持**用户名或邮箱** |
| POST | `/user/reset-password` | 公开 | 忘记密码，需 reset 类型验证码 |
| POST | `/user/send-delete-code` | JWT | 注销验证码发往绑定邮箱（type=delete） |
| POST | `/user/delete-account` | JWT | 验证码二次确认后注销 |

- `verify-code.service.ts`：内存 Map 存储，三类码（register/reset/delete）互不通用；5 分钟有效、60 秒发送频控、校验成功即焚
- `mail.service.ts`：QQ 邮箱 SMTP（`QQ_MAIL_USER` / `QQ_MAIL_AUTH_CODE`）
- 5 张表：task、task_session、action_record、todo、user（`synchronize: true` 自动建表）

### 前端（Vue3）

**数据层**：

- `src/api/http.ts`：`authRequest` 统一封装——自动带 Bearer token、401 抛 `UnauthorizedError`、后端 `message`（含 ValidationPipe 数组）透传
- `src/api/`：`agentApi.ts` / `todoApi.ts` / `userApi.ts` 全部走真实后端；`toCardItem()` 把 HistoryDetail 映射成首页卡片
- `agentStore`：纯后端数据源，**mock 会话和 demo 数据已删除**；缓存会话列表，反馈/删除同步更新缓存
- `todoStore`：数据源后端 MySQL；首次登录把旧版 localStorage（`jdi_todos`）待办按 sessionId/内容去重**一次性迁移**后删除本地 key
  - `toggleDone`：乐观更新 → PATCH 后端 → 失败回滚；带 sessionId 的待办同时 upsert `ActionRecord.isExecute`，**「接受→执行」链路已打通**
- `userStore`：JWT + user 存 `jdi_current_user`；init 兼容旧 mock 格式（无 token 视为失效）；退出登录同时清空 agent/todo 内存数据
- 路由守卫：`requiresAuth` 未登录带 `?redirect=` 跳登录页；已登录访问登录/注册/找回密码跳个人中心；`/history/:id` 永久重定向到 `/session/:id`

**页面/组件**（`src/views/`、`src/components/`）：

- `TaskCreate.vue`：分类按钮组 + 三滑块 + 可选耗时/截止/地点；答案之书（默认开）、塔罗（默认关，单张）两个整行可点开关；提交真实接口
- `SessionResult.vue`：**会话页与历史详情已合并为统一页**（原 `HistoryDetail.vue` 已删除）；时钟/结论/神谕/单张塔罗/原始任务输入/最小行动/动态历史摘要；反馈仅「✓ 我接受 / ✕ 我拒绝」，接受自动入计划表；已反馈可「重新加入计划表」；右上角可删除整条记录（confirm 二次确认）
- `Dashboard.vue`：计划表勾选/删除/清除已完成（`X PENDING · Y DONE`）+ 历史卡片
- `Stats.vue`：总数/执行数/接受率/劝说模式分布/意愿-执行关系，**lieflat glance 风纯 SVG**（零三方图表库），数据来自会话列表前端聚合：
  - 接受率卡：20 根手绘刻度（1 tick=5%），达成段薄荷上墨、未达成淡棕短刻度，逐根生长入场
  - 劝说模式分布：单位发丝线（1 竖线=1 次会话，手绘微抖），每 5 根一个点标，最高频模式整行走薄荷色；模式共 **3 种**（前端 `PersuadeMode` / `PERSUADE_MODES` 已同步删除塔罗模式）
  - 意愿×执行：**Catmull-Rom 平滑曲线图**——x=意愿分 1–10、y=该分数下完成率（只标 0%/100%，单条记录即 0 或 100，多样本后中间值自然出现）；一笔画描边入场 + 薄荷渐变填充；地板保留每次决策的小方框证据点（实心=已执行/空心=未执行）；全部抖动用确定性 hash，刷新图形一致；含 `prefers-reduced-motion` 降级
- `Login.vue` / `Register.vue` / `ForgotPassword.vue`（新增）：注册与找回密码均需邮箱验证码，复用 `EmailCodeInput.vue`（60s 倒计时）
- `Profile.vue`：资料展示/编辑（**仅本地生效，后端无更新接口**）、统计概览、邮箱验证码注销账户
- 手绘组件库不变：SketchBorder / LinearButton / SketchCheckbox / SketchClock / DecorDotCluster / DualTextBlock / PageWrapper

### 已验证

- 注册收码 → 注册即登录 → 创建会话 → 结果页 → 接受入计划表 → 勾选完成回写执行状态，全链路真实接口
- 越权访问他人 session/todo 返回 403；未登录访问受保护接口 401
- 答案之书真实神谕；塔罗真实牌面（带 keywords/description/imageUrl，前端目前仅展示牌名+正逆位）
- **LLM 链路（2026-09-18）**：真实任务返回动态劝说文案（非内置四句模板）；指数与中英文结论方向一致；**激将模式**用「意愿 2 / 精力 6 / 重要度 9 + 临近截止」配方可稳定触发；LLM 返回非法/超时会静默降级规则文案（后端 warn 日志）
- **历史个性化（2026-09-19 实测）**：攒 5 个任务（仅完成 1 个）后再建「意愿 4 / 重要度 8 / 30min」任务，LLM 正确选激将模式并引用真实数据——劝说文案出现"5 个任务只完成 1 次，25% 的执行率"，minAction 压到"打开项目，只写一个函数"；证明历史规律确实进入了 prompt 并影响输出

---

## 三、卡住的问题

| 问题 | 状态 | 说明 |
|---|---|---|
| 个人资料修改不同步 | 已知限制 | 后端无 update 接口，用户名/邮箱/bio 编辑只写 localStorage |
| 统计无后端接口 | 可接受 | 前端基于 `GET /sessions` 全量列表聚合，数据量大后需后端聚合 |
| 验证码内存存储 | 已知限制 | 服务重启即失效，多实例部署不共享；上线前需换 Redis/DB |

---

## 四、下一步计划（按优先级）

**第一步（规则 → DeepSeek）已完成 ✅**（commit `6900a5d`）。
**第二步（当前任务 + 历史行为 → DeepSeek）已完成 ✅**（2026-09-19，待提交），含方案 B 跨维度规律；全程未动前端数据契约、未引入 Memory/RAG。接下来：

1. **第三步：显式用户偏好 → Memory**——新增持久化的用户偏好/画像（可由规则或简单提取写入），跨会话长期记住稳定特征（如"长期低意愿高重要度""总在周末执行"）。届时才需要新表，仍可不做 embedding
2. **第四步：LLM 自动提取偏好写回 Memory**——在反馈/会话后让模型抽取稳定偏好入库
3. 后端补用户资料更新接口（username/email/bio），前端 `updateProfile` 改为真实调用
4. （可选）统计聚合接口，避免前端拉全量会话
5. 塔罗结果页展示关键词/解读/牌面图（后端数据已返回，前端未用）
6. 验证码存储替换为 Redis/DB（部署前必做）
7. 更后阶段才考虑：RAG / 向量数据库 / Embedding / MCP / 多 Agent / 多轮对话（第二步明确不做，第三、四步也暂不需要）

---

## 五、踩过的坑

1. **MySQL Access denied**：`.env` 密码是占位符 → 改真实密码
2. **BLOB/TEXT 列不能设 default**：action_record 的 executeResult 用 `default:''` 报错 → 改 `nullable: true`
3. **PowerShell 不支持 Linux curl 语法**：测试接口用 `irm`（Invoke-RestMethod）
4. **`Missing script start:dev`**：必须在 `action-agent-nest` 目录下运行
5. **EADDRINUSE :::3000**：`Get-NetTCPConnection -LocalPort 3000 -State Listen` 找 PID → `Stop-Process -Id <pid> -Force`
6. **改 `.env` 后端不生效**：`nest start --watch` 只监听 .ts，改 .env 必须手动重启
7. **编辑器改了 .env 但没保存**：磁盘仍是旧值，排查半天
8. **第三方塔罗 API 坑**：缘分居示例 key 是假的、真实 key 是试用号无法解读；最终用妖狐 API（免费单张抽牌），多张会重复故 SPREAD_COUNT=1
9. **Vue 组件用了没 import**：Dashboard 用 SketchCheckbox 未 import，渲染为空且无报错；vue-tsc 能查出
10. **`.env` 里 LLM key 占位符含全角连字符 `‑`**：填真实 key 时注意用半角 `-`
11. **`GET /sessions` 未在 SQL 层按 userId 过滤**：目前查出全部后用 `s.task.userId` 内存过滤，数据量增长后需改成 join where
12. **锁文件已统一为 pnpm**（2026-09-17）：前端根目录只保留 `pnpm-lock.yaml`，`package-lock.json` 已从 git 删除并在根 `.gitignore` 忽略（`/` 锚定，不影响后端）；`package.json` 写了 `packageManager: pnpm@10.19.0`。**后端 `action-agent-nest` 仍用 npm**，其 package-lock.json 不受影响。pnpm 10 会拦截 esbuild/vue-demi 的构建脚本，但 esbuild 走平台可选依赖、vue-demi 在 Vue3 自动适配，vite build 实测正常，无需 approve-builds
13. **前端 401 处理**：`authRequest` 对 401 抛 `UnauthorizedError`，业务代码捕获后要主动清登录态/跳登录，不要当成普通报错提示
14. **LLM 输出的指数和结论会打架**：模型可能给出「暂缓」结论却打 55 分，导致前端英文（指数≥50 显示 GO FOR IT NOW）与中文「暂缓」矛盾。解法：prompt 让模型额外输出 `shouldGo` 布尔，后端不信任它打的分，强制对齐到 ≥55 / ≤45
15. **DeepSeek 默认不爱用「激将」**：只给模式名不给判定标准时，模型几乎总走温和路线，激将很难触发。必须在 system prompt 写清每种模式对应的「心理阻力类型」+ 数值信号（意愿≤4 且重要度≥7），并明确要求三模式频率均衡
16. **塔罗模式曾经身兼两职**：旧规则里开塔罗就把 persuadeMode 设成「塔罗模式」，但塔罗本质是附加神谕。已把劝说模式收敛为 3 种（温柔/激将/理性），前后端类型同步删除；因数据库已清空，历史无旧值要迁移

---

## 附：常用命令

```powershell
# 前端（d:\just do it，用 pnpm；实际端口见 package.json，当前 5174）
pnpm install
pnpm dev             # Vite，/api 代理到 3000

# 后端（d:\just do it\action-agent-nest，独立工程，用 npm）
npm install
npm run start:dev    # Nest，端口 3000，watch 模式（改 .env 需手动重启）

# 前端类型检查（d:\just do it）
pnpm vue-tsc --noEmit

# 前端构建
pnpm build

# 后端单测（action-agent-nest）
npm test

# 测试公开接口（PowerShell）
irm "http://localhost:3000/api/agent/answer-book?question=test"
irm "http://localhost:3000/api/agent/tarot" -Method Post -ContentType "application/json" -Body '{}'

# 测试受保护接口（先登录拿 token）
$h = @{ Authorization = "Bearer <token>" }
irm "http://localhost:3000/api/agent/sessions" -Headers $h

# Git（前后端同一个仓库，在根目录操作）
git status
git add action-agent-nest/   # 按子系统分批暂存
git add src/
git commit -m "title" -m "body"   # PowerShell 用多个 -m，勿用 bash heredoc
git push
```
