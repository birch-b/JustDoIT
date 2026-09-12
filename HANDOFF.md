# HANDOFF - JUST DO IT（今日行动师）交接文档

> 更新时间：2026-09-09

决策辅助应用：帮助纠结的用户做「做不做」的决定。Vue3 前端 + NestJS 后端（含 LLM 大模型 + 答案之书/塔罗牌 API）。

- 前端：`d:\just do it\src`（Vue3 + Vite + Pinia + Tailwind + TypeScript）
- 后端：`d:\just do it\action-agent-nest`（NestJS + TypeORM + MySQL）

---

## 一、当前任务

1. ~~首页待办勾选框点击无效~~ → 已修复（漏 import SketchCheckbox）
2. ~~反馈三按钮与计划表功能冲突~~ → 已简化为「我接受 / 我拒绝」两个按钮
3. ~~答案之书和塔罗牌供用户选择、塔罗默认抽 4 张~~ → 已完成
4. ~~答案之书/塔罗牌对接真实后端接口~~ → 已联调通过
5. **当前状态**：前端功能全部可用（mock 会话 + 真实神秘加成接口）；后端 Agent 业务主接口（会话创建/反馈/历史/统计/todo CRUD）未开发

⚠️ **后端当前未运行**（后台 dev 进程已退出）。需要时在 `action-agent-nest` 目录执行 `npm run start:dev`。

---

## 二、已完成的内容

### 前端（Vue3）

**手绘风格组件**（`src/components/sketch/`）：
- `SketchBorder.vue` 手绘缠绕边框卡片（边框 SVG 已向边缘收缩，避免文字重叠）
- `LinearButton.vue` SVG 贝塞尔波浪边框按钮，hover 薄荷绿 `#A9C8C2`
- `SketchCheckbox.vue` 空心方框勾选框，支持 v-model、decorative 装饰模式
- `SketchClock.vue` 时钟，`:score`(0-100) 映射指针角度，`:size`/`:animated`
- `DecorDotCluster.vue` 随机波点簇（引用 SketchDot.vue）
- `DualTextBlock.vue`、`PageWrapper.vue`

**页面**（`src/views/`）：
- `Dashboard.vue` 首页：时钟+行动按钮 → **我的计划表 TO DO LIST** → 历史会话卡片
  - 待办可勾选完成（对勾+删除线+变淡），未完成优先展示，已完成折叠区可展开/取消/清除
  - 标题右侧实时显示 `X PENDING · Y DONE`
- `TaskCreate.vue` 任务表单：纠结分类按钮组、三滑块（意愿/精力/重要度）、可选耗时/截止/地点
  - **神秘加成两个开关**：答案之书（默认勾选）、塔罗牌 4 张（默认不勾），整行 label 可点击
  - 提交时调真实后端接口（答案之书/塔罗），失败自动降级 mock
- `SessionResult.vue` 结果页：
  - 结论卡内展示答案之书神谕（「」引用）+ 塔罗四元素牌阵（火/水/风/土 4 格）
  - 反馈区只有 **✓ 我接受 / ✕ 我拒绝** 两个按钮，无弹窗
  - 接受 → 自动加入计划表；完成与否由计划表勾选追踪
- `Stats.vue`、`HistoryDetail.vue`、`Login.vue`、`Register.vue`、`Profile.vue`

**数据层**：
- `src/store/todoStore.ts` 待办（localStorage `jdi_todos`），done + completedAt
- `src/store/agentStore.ts` mock 会话（含塔罗 mock 抽 4 张、答案之书 10 条兜底文案、3 条 demo 数据）
- `src/store/userStore.ts` localStorage mock 用户（未对接后端）
- `src/types/index.ts`：`TaskCreateReq` 含 `enableTarot`/`enableAnswerBook`；`AgentSessionRes` 含 `tarotCards[]`/`answerBook`
- `src/api/agentApi.ts`：`fetchAnswerBook(question)` / `fetchTarot()` 调真实接口，失败返回 null
- `vite.config.ts`：`/api` 代理到 `http://localhost:3000`

### 后端（NestJS）

- 全局前缀 `/api`，MySQL 连接正常（`.env` 真实密码，库 `action_agent_nest_db`）
- User 模块：注册/登录（bcrypt + JWT）已测试通过，**前端已对接**（`src/api/userApi.ts` + userStore 存 JWT，注册/登录/退出全链路实测通过）
- JWT 鉴权：`jwt.strategy.ts` / `jwt-auth.guard.ts` / `get-user.decorator.ts`
- **5 张表实体**（`src/agent/entities/`）：task（含 `category`/`enableTarot`/`enableAnswerBook`）、task_session、action_record（TEXT 列 nullable）、todo（`done` + `completedAt`）、user
- **答案之书接口**：`GET /api/agent/answer-book?question=xxx` ✅ 真实调通（uapis.cn，免费）
- **塔罗牌接口**：`POST /api/agent/tarot` ✅ 真实调通（妖狐 API，单张抽牌）
- `main.ts` 有 ValidationPipe + enableCors

### 已验证的联调结果

- 答案之书：真实返回如「答案会让你微笑。」（非 mock 文案）
- 塔罗牌：真实抽到 愚者正位/教皇正位/塔正位/魔术师逆位 等
- 前端提交 → 结果页展示全链路浏览器自动化验证通过

---

## 三、卡住的问题

| 问题 | 状态 | 说明 |
|---|---|---|
| DeepSeek LLM key 未填 | ⏳ 等用户提供 | `.env` 的 `LLM_API_KEY=sk‑xxxx你的key`，Agent 核心建议逻辑依赖它 |
| 塔罗已改为单张抽牌 | 已解决 | 妖狐接口有放回随机，抽多张会重复，现 SPREAD_COUNT=1 只抽 1 张 |

---

## 四、下一步计划（按优先级）

1. **后端 DeepSeek LLM 服务**：Prompt 组装 + `POST /api/agent/session/create`（JWT 守卫），返回行动指数/结论/劝说文案/最小行动
2. **后端其余 Agent 接口**：反馈提交、历史详情、统计、todo CRUD
3. **前端对接后端**：~~userStore~~（已完成，登录注册走真实接口 + JWT）；剩 agentStore/todoStore 从 mock 换成 API 调用
4. 统计页加纠结分类分布图表（task.category）
5. 结果页塔罗牌可扩展展示关键词/解读/牌面图（后端已返回 `keywords`/`description`/`imageUrl`，前端目前只显示牌名+正逆位）
6. 考虑在计划表勾选完成时回写 action_record 的 `isExecute`，打通「接受→执行」数据链路

---

## 五、踩过的坑

1. **MySQL Access denied**：`.env` 密码是占位符 → 改真实密码
2. **BLOB/TEXT 列不能设 default**：action_record 的 executeResult 用 `default:''` 报错 → 改 `nullable: true`
3. **PowerShell 不支持 Linux curl 语法**：测试接口用 `irm`（Invoke-RestMethod）代替 `curl -X`
4. **`Missing script start:dev`**：必须在 `action-agent-nest` 目录下运行
5. **EADDRINUSE :::3000**（踩了多次）：后台 dev server 残留占端口，再启一个就崩。彻底清理：`Get-NetTCPConnection -LocalPort 3000 -State Listen` 找 PID → `Stop-Process -Id <pid> -Force`，同时停掉旧的后台任务再启动
6. **改 `.env` 后端不生效**：`nest start --watch` 只监听 .ts 文件，**改 .env 必须手动重启后端**
7. **编辑器改了 .env 但没保存**：磁盘上还是旧 key，导致接口报"密钥不正确"，排查半天其实是未保存
8. **缘分居塔罗 API**：示例 key 是假的（非法密钥）；注册真实 key 后是**试用账号**，塔罗解读属会员付费接口（"当前为试用账号，仅支持基础接口"）→ 最终换成**妖狐 API**（免费单张抽牌）
9. **Vue 组件模板用了但没 import**：Dashboard 用了 SketchCheckbox 却没 import，渲染为空且无报错提示，排查很久；vue-tsc 能查出来
10. **Vue 模板内联事件在 label 外点文字不生效**：勾选行包 `<label>` 后整行可点
11. **旧 dev server 占端口导致 HMR 状态不一致**：重启干净 server 解决
12. **` FsF1...` 类似全角字符风险**：.env 里 LLM key 占位符含全角连字符 `‑`（非 `-`），填真实 key 时注意用半角

---

## 附：常用命令

```powershell
# 前端（d:\just do it）
npm run dev          # Vite，端口 5173

# 后端（d:\just do it\action-agent-nest）
npm run start:dev    # Nest，端口 3000，watch 模式

# 前端类型检查（d:\just do it）
npx vue-tsc --noEmit

# 测试接口（PowerShell）
irm "http://localhost:3000/api/agent/answer-book?question=test"
irm "http://localhost:3000/api/agent/tarot" -Method Post -ContentType "application/json" -Body '{}'
```
