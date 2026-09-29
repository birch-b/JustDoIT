# HANDOFF - JUST DO IT（今日行动师）交接文档

> 更新时间：2026-09-29

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

2026-09-19 **第二步：把历史行为喂给 LLM**（commit `91caa89`）：`createSession` 在保存本次任务前先算 `buildHistorySummary`，注入 user prompt 的【用户历史行为】段；并把摘要从"次数/执行率"增强为**跨维度行为规律**（方案 B）。实测 LLM 已能引用真实执行率做个性化激将（如"5 个任务只完成 1 次，25% 执行率"）。**未引入向量库/RAG**。详见下文「LLM 建议链路」。

2026-09-21~22 **第三步：用户长期记忆 Memory（3.1-3.5 全部完成）**：
- **3.1-3.3 已提交推送**（commit `9f50839`）：`user_memory` 表 + MemoryModule/Service/Controller（`/api/memory` CRUD，JWT + 归属校验）+ 记忆注入 DeepSeek Prompt
- **3.4 行为反馈更新记忆 + 3.5 LLM 自动提炼偏好已完成**（本地改动待提交），含方案 A 时间窗口放弃判定；未引入 RAG/Embedding/向量库/多 Agent，接口兼容
- 详见下文「Memory 模块」

2026-09-23 **登录滑动过期**（前端本地改动待提交）：连续 24 小时未进入系统自动清除登录态踢回登录页；详见下文「前端数据层」。

2026-09-29 **今日天气加成 + 神秘加成都由主 LLM 统一解读 + 记忆综合论述**（本地改动待提交）：
- 新增第三个神秘加成**「今日天气」**：城市下拉（44 个常用城市，localStorage 记住上次选择）→ `GET /agent/weather`（whyta.cn 我的天气，中文城市内置映射表）→ 天气卡 + **1-10 感受滑块**；天气摘要/城市/打分落 task 表三列并注入 prompt（system 第 9 条规则：低分共情降门槛、户外任务提示天气成本、纯室内任务不强行谈天气）。**WEATHER_API_KEY（whyta）已实测可用**：接口返回英文描述（且大小写不统一如 `Partly Cloudy `），服务端用 WEATHER_DESC 表翻译（toTitleCase 归一大小写），实测 `/api/agent/weather?city=武汉` → `多云 · 25℃（体感26℃） · 湿度65% · 西北风 9km/h`；无 key/失败时接口返回 data:null、前端优雅兜底不阻塞提交
- **塔罗牌一句话解读**：牌面提前抽好注入主 prompt，主 LLM 同一次回答里输出 `tarotReading`（≤40字，与结论同向），不再独立调一次 LLM
- **答案之书改为"随机原文 + LLM 圆场"**：uapis.cn 随机答案**照调照显示**（保留随机感），原文注入主 prompt，主 LLM 输出 `answerBookReading` 顺着意象把矛盾圆回结论（同向呼应、反向转换视角化解）；规则兜底时无解读
- 统计页关键词卡下层：从"只显示置信度 top1 记忆原文"改为 **LLM 综合论述**（`GET /memory/summary`，揉合全部记忆写 2-3 句整体画像，证据集中在某类任务时如实说明不臆造；30 分钟内容哈希缓存，记忆变化自动重生成）
- user_memory 加 `keyword varchar(10)`（3.5 prompt 要求返回 3-5 字汉字关键词，`/^[\u4e00-\u9fa5]{3,5}$/`）；3.4 模板记忆带类别前缀关键词
- 修复 3.5 Dice 相似度去重 bug：同 key（existingKeys 内）豁免相似度检查，避免 LLM 复用 key 改写老记忆时被误判重复丢弃

2026-09-24 **反馈二次对话 + 补充条件 + 关键词汇总**（本地改动待提交）：
- 反馈区支持**可选评论**；用户点接受/拒绝（+ 是否入计划表 + 评论）打包后，后端**第二次调用 DeepSeek** 生成一句 Agent 回应，评论与回应均持久化；这是纯聊天回应，**不触发任何记忆更新**（一个会话仍只在反馈时更新一次记忆）
- 任务可填**补充条件**（extraContext，一句话描述不全时的背景/约束，留空为空，prompt 有填写才注入）
- 接受建议不再自动入计划表，改为先询问（吃饭/出门这类即时决定可不入表）
- 原生 window.confirm 全部换成手绘风 `SketchConfirmDialog`（单条/批量删除）
- 统计页顶部新增「关于你的关键词」卡（读 `/api/memory`，置信度 top8）；气泡点改手绘不规则墨圈
- 3.5 提炼的行为流水带上用户评论（弱辅助证据，≥3 次同向才可用；**agentReply 绝不回灌**防自我强化）

| 模块 | 状态 |
|---|---|
| 用户注册/登录（JWT，用户名或邮箱均可登录） | ✅ 真实接口 |
| 邮箱验证码（注册 / 找回密码 / 注销账户，QQ 邮箱 SMTP） | ✅ |
| Agent 会话创建/列表/详情/历史/反馈/删除 | ✅ 真实接口 |
| 计划表待办 CRUD + 「接受→执行」回写 | ✅ 真实接口 |
| 答案之书 / 塔罗牌（单张，含 LLM 一句话解读） | ✅ 第三方真实接口，失败本地兜底 |
| **今日天气加成**（城市下拉 → 实时天气 + 1-10 打分 → 注入 prompt） | ✅ whyta.cn，key 待激活，无 key 优雅兜底 |
| 记忆综合论述（统计页 LLM 整体画像） | ✅ `/memory/summary`，30 分钟缓存 |
| 统计页（前端基于会话列表计算，lieflat 风纯 SVG 图表） | ✅ |
| **DeepSeek LLM 大模型建议** | ✅ **已接入**：LLM 生成指数/结论/劝说/最小行动，失败自动降级规则引擎 |
| **用户长期记忆 Memory（第三步）** | ✅ 表 + CRUD + Prompt 注入 + 行为反馈更新（3.4）+ LLM 提炼（3.5） |

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
| POST | `/agent/action/record` | 行为反馈 **upsert**（按 sessionId，校验归属）；`withReply:true` 时同步二次调 LLM 生成 Agent 回应（见下） |
| DELETE | `/agent/session/:id` | 删除会话：级联删 关联待办 → 反馈 → 会话 → 任务 |
| GET | `/agent/answer-book` | 公开，答案之书（uapis.cn）；createSession 内部直接调 service |
| POST | `/agent/tarot` | 公开，塔罗抽 1 张（妖狐 API，后端另有本地兜底牌面） |
| GET | `/agent/weather?city=武汉` | 公开，今日天气（whyta.cn），返回 `{code:0,data:WeatherInfo|null}`；未配 key/查询失败 data 为 null |

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
- **补充条件 extraContext（2026-09-24）**：task 表加 `extraContext varchar(500) default ''`（synchronize 自动加列，存量任务默认空）；DTO 可选 ≤500 字，service 存前 trim。`buildUserPrompt` **有填写才注入**「补充条件：xxx」行，空值时 prompt 完全不出现该字段
- **反馈二次对话（2026-09-24）**：action_record 加两列 `feedbackComment` / `agentReply`（均 varchar(500) 可空）；ActionRecordDto 加 `comment?`（用户可选评论）/ `addToTodo?` / `withReply?`
  - 只有 `withReply:true`（用户点接受/拒绝那次反馈）才触发；计划表勾选执行的回写不带该标记，**不触发二次回复、不覆盖原评论**
  - `buildFeedbackReplyPrompt(ctx)`（agent.prompt.ts）：把 原建议（结论/模式/文案/最小行动）+ 用户态度 + 是否入计划表 + 评论打包，system 要求按原劝说模式口吻给 30~60 字一句话；接受+入表提醒按最小行动起步、接受+不入表（即时决定）祝福不提计划、拒绝则尊重不纠缠；不返回 JSON
  - `llm.service.ts` 新增通用纯文本对话 `chatText(messages, temperature)`（不强制 json_object，空白压平、截断 500 字，失败 null）；LLM 不可用时 service 按 接受/拒绝×入表 三种本地兜底文案
  - **关键边界：二次回复是纯聊天，不写记忆**；且 agentReply 永不进入任何记忆提炼输入（防模型自我强化）
- **神秘加成与主 LLM 的关系（2026-09-29 定型）**：三个加成全部在 `createSession` 主 LLM 调用前后处理，`buildPrompt(dto, historySummary, memoryText, extras?)` 的 extras 接收 `{ tarotCard?, answerBookText? }`：
  - **塔罗**：先抽牌（第三方失败本地随机兜底）→ 牌面注入 user prompt「塔罗牌：X · 正/逆位」→ 主回答 JSON 多返回 `tarotReading`（≤40字，system 第 10 条要求与结论同向）
  - **答案之书**：先调 uapis.cn 抽随机原文（**原文不改、照存照显**）→ 注入「答案之书给出的随机回应：「…」」→ 主回答多返回 `answerBookReading`（system 第 11 条：顺着意象圆回结论，看似相反时转换视角化解，禁止承认矛盾）
  - **今日天气**：不走随机接口；`weather.service.ts` 调 whyta.cn（`GET https://whyta.cn/api/tianqi?key=&city=`），内置约 40 个中文城市→英文映射、16 风向中英映射，兼容顶层/`data`/`result` 包裹与 `weatherDesc` 字符串/`[{value}]` 数组两种结构；摘要格式 `小雨 · 22℃（体感21℃） · 湿度70% · 东风 8km/h`。task 的 `weatherCity/weatherText/weatherScore` 齐全才注入 prompt（system 第 9 条）；未配 key 或失败时三字段为 null、prompt 无天气段
  - `tarotReading/answerBookReading` 都只在 LLM 成功路径有值；规则兜底（LLM 挂）时为 null，前端不显示解读行
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

**Memory 模块**（`src/memory/`，第三步，`/memory` 全部需 JWT + userId 归属校验）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/memory` | 当前用户全部记忆（updatedAt 倒序） |
| GET | `/memory/summary` | LLM 综合论述：把全部记忆揉成 2-3 句整体画像（2026-09-29） |
| POST | `/memory` | 手动新增（memoryType 白名单 + content 长度校验） |
| PATCH | `/memory/:id` | 修改（校验归属） |
| DELETE | `/memory/:id` | 删除（校验归属） |

- **综合论述（2026-09-29，`memory-insight.prompt.ts` 的 summary 模板）**：与"只取 top1 记忆原文"不同，`/memory/summary` 调 LLM 跨记忆写整体画像（行动风格/被什么说动/类别差异），prompt 明确"证据只集中在某类任务时如实说明、不得编造其他维度"；服务端按用户记忆内容的 hash 缓存 30 分钟，记忆变动 hash 变即重生成；LLM 失败返回 null，前端先显示 top1 兜底再无缝替换

- **3.1 表**：`user_memory`（id / user_id / memory_type / content / confidence 0~1 / created_at / updated_at / **memory_key 可空**——3.5 LLM 受管记忆的 upsert 键 / **keyword varchar(10) 可空**——3-5 字汉字短标签，2026-09-29 加）
- **3.3 注入 Prompt**：`createSession` 时把用户长期记忆注入 user prompt【用户长期记忆】段；system 第 8 条约束「记忆是历史推断不是绝对事实，仅供参考，不得武断贴标签」
- **3.4 行为反馈更新记忆**（`behavior-memory.service.ts`，规则引擎零 LLM）：`submitRecord` 保存反馈后同步调 `syncFromFeedback(userId, category)`——重算该类别统计 → 增/改/翻转/回收该类别的**受管模板记忆**（接受倾向 behavior + 执行倾向 pattern，正反文案各一），其他记忆一律不动。阈值：单类别样本 ≥3 才成结论；接受/执行率 ≥0.7 或 ≤0.3 触发；接受满 10 次或执行满 6 次直接拉满 confidence 0.95；confidence 0~1 随样本双向增减
  - **方案 A 放弃判定**：isExecute=false 区分不出"没开始"与"放弃"——有 deadline 按 deadline+2 天、否则按反馈记录创建后 7 天；窗口内视为待执行（不进执行率分母），超期视为放弃（计入负面）
  - `deleteSession`/`deleteSessions` 删除后按类别重算，防记忆残留
- **3.5 LLM 自动提炼偏好**（`llm-memory.service.ts` + `memory-insight.prompt.ts`）：反馈写入后异步触发（fire-and-forget 不阻塞接口），内存节流 10 分钟；行为流水 <5 条跳过（防过度推断，日志已区分"样本不足未调 LLM"与"LLM 真空返回"）。聚合最近 50 会话+反馈 → DeepSeek 提炼稳定偏好（最多 3 条/次；prompt 要求 ≥3 次同向证据、宁缺毋滥、复用已有 key、受管记忆禁止重复输出）。输出硬校验：key snake_case 规范 / memoryType 白名单 / value ≤200 / confidence 钳 0~1 / **keyword 须匹配 `/^[\u4e00-\u9fa5]{3,5}$/`（3-5 个汉字，不合法置空不丢条）** / 同 key 去重；与已有记忆字符 bigram Dice ≥0.6 丢弃（防语义重复）；按 memory_key upsert；存量上限 12 条超限回收最旧。任何失败只记日志不影响主流程
  - **Dice 去重 bug 修复（2026-09-29）**：原逻辑对所有 LLM 输出先做相似度去重再 upsert，导致 LLM 复用已有 key 改写老记忆（补 keyword/第二人称化）时被当重复丢弃（日志"返回 3 条去重后 0 条"）。现规则：key 在 existingKeys 集合内的**豁免相似度检查**直接 upsert，只对新 key 检查与其他记忆的相似度
  - **评论入流水（2026-09-24）**：行为行末尾有评论时追加 `留言:xxx`（截断 60 字），同一次提炼调用送出、零额外成本；prompt 第 8 条规定留言只是**弱辅助证据**（解释原因/处境/约束），严禁凭单条留言下结论，须 ≥3 次同向行为或多条同向留言互证；**只附 feedbackComment，绝不附 agentReply**
- `llm.module.ts`：共享 LlmService 的独立模块（解 MemoryModule↔AgentModule 循环依赖）；`llm.service.ts` 抽出通用 `chatJson(messages, temperature)`（json_object，失败返回 null）

- 6 张表：task、task_session、action_record、todo、user、user_memory（`synchronize: true` 自动建表）
  - 2026-09-24 加列（自动迁移）：`task.extra_context varchar(500) default ''`；`action_record.feedback_comment` / `action_record.agent_reply` 均 varchar(500) nullable
  - 2026-09-29 加列（自动迁移）：`task.weather_city varchar(50)` / `task.weather_text varchar(200)` / `task.weather_score int`（均 nullable，三者同时有值才算启用天气）；`task_session.tarot_reading varchar(200)` / `task_session.answer_book_reading varchar(200)`（均 nullable）；`user_memory.keyword varchar(10) nullable`

### 前端（Vue3）

**数据层**：

- `src/api/http.ts`：`authRequest` 统一封装——自动带 Bearer token、401 抛 `UnauthorizedError`、后端 `message`（含 ValidationPipe 数组）透传
- `src/api/`：`agentApi.ts` / `todoApi.ts` / `userApi.ts` 全部走真实后端；`toCardItem()` 把 HistoryDetail 映射成首页卡片；`memoryApi.ts`：`getMemories()` 读 `/api/memory` 供统计页关键词卡，`getMemorySummary()` 读 `/api/memory/summary` 综合论述（2026-09-29）；`agentApi.ts` 的 `fetchWeather(city)`（公开接口 try/catch 返回 null），`WeatherInfo` 类型定义在 `src/types/index.ts`
- `agentStore`：纯后端数据源，**mock 会话和 demo 数据已删除**；缓存会话列表，反馈/删除同步更新缓存。`submitRecord` 透传 `comment/addToTodo/withReply`，返回的 record 含 `feedbackComment/agentReply`（失败返回 undefined，由页面提示重试）
- `todoStore`：数据源后端 MySQL；首次登录把旧版 localStorage（`jdi_todos`）待办按 sessionId/内容去重**一次性迁移**后删除本地 key
  - `toggleDone`：乐观更新 → PATCH 后端 → 失败回滚；带 sessionId 的待办同时 upsert `ActionRecord.isExecute`，**「接受→执行」链路已打通**
- `userStore`：JWT + user + `lastActiveAt` 存 `jdi_current_user`；init 兼容旧 mock 格式（无 token 视为失效）；**登录滑动过期（2026-09-23）**——连续 24 小时未进入系统自动清除登录态，每次路由跳转 `checkActivity()` 检查：未超时刷新活跃时间戳续期，超时登出踢回登录页（旧缓存无时间戳视为过期）；退出登录同时清空 agent/todo 内存数据
- 路由守卫：每次跳转先过滑动过期检查；`requiresAuth` 未登录/过期带 `?redirect=` 跳登录页；已登录访问登录/注册/找回密码跳个人中心；`/history/:id` 永久重定向到 `/session/:id`

**页面/组件**（`src/views/`、`src/components/`）：

- `TaskCreate.vue`：分类按钮组 + 三滑块 + 可选耗时/截止/地点；神秘加成三个整行可点开关：答案之书（默认开）、塔罗（默认关，单张）、**今日天气（2026-09-29 新增，默认关）**；勾选天气展开**城市下拉**（44 个常用城市，选中即查询，localStorage key `jdi_weather_city` 记住上次选择）→ 天气卡（描述/气温/体感/湿度/风）→ **1-10 天气感受滑块**（默认 6）；查询失败显示提示但不阻塞提交（payload 不带天气字段）；**补充条件（可选）textarea**（≤500 字，纯手绘下划线样式，未填写提交空串）；提交真实接口
- `SessionResult.vue`：**会话页与历史详情已合并为统一页**（原 `HistoryDetail.vue` 已删除）；时钟/结论/神谕（答案之书原文 + `answerBookReading` 解读灰字）/单张塔罗（牌名正逆位 + `tarotReading` 解读）/**今日天气与当时打分（2026-09-29）**/原始任务输入（含补充条件回显）/最小行动/动态历史摘要
  - **反馈区（2026-09-24 重构）**：可选评论 textarea +「✓ 我接受 / ✕ 我拒绝」；点接受**先追问**是否加入计划表（即时决定可不入表），选定后把 态度+是否入表+评论 一次提交（`withReply:true`），回应展示在「Agent 的回应」区块；点拒绝直接提交。历史回看回显「我的留言」与持久化的 Agent 回应；已反馈仍可补「加入计划表」；右上角删除走手绘确认弹窗
- `Dashboard.vue`：计划表勾选/删除/清除已完成（`X PENDING · Y DONE`）+ 历史卡片；管理模式批量删除走手绘确认弹窗（文案带选中条数）
- `Stats.vue`：lieflat glance 风纯 SVG（零三方图表库），数据来自会话列表前端聚合：
  - **「关于你的关键词」卡（2026-09-24 新增，置顶整行；2026-09-29 重构）**：上层手绘墨圈气泡展示记忆 `keyword`（最多 6 个，前 2 名 HERO 薄荷色，sketchCirclePath + non-scaling-stroke + bubble-float 动画）；下层**综合论述**——先显示置信度 top1 记忆原文兜底，再异步调 `/memory/summary` 用 LLM 整体画像替换；记忆为空（新用户/样本不足）显示引导文案；整行宽卡片水平 padding 用 3rem（边框 SVG 非等比拉伸，左右边框内缩，见踩坑 23）
  - 总数/已执行/接受率/劝说模式分布/意愿-执行关系五个板块
  - 接受率卡：20 根手绘刻度（1 tick=5%），达成段薄荷上墨、未达成淡棕短刻度，逐根生长入场
  - 劝说模式分布：单位发丝线（1 竖线=1 次会话，手绘微抖），每 5 根一个点标，最高频模式整行走薄荷色；模式共 **3 种**（前端 `PersuadeMode` / `PERSUADE_MODES` 已同步删除塔罗模式）
  - 意愿×执行：散点气泡已改为**手绘不规则墨圈**（9 锚点半径 ±10% 确定性抖动 + 闭合 Catmull-Rom，比正圆生动、比涂鸦圆整）；实心=已执行/空心=未执行；y 轴各层严格等距（修复 0/1/2 刻度疏密不一）；全部抖动用确定性 hash，刷新一致；含 `prefers-reduced-motion` 降级
- `Login.vue` / `Register.vue` / `ForgotPassword.vue`（新增）：注册与找回密码均需邮箱验证码，复用 `EmailCodeInput.vue`（60s 倒计时）
- `Profile.vue`：资料展示/编辑（**仅本地生效，后端无更新接口**）、统计概览、邮箱验证码注销账户
- 手绘组件库：SketchBorder / LinearButton / SketchCheckbox / SketchClock / DecorDotCluster / DualTextBlock / PageWrapper；**SketchConfirmDialog（2026-09-24 新增）**：Teleport 到 body 的手绘确认弹窗（奶米底+缠绕边框+Esc/点遮罩取消+loading 锁定+缩放入场动画），全站删除类二次确认统一用它，**不要再用 window.confirm/alert**（alert 仅保留接口失败兜底提示）

### 已验证

- 注册收码 → 注册即登录 → 创建会话 → 结果页 → 接受入计划表 → 勾选完成回写执行状态，全链路真实接口
- 越权访问他人 session/todo 返回 403；未登录访问受保护接口 401
- 答案之书真实神谕；塔罗真实牌面（带 keywords/description/imageUrl，前端目前仅展示牌名+正逆位）
- **LLM 链路（2026-09-18）**：真实任务返回动态劝说文案（非内置四句模板）；指数与中英文结论方向一致；**激将模式**用「意愿 2 / 精力 6 / 重要度 9 + 临近截止」配方可稳定触发；LLM 返回非法/超时会静默降级规则文案（后端 warn 日志）
- **历史个性化（2026-09-19 实测）**：攒 5 个任务（仅完成 1 个）后再建「意愿 4 / 重要度 8 / 30min」任务，LLM 正确选激将模式并引用真实数据——劝说文案出现"5 个任务只完成 1 次，25% 的执行率"，minAction 压到"打开项目，只写一个函数"；证明历史规律确实进入了 prompt 并影响输出
- **Memory 链路（2026-09-21/22 实测）**：
  - 3.4：受管记忆 confidence 精确随样本更新；方案 A 双向验证（窗口内 isExecute=false 不进分母，超期未执行正确生成负面"接受建议却没真正执行"）；删除会话后记忆正确重算
  - 3.5：LLM 实测产出耗时维度偏好（`accept_short_learning_tasks` 0.85 / `reject_high_effort_exercise` 0.72）；健康类「2 拒 1 执行」未被武断成"不爱运动"（防过度推断生效）；与 3.4 受管记忆语义重复的 LLM 输出被 Dice 去重拦截
  - 3.4/3.5 互不干扰：受管记忆走模板文案即时修正，LLM 只写 memory_key 命名空间
  - 因果验证法：插入"劝说必须以『行动家，』开头"的记忆后，LLM 劝说文案确实以「行动家，」开头，证明记忆进入了 prompt
- **登录滑动过期（2026-09-23）**：vue-tsc 通过；旧缓存无时间戳视为过期，刷新页面要求重新登录（待浏览器实测）
- **二次对话/补充条件/关键词（2026-09-24 E2E 实测）**：
  - 接受+入表+评论「可以，我就这么干」→ Agent 回复引用了该任务最小行动（"先打开项目文件夹列出顶层目录"）；拒绝无评论 → 回复尊重决定不纠缠；两条路径 record 均正确持久化 feedbackComment/agentReply
  - e2e_m35（14 条反馈）提交带评论反馈后，3.5 异步提炼正常按 key 更新记忆，评论出现在行为流水中且无异常新记忆；记忆/关键词卡读取 `/api/memory` 正常
  - 前后端 tsc/vue-tsc 通过；synchronize 自动加列 task.extra_context、action_record.feedback_comment/agent_reply
- **天气/统一解读/综合论述（2026-09-29 实测）**：
  - 有效 key 下 `GET /api/agent/weather?city=武汉` 返回完整中文摘要（多云 · 25℃（体感26℃） · 湿度65% · 西北风 9km/h）；无效 key/错误城市返回 data:null，前端提示不阻塞提交；城市下拉选择即查询、localStorage 记忆正常
  - 勾选答案之书+塔罗的建会话链路：字段贯通（DTO→prompt extras→主回答 JSON→落库→toSessionRes 回显）已逐段确认，前后端类型检查通过；解读与结论同向/圆场的实际文案效果待建会话抽检
  - `/memory/summary` 对 e2e_m35 产出跨类别整体画像（学习类高接受执行 + 高强度健康任务拒绝），非单条记忆原文；统计页 top1 兜底→LLM 画像替换正常
  - 前后端 tsc/vue-tsc 通过；synchronize 自动加列 task.weather_city/weather_text/weather_score、task_session.tarot_reading/answer_book_reading、user_memory.keyword

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
**第二步（当前任务 + 历史行为 → DeepSeek）已完成 ✅**（commit `91caa89`），含方案 B 跨维度规律。
**第三步（Memory 用户长期记忆）已完成 ✅**（3.1-3.3 commit `9f50839`；3.4+3.5、登录滑动过期及 2026-09-24 二次对话/补充条件/关键词卡均已完成、本地待提交）。接下来：

1. **提交当前本地改动**（3.4/3.5 + 滑动过期 + 二次对话 + 补充条件 + 手绘确认弹窗 + 关键词卡/墨圈 + keyword 短标签 + 记忆综合论述 `/memory/summary` + 今日天气加成 + 塔罗/答案之书统一解读）
2. 后端补用户资料更新接口（username/email/bio），前端 `updateProfile` 改为真实调用
3. （可选）统计聚合接口，避免前端拉全量会话
4. 塔罗结果页展示关键词/牌面图（牌名+正逆位+LLM 解读已展示；keywords/description/imageUrl 后端已返回但前端未用）
5. 验证码存储替换为 Redis/DB（部署前必做）
6. Memory 完整管理页（统计页关键词卡已是只读入口；可再做增删改）
7. 更后阶段才考虑：RAG / 向量数据库 / Embedding / MCP / 多 Agent / 多轮对话（第三步已用规则引擎+轻量 LLM 提炼覆盖，暂不需要）

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
17. **TypeORM 加列再回滚（ER_DROP_INDEX_FK）**：给已有表加唯一索引列（memory_key）后回滚实体时，synchronize 想删唯一索引被外键阻塞、服务起不来 → 手动按「删外键 → 删索引 → 删列 → 重建外键」SQL 清理
18. **`isolatedModules` 下装饰器类型导入（TS1272）**：entity 里用枚举类型（如 `MemoryType`）做字段类型注解会编译报错 → 字段类型改 `string`，枚举只在运行时校验用
19. **3.5 节流占位**：`maybeExtractFromBehavior` 先占位再执行，样本不足也占坑 → 同轮 E2E 后续触发全被跳过；测试前重启服务重置内存 Map
20. **LLM 重复记忆退化**：LLM 可能用新 key 输出与 3.4 受管记忆语义重复的内容 → prompt 标注（系统受管）+ 服务端 Dice ≥0.6 去重双重兜底
21. **E2E 测试基建**：注册需邮箱验证码，用 node 脚本直插 DB 造测试账号；PowerShell 经请求发中文会变 `?`，含中文的 E2E 一律用 node fetch；`actualCostMin` 是 DTO 必传整数
22. **PowerShell 陷阱补充**：`&&` 不被支持（改 `;`）、commit 消息不能用 heredoc（改多个 `-m`）
23. **SketchBorder 宽卡片边框内缩压线**：边框 SVG 用 `preserveAspectRatio="none"` 随容器非等比拉伸，viewBox 中距边 6~12 单位的描边在**整行宽卡片**上被拉到距边缘约 40px，常规 1.5~2rem padding 的文字会压在线上；窄卡（1/3 行宽）无此问题。解法：宽卡片 padding 用 `2rem 3rem` 加大水平内边距（根治需改 SVG 用 vector-effect 或百分比路径，暂不做）
24. **浏览器原生 confirm/alert 风格割裂**：原生弹窗是系统蓝白样式，与手绘风严重不搭且无法定制 → 新增 SketchConfirmDialog 统一替换 confirm；alert 目前仅在接口异常兜底时保留
25. **散点图 y 轴刻度必须与层距同源**：曾为给底层圆点留半径导致 0→1 层距（10.2px）与 1→2（18px）不等，刻度列看起来对不齐；改为从基线起每层等距，圆心压在各自导轨线上
26. **随机神谕与 LLM 结论会打架**：塔罗解读/答案之书最初各自独立调一次 LLM（或纯随机 API），看不到主结论，实测出现"建议去做、答案之书说再等等"。最终方案（2026-09-29）：随机结果（牌面/答案之书原文）保留随机感，在主 LLM 调用**之前**抽好并注入 prompt，由同一次主回答输出解读，与结论同向（塔罗）或转换视角圆场（答案之书）。切忌为了一致性让 LLM 自己编"随机"答案——那就失去翻书的意义
27. **whyta 天气接口返回结构与文档示例有出入**：真实响应外层包 `{status,message,data}`，`weatherDesc` 是 `[{value:"晴"}]` 数组而非字符串；key 无效时 HTTP 200 但 `message:"Error:invalid appKey!"`。解析必须同时兼容顶层/`data`/`result` 包裹 + 字符串/数组两种 weatherDesc，并以"取不到描述即返回 null"兜底
28. **3.5 记忆去重豁免同 key**：Dice 相似度去重必须只对**新 key** 生效；同 key 是 upsert 改写，新 value 天然与旧 content 相似，参与去重会导致老记忆永远无法被 LLM 改写（见 Memory 模块 3.5）

---

## 附：常用命令

```powershell
# 前端（d:\just do it，用 pnpm；实际端口以 vite 启动日志为准，近期为 5175）
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
curl.exe -s "http://localhost:3000/api/agent/weather?city=武汉"   # PowerShell 里 curl 是别名，须用 curl.exe

# 测试受保护接口（先登录拿 token）
$h = @{ Authorization = "Bearer <token>" }
irm "http://localhost:3000/api/agent/sessions" -Headers $h
irm "http://localhost:3000/api/memory" -Headers $h          # 用户长期记忆列表

# E2E 测试账号（保留在库中，密码均为 Test123456）：e2e_m35 / e2e_m35b / e2e_m35c
# 3.5 提炼有 10 分钟内存节流，连续测试需重启后端重置节流 Map

# Git（前后端同一个仓库，在根目录操作）
git status
git add action-agent-nest/   # 按子系统分批暂存
git add src/
git commit -m "title" -m "body"   # PowerShell 用多个 -m，勿用 bash heredoc
git push
```
