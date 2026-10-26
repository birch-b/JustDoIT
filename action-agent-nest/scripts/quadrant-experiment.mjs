// 四象限独立维度实验 —— 直接调用 LlmService（绕过 Nest 容器）
// 用法：node scripts/quadrant-experiment.mjs
// 运行前：确保 .env 有 LLM_API_KEY；确保 dist 已构建（npm run build）

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 .env（如果有）
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
} catch (e) { /* dotenv 未安装就跳过 */ }

// 直接 require dist（不需要 Nest 容器）
const { LlmService } = require('../dist/agent/llm.service.js');
const { buildPrompt } = require('../dist/agent/agent.prompt.js');

const VALID_MODES = ['温柔劝说模式', '激将模式', '理性分析模式'];

// 四象限场景定义
const QUADRANTS = {
  A: {
    name: '合理 + 适合行动（基线）',
    dto: {
      taskContent: '写完这周的工作周报并提交给主管',
      category: 'work',
      willScore: 9,
      energyScore: 8,
      importance: 9,
      expectCostMin: 40,
      deadline: '今天 18:00',
      location: '在家/公司',
      extraContext: '本周素材都已经收集好，三个项目的进展记录整理在笔记里，只剩组织语言和调整格式',
      weatherScore: undefined,
      walletScore: undefined,
    },
    rationale: '意愿高、精力高、重要度高、有素材、临近截止——典型应该做也适合做的场景',
  },
  B: {
    name: '合理 + 当前不适合（目标）',
    dto: {
      taskContent: '报名「AI 产品经理实战认证课程」',
      category: 'study',
      willScore: 9,
      energyScore: 2,
      importance: 7,
      expectCostMin: 25,
      deadline: '本周日 23:00（报名截止）',
      location: '线上',
      extraContext: '课程是业界知名讲师主讲，内容覆盖需求分析/数据驱动/产品设计，是我长期想系统学习的方向，3个月后开课。但我现在凌晨3点才睡、还在低烧38.2度，下午14:00还有必须参加的季度部门述职会议，今天状态完全扛不住任何费脑的事',
      weatherScore: undefined,
      walletScore: 7,
      itemPrice: 1800,
      walletBalance: 8500,
    },
    rationale: '事本身非常值得（好讲师、好内容、长期想学），但当前身体状态极差、有紧急会议——目标是看模型能否给出高指数 + shouldGo=false',
  },
  C: {
    name: '不太合理 + 当前不适合（基线）',
    dto: {
      taskContent: '现在去买一双限量发售的 AJ 球鞋',
      category: 'shopping',
      willScore: 3,
      energyScore: 6,
      importance: 2,
      expectCostMin: 30,
      location: '线下门店',
      extraContext: '月薪到手6000，每月固定存500，运动鞋已有4双够用。这次是小红书刷到种草，觉得"限量不买可惜"，但冷静想想确实非必需',
      walletScore: 2,
      itemPrice: 1699,
      walletBalance: 885,
    },
    rationale: '非必需、占钱包大、自己意愿也不高、有替代——典型应该不做也不适合做的场景',
  },
  D: {
    name: '价值有限 + 当前有理由行动（目标）',
    dto: {
      taskContent: '把购物车里那件 29 元的纯色短袖T恤买了',
      category: 'shopping',
      willScore: 5,
      energyScore: 7,
      importance: 2,
      expectCostMin: 10,
      location: '手机下单',
      extraContext: 'T恤本身价值一般、不是刚需、之前已经有3件类似的。但现在是618活动最后1小时，过了恢复原价59元；凑单还差11元才能包邮；我刚刷手机正好看到，有10分钟空闲；这件事做了可以快速消除一个购物车 pending，且机会窗口过了就没了',
      walletScore: 8,
      itemPrice: 29,
      walletBalance: 5200,
    },
    rationale: '事本身价值有限（非刚需、已有类似），但当前有明确的机会窗口和低成本行动理由——目标是看模型能否给出低指数 + shouldGo=true',
  },
};

// 手动后处理镜像（与 llm.service.ts generateAdvice 完全一致，用于计算 final JSON）
function postProcess(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = { ...raw };
  if (!VALID_MODES.includes(parsed.persuadeMode)) {
    parsed.persuadeMode = '理性分析模式';
  }
  if (typeof parsed.agentSuggestIndex === 'number') {
    parsed.agentSuggestIndex = Math.max(0, Math.min(100, Math.round(parsed.agentSuggestIndex)));
  }
  return parsed;
}

async function runSingle(service, quadrantKey, idx) {
  const scene = QUADRANTS[quadrantKey];
  const prompt = buildPrompt(scene.dto, undefined, undefined, undefined);

  const result = {
    quadrant: quadrantKey,
    sceneName: scene.name,
    runIndex: idx + 1,
    success: false,
    rawJson: null,
    finalJson: null,
    error: null,
  };

  try {
    // 直接调用 chatJson 拿原始返回（绕过后处理）
    const raw = await service.chatJson(prompt);

    if (raw === null) {
      result.error = 'chatJson 返回 null（API key 未配置/API 错误/JSON 解析失败）';
      return result;
    }

    result.success = true;
    result.rawJson = raw;
    result.finalJson = postProcess(raw);

    // 字段摘要（方便统计）
    const final = result.finalJson;
    result.summary = {
      shouldGo: final?.shouldGo,
      agentSuggestIndex: final?.agentSuggestIndex,
      conclusion: final?.conclusion,
      minAction: final?.minAction,
      persuadeMode: final?.persuadeMode,
    };

    // 记录方向与指数的独立组合
    const idxVal = typeof final?.agentSuggestIndex === 'number' ? final.agentSuggestIndex : null;
    const dir = final?.shouldGo;
    if (idxVal !== null && typeof dir === 'boolean') {
      if (idxVal >= 60 && dir === false) result.combo = 'HIGH_IDX_FALSE';
      else if (idxVal < 40 && dir === true) result.combo = 'LOW_IDX_TRUE';
      else if (idxVal >= 50 && dir === true) result.combo = 'HIGH_IDX_TRUE';
      else if (idxVal < 50 && dir === false) result.combo = 'LOW_IDX_FALSE';
      else result.combo = 'MIDDLE';
    }
  } catch (e) {
    result.error = e.message || String(e);
  }

  return result;
}

async function main() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey || apiKey.includes('你的key')) {
    console.error('❌ LLM_API_KEY 未配置或仍为占位符，无法运行实验');
    process.exit(1);
  }

  const service = new LlmService();
  const allResults = [];

  console.log('='.repeat(70));
  console.log('  四象限独立维度实验 — agentSuggestIndex × shouldGo 独立性验证');
  console.log('='.repeat(70));
  console.log(`\n模型: ${service.model}`);
  console.log(`API:  ${service.baseUrl}`);
  console.log(`时间: ${new Date().toISOString()}\n`);

  for (const [key, scene] of Object.entries(QUADRANTS)) {
    console.log(`\n>>> 象限 ${key}（${scene.name}）— 5 次调用`);
    console.log(`    场景设计理由: ${scene.rationale}`);
    console.log(`    关键 DTO: will=${scene.dto.willScore} energy=${scene.dto.energyScore} imp=${scene.dto.importance}`);

    for (let i = 0; i < 5; i++) {
      const result = await runSingle(service, key, i);
      allResults.push(result);

      if (!result.success) {
        console.log(`    失败 [${i+1}]: ${result.error}`);
      } else {
        const s = result.summary;
        const comboTag = result.combo ? `[${result.combo}]` : '';
        console.log(`    成功 [${i+1}]: shouldGo=${s.shouldGo} idx=${s.agentSuggestIndex} ${comboTag} | ${s.conclusion} | ${s.persuadeMode}`);
      }

      // 轻微间隔，避免速率限制
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // 保存完整 JSON 结果（含 raw + final）
  const outPath = path.join(__dirname, 'quadrant-results.json');
  fs.writeFileSync(outPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    model: service.model,
    baseUrl: service.baseUrl,
    prompts: Object.fromEntries(
      Object.entries(QUADRANTS).map(([k, v]) => [k, { dto: v.dto, rationale: v.rationale }])
    ),
    results: allResults,
  }, null, 2), 'utf-8');

  console.log(`\n\n完整详情已保存到: ${outPath}`);
  console.log('='.repeat(70));

  // 汇总统计
  console.log('\n===== 汇总统计 =====\n');

  for (const key of ['A', 'B', 'C', 'D']) {
    const group = allResults.filter(r => r.quadrant === key);
    const scene = QUADRANTS[key];
    const success = group.filter(r => r.success);
    const idxVals = success.map(r => r.summary?.agentSuggestIndex).filter(v => typeof v === 'number');
    const trueCount = success.filter(r => r.summary?.shouldGo === true).length;
    const falseCount = success.filter(r => r.summary?.shouldGo === false).length;

    const mean = idxVals.length ? (idxVals.reduce((a,b)=>a+b, 0) / idxVals.length).toFixed(1) : 'N/A';
    const range = idxVals.length ? `${Math.min(...idxVals)} ~ ${Math.max(...idxVals)}` : 'N/A';

    console.log(`象限 ${key}（${scene.name}）`);
    console.log(`  成功/总计: ${success.length}/${group.length}`);
    console.log(`  shouldGo=true: ${trueCount}  |  shouldGo=false: ${falseCount}`);
    console.log(`  agentSuggestIndex: mean=${mean}  range=${range}  all=[${idxVals.join(', ')}]`);

    // 独立组合
    const highFalse = success.filter(r => (r.summary?.agentSuggestIndex ?? 0) >= 60 && r.summary?.shouldGo === false);
    const lowTrue = success.filter(r => (r.summary?.agentSuggestIndex ?? 0) < 40 && r.summary?.shouldGo === true);
    if (highFalse.length) console.log(`  ⚡ 高指数+false（≥60 & false）: ${highFalse.length} 次`);
    if (lowTrue.length) console.log(`  ⚡ 低指数+true（<40 & true）: ${lowTrue.length} 次`);

    // conclusion vs shouldGo 一致性
    const mismatch = success.filter(r => {
      const c = r.summary?.conclusion;
      const sg = r.summary?.shouldGo;
      if (!c || typeof sg !== 'boolean') return false;
      const startsWithQuzuo = c.startsWith('去做');
      return (sg === true && !startsWithQuzuo) || (sg === false && startsWithQuzuo);
    });
    if (mismatch.length) console.log(`  ⚠️ conclusion 与 shouldGo 不一致: ${mismatch.length} 次`);
    console.log('');
  }

  // 跨象限统计
  const overallHighFalse = allResults.filter(r => r.success && (r.summary?.agentSuggestIndex ?? 0) >= 60 && r.summary?.shouldGo === false);
  const overallLowTrue = allResults.filter(r => r.success && (r.summary?.agentSuggestIndex ?? 0) < 40 && r.summary?.shouldGo === true);
  const overall = allResults.filter(r => r.success);
  console.log(`\n跨象限总计（${overall.length} 次成功）:`);
  console.log(`  高指数+shouldGo=false: ${overallHighFalse.length} 次`);
  console.log(`  低指数+shouldGo=true:  ${overallLowTrue.length} 次`);
  console.log(`  shouldGo=true 总数:     ${overall.filter(r => r.summary?.shouldGo === true).length} 次`);
  console.log(`  shouldGo=false 总数:    ${overall.filter(r => r.summary?.shouldGo === false).length} 次`);
  console.log(`  平均指数:               ${(overall.reduce((a,r)=>a+(r.summary?.agentSuggestIndex??0),0)/Math.max(1,overall.length)).toFixed(1)}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
