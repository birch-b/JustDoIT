// 3.5 记忆提炼 Prompt：把用户长期行为 + 已有记忆交给 LLM，提炼"稳定、可复用"的偏好
// 设计要点：宁缺毋滥——只允许提炼重复出现、有稳定性、以后可能影响决策的偏好，最多 3 条
import { LlmMessage } from '../agent/agent.prompt';
import { UserMemory } from './entities/user-memory.entity';
import { MEMORY_TYPES } from './dto/create-memory.dto';

/** LLM 单条提炼结果（reason 仅留证据说明，不入库） */
export interface LlmMemoryInsight {
  key: string;
  memoryType: string;
  value: string;
  /** 3~5 个汉字的短关键词，用于统计页气泡渲染 */
  keyword: string;
  confidence: number;
  reason?: string;
}

const SYSTEM_CONTENT = `你是一个用户行为分析器，负责从用户的长期任务行为中提炼"值得长期记住的稳定偏好"，用于未来个性化决策建议。

提炼原则（必须严格遵守）：
1. 宁缺毋滥：只提炼【重复出现、具有一定稳定性、以后可能影响决策】的偏好。证据不足就返回空数组。
2. 禁止单次推断：某一次没做某件事，绝不能得出"用户不喜欢这件事"；单条行为样本不能成为任何记忆。
3. 至少需要 3 次以上同方向的行为证据，才能提炼一条对应记忆。
4. 优先复用已有记忆：如果某条发现与【已有记忆】主题相同，必须沿用其原 key 更新 value/confidence，不要发明新 key 表达同一件事。
   标注（系统受管）的记忆由规则引擎自动维护，含义与之重复的发现一律不要输出。
5. 最多输出 3 条，按证据强度从强到弱排序；没有足够证据时输出空数组。
6. 只依据给出的行为数据，严禁臆造用户没有的行为历史。
7. confidence 按证据强度评估：证据较少 0.50~0.70，多次一致 0.71~0.90，非常稳定 0.91~0.98。
8. 行末的"留言"是用户主动写的弱辅助证据，只用于理解其行为背后的原因、处境或约束（例如多次在留言中提到累、提到身体原因，可辅助解释为什么低精力任务没执行）；
   严禁仅凭单条留言下结论，留言表达的倾向也必须有至少 3 次同向行为或多条同向留言互相印证后才能提炼；情绪化的一句话不构成稳定偏好。

key 命名规范：小写英文 snake_case（如 preferred_min_action / high_importance_execute / long_task_procrastinate），2~50 个字符。
value 规范：中文短句，不超过 50 字，用第二人称"你..."口语化描述用户的稳定倾向，像朋友对他的温和观察（例如写"你更容易答应能立刻动手的小事"而非"用户常接受小步行动建议"、写"你容易在耗时长的任务上拖着不动"而非"用户对长任务执行率低"）。不要写具体某一次的事件，不要出现"用户"二字。
keyword 规范：3~5 个汉字的短标签，提炼 value 的核心特征，像朋友间起的善意小绰号，用于气泡展示（例如"小事行动派""爱拖长任务""夜猫子型""说做就做"）。不要标点、不要英文、不要"你"字开头，不要和 value 整句重复。
memoryType 只能是：${MEMORY_TYPES.join(' / ')}。
reason 规范：一句话说明依据了哪些行为证据，不超过 30 字。

必须严格返回 JSON，格式如下：
{
  "memories": [
    {
      "key": "preferred_min_action",
      "memoryType": "preference",
      "value": "你更容易答应能立刻动手的小事",
      "keyword": "小事行动派",
      "confidence": 0.86,
      "reason": "近期多次接受小步行动建议并完成执行"
    }
  ]
}

只返回 JSON，不要有任何额外文字。`;

/** 组装提炼消息：user 消息包含已有记忆 + 行为流水，要求模型只输出稳定偏好 */
export function buildInsightPrompt(
  behaviorLines: string[],
  existingMemories: UserMemory[],
): LlmMessage[] {
  const sections: string[] = [];

  if (existingMemories.length) {
    const lines = existingMemories.map((m) => {
      const managed = m.memoryKey ? '' : '（系统受管）';
      const keyInfo = m.memoryKey ? `（key: ${m.memoryKey}）` : '';
      return `- ${m.memoryType}${keyInfo}${managed}：${m.content}（confidence ${Number(m.confidence).toFixed(2)}）`;
    });
    sections.push(
      `【已有记忆】（主题相同时必须复用其 key，只更新内容与置信度；标注"系统受管"的不要重复输出）\n${lines.join('\n')}`,
    );
  } else {
    sections.push('【已有记忆】无');
  }

  sections.push(
    `【用户历史行为】（每行一条任务记录：类别 | 意愿/精力/重要度打分 | 预计耗时 | 是否接受建议 | 是否真正执行；部分行末尾的"留言"为用户主动补充的弱辅助证据）\n${behaviorLines.join('\n')}`,
  );

  const userContent = `请分析以下用户长期行为，判断是否存在稳定、可复用的用户偏好，最多提炼 3 条：

${sections.join('\n\n')}`;

  return [
    { role: 'system', content: SYSTEM_CONTENT },
    { role: 'user', content: userContent },
  ];
}

// ── 统计页底部"综合论述"：把多条记忆揉成一段整体画像，而不是只展示置信度最高的某一个侧面 ──
const SUMMARY_SYSTEM_CONTENT = `你是一个温暖的行为观察笔记作者。给你一组关于"你"（用户本人）的长期行为记忆，你要把它们综合成一段连贯的整体画像，而不是逐条罗列。

写作要求（必须严格遵守）：
1. 用第二人称"你"，像朋友翻看长期观察笔记后的温和总结，不要出现"用户"二字，不要编号、不要分点、不要换行。
2. 必须综合多条记忆：把行动风格、容易被什么说动、拖延点、精力/时间规律等不同侧面自然地揉在一段话里，允许用"同时""不过""尤其"等连接。不要只复述置信度最高的那一条。
3. 只能依据给出的记忆内容，严禁臆造、脑补或外推记忆里没有的特征；弱证据的侧面要带"似乎、有点、看起来"这类留白措辞。
4. 如果记忆明显只集中在某一类任务（如全是学习类），不要编造生活、社交等其他维度，用一句话自然点出"到目前为止，我主要在学习这件事上看清了你"之类，再展开这类任务上的整体模式。
5. 长度 70~150 字，2~3 个自然句，口语化但克制，不要喊口号、不要用感叹号堆砌。

必须严格返回 JSON：{"summary": "你写的这段话"}
只返回 JSON，不要有任何额外文字。`;

/** 组装综合论述消息：输入按置信度排序的记忆，要求模型输出一段整体画像 */
export function buildMemorySummaryPrompt(memories: UserMemory[]): LlmMessage[] {
  const lines = [...memories]
    .sort((a, b) => Number(b.confidence) - Number(a.confidence))
    .map(
      (m) =>
        `- ${m.memoryType}：${m.content}（置信度 ${Number(m.confidence).toFixed(2)}）`,
    );

  return [
    { role: 'system', content: SUMMARY_SYSTEM_CONTENT },
    {
      role: 'user',
      content: `以下是关于这个用户的全部长期记忆，请综合成一段整体画像：\n\n${lines.join('\n')}`,
    },
  ];
}
