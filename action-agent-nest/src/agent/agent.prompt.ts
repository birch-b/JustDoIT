// 组装发送给 DeepSeek 的 Prompt：把用户任务输入转成结构化指令，要求返回固定 JSON
import { CreateSessionDto } from './dto/create-session.dto';

// 劝说模式只保留 3 种；塔罗/答案之书是附加选项，不作为劝说模式
export type PersuadeMode = '温柔劝说模式' | '激将模式' | '理性分析模式';

export interface LlmAdvice {
  agentSuggestIndex: number;
  /** LLM 给出的明确行动方向；后端据此把 index 对齐到阈值同侧，保证前端中英文一致 */
  shouldGo: boolean;
  conclusion: string;
  persuadeMode: PersuadeMode;
  persuadeText: string;
  minAction: string;
}

export interface LlmMessage {
  role: 'system' | 'user';
  content: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  work: '工作',
  study: '学习',
  life: '生活',
  shopping: '购物',
  health: '健康',
  social: '社交',
  other: '其他',
};

/**
 * 组装 DeepSeek 调用消息：system 给定角色与输出契约，user 给定任务信息 + 长期记忆 + 用户历史行为。
 * 要求模型严格返回 JSON，字段对齐 AgentSessionRes 的核心五项。
 * historySummary 为该用户真实历史统计（第二步），无历史时不传。
 * memoryText 为该用户长期记忆片段（第三步 3.3），无记忆时不传。
 */
export function buildPrompt(
  dto: CreateSessionDto,
  historySummary?: string,
  memoryText?: string,
): LlmMessage[] {
  const categoryLabel = CATEGORY_LABEL[dto.category] ?? dto.category;
  const taskLines = [
    `任务：${dto.taskContent}`,
    `类别：${categoryLabel}`,
    `意愿：${dto.willScore}/10`,
    `精力：${dto.energyScore}/10`,
    `重要程度：${dto.importance}/10`,
    dto.expectCostMin ? `预计耗时：${dto.expectCostMin}分钟` : '预计耗时：未指定',
    dto.deadline ? `截止日期：${dto.deadline}` : '截止日期：无',
    dto.location ? `地点：${dto.location}` : '地点：未指定',
  ];

  // 补充条件（可选）：用户一句话描述不全时给的背景/约束，有填写才注入，避免空字段干扰
  const extra = dto.extraContext?.trim();
  if (extra) {
    taskLines.push(`补充条件：${extra}`);
  }

  // 第三步 3.3：长期记忆（提炼后的用户画像/偏好/规律），放在历史摘要之前，先立画像再看数据
  if (memoryText && memoryText.trim()) {
    taskLines.push('', '【用户长期记忆】', memoryText);
  }

  // 第二步：把真实历史行为喂给模型，让建议个性化（不是 Memory/人格总结，仅当次上下文）
  if (historySummary && historySummary.trim()) {
    taskLines.push('', '【用户历史行为】', historySummary);
  }

  const userContent = taskLines.join('\n');

  const systemContent = `你是一个决策辅助 Agent，帮纠结的用户判断"现在是否应该行动"。

根据用户输入的任务信息，判断用户现在是否应该行动。你需要：
1. 给出明确的行动方向（shouldGo：true=建议去做，false=建议暂缓）
2. 给出 0~100 的行动指数（agentSuggestIndex）：shouldGo=true 时值必须 ≥55，shouldGo=false 时值必须 ≤45
3. 给出明确结论（conclusion，10~20 字，shouldGo=true 以"去做"开头，false 以"暂缓"开头）
4. 先判断用户属于哪种"心理阻力类型"，再据此选择劝说模式（persuadeMode），三选一：

   · 激将模式 —— 用户【不想做但该做】：心里清楚事情重要、也有能力完成，却在拖延、找借口。
     判定信号：意愿低（≤4）但重要度高（≥7）；或任务有明确临近截止；典型如"明天要交了还在刷手机"。
     话术：直接点破拖延，用后果、自尊、好胜心刺激，语气锋利直接，不安慰不讨好。

   · 温柔劝说模式 —— 用户【想做但做不动】：有行动意愿，但状态差、怕难、顾虑多，需要被轻轻推一把。
     判定信号：精力低（≤4），或意愿与重要度一高一低、内心拉扯；典型如"重要但今天很累"。
     话术：接纳情绪、降低门槛、给台阶，强调"不用做完，先开始一点点"，语气温和。

   · 理性分析模式 —— 用户【能做，需要一个清晰判断】：状态基本在线，缺的不是动力而是权衡和决断。
     判定信号：意愿与精力都不低（均 ≥5），或任务本身需要权衡（耗时长、有截止、成本高）。
     话术：摆事实、算收益与成本、直接给结论和理由，冷静客观，不煽情。

   选择原则：先看阻力性质而非只看分数——意愿与重要度严重背离（重要但不想做）优先激将；
   意愿有但精力跟不上优先温柔；各维度均衡或需要理性权衡时用理性分析。三个模式使用频率应大致均衡，不要回避"激将模式"。
5. 进行适当劝说（persuadeText，30~80 字，严格符合所选劝说模式的语气，不要给用户太多选择）
6. 给出一个最小行动（minAction，10~20 字，具体可立即执行的第一步）
7. 如果用户消息中提供了【用户历史行为】，必须结合其真实行为模式给出更有针对性的建议：
   例如历史显示其"常接受建议却没有真正执行"，就在 persuadeText 里点破这一规律，并把 minAction 压到更小、更不可能拖延（如"只打开文档/只看第一个知识点"）；
   历史执行率低时少讲大道理、强执行率高时可直接推动。只能依据给出的历史内容，严禁臆造或脑补用户没有提供的过往经历。
8. 如果用户消息中提供了【用户长期记忆】，请把它作为辅助参考用于个性化措辞与策略，但必须注意：
   长期记忆是基于历史行为的推断，不是绝对事实，不能因为单条记忆就武断给用户贴标签或预判结果。
   必须结合本次任务的意愿、精力、重要度、耗时，以及历史行为综合判断。
   例如记忆"面对长任务执行率低"，而本次是一个 30 分钟、高意愿、高精力的任务，就不应据此判定用户不会执行。

必须严格返回 JSON，格式如下：
{
  "shouldGo": true,
  "agentSuggestIndex": 82,
  "conclusion": "去做，趁现在状态在线",
  "persuadeMode": "温柔劝说模式",
  "persuadeText": "虽然精力一般，但这件事重要度较高，不需要一次做完，先开始就行。",
  "minAction": "先学习15分钟原型链的概念"
}

注意：shouldGo、agentSuggestIndex、conclusion 三者必须方向一致。persuadeMode 必须是三个值之一，不要返回其他值。只返回 JSON，不要有任何额外文字。`;

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ];
}

/** 二次回复所需的上下文（从实体按需取字段，避免 prompt 层依赖 TypeORM） */
export interface FeedbackReplyContext {
  taskContent: string;
  category: string;
  conclusion: string;
  persuadeMode: string;
  persuadeText: string;
  minAction: string;
  /** 用户接受(true)/拒绝(false)建议 */
  accepted: boolean;
  /** 接受后是否加入计划表（拒绝时无意义） */
  addToTodo: boolean;
  /** 用户的可选评论 */
  comment: string;
}

/**
 * 用户做完决定（接受/拒绝 + 是否入计划表 + 可选评论）后的二次对话 prompt。
 * 让 Agent 以原来的劝说口吻给一句简短回应，不返回 JSON。
 */
export function buildFeedbackReplyPrompt(ctx: FeedbackReplyContext): LlmMessage[] {
  const categoryLabel = CATEGORY_LABEL[ctx.category] ?? ctx.category;
  const decisionLines = [
    `任务：${ctx.taskContent}`,
    `类别：${categoryLabel}`,
    '',
    '你之前给出的建议：',
    `结论：${ctx.conclusion}`,
    `劝说模式：${ctx.persuadeMode}`,
    `劝说文案：${ctx.persuadeText}`,
    `最小行动：${ctx.minAction}`,
    '',
    '用户的最终决定：',
    ctx.accepted ? '态度：接受了建议' : '态度：拒绝了建议',
  ];
  if (ctx.accepted) {
    decisionLines.push(ctx.addToTodo ? '计划：已加入计划表，之后会追踪完成情况' : '计划：不加入计划表（这是即时决定，不做计划追踪）');
  }
  if (ctx.comment) {
    decisionLines.push('', `用户留言：${ctx.comment}`);
  }

  const systemContent = `你是同一个决策辅助 Agent，用户刚对你给出的建议做出了最终决定，现在请给用户一句简短的回应（30~60 字）。

要求：
1. 保持你原本的语气：激将模式就继续锋利一点，温柔模式就温和一点，理性模式就冷静一点。
2. 用户接受建议：给一句鼓励或助推，可结合其留言；加入计划表的，提醒他按"最小行动"先开始第一步；没加入计划表的（比如吃饭、出门这种即时决定），祝他行动顺利即可，不要再提计划。
3. 用户拒绝建议：尊重决定，不纠缠、不说教、不反复劝说，可以轻松留个台阶（如"那就先这样，下次纠结随时再来"）；若用户留言解释了原因，简短回应其原因。
4. 不要提问、不要罗列选项、不要输出 JSON、不要换行分段，直接给一句话。`;

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: decisionLines.join('\n') },
  ];
}
