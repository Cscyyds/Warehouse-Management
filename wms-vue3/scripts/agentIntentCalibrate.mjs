/**
 * 匹配层决策阈值网格搜索
 *
 * minimumScore / minimumGap（src/agent/navigationCatalog.ts 的
 * `defaultNavigationDecisionPolicy`）直接决定"跳页 / 澄清 / 交 LLM"的边界，
 * 靠手感调不可靠。本脚本用评测用例库（scripts/lib/agentIntentCases.mjs）
 * 遍历阈值组合，输出每个组合的指标，并按目标选出推荐值回填
 * `defaultNavigationDecisionPolicy`（src/agent/navigationCatalog.ts）。
 *
 * 目标（按优先级）：
 *   1. 页面确定数（top1 + 带约束委派）最大
 *   2. 错跳 = 0
 *   3. 反向用例违规 = 0
 *   4. 澄清 / 开放式交 LLM 最少
 *   5. gap / score 更保守（更大）者优先
 *
 * 用法:
 *   node --experimental-strip-types scripts/agentIntentCalibrate.mjs
 *   node --experimental-strip-types scripts/agentIntentCalibrate.mjs --json
 *   node --experimental-strip-types scripts/agentIntentCalibrate.mjs --scores=200,300,400 --gaps=60,120
 */
import {
  configureNavigationDecisionPolicy,
  defaultNavigationDecisionPolicy,
  resetNavigationDecisionPolicy,
} from '../src/agent/navigationCatalog.ts'
import {
  buildIntentEvalCases,
  evaluateIntentCases,
  summarizeEvaluatedCases,
} from './lib/agentIntentCases.mjs'

const args = process.argv.slice(2)
const listArg = (name, fallback) => {
  const raw = args.find((arg) => arg.startsWith(`--${name}=`))
  if (!raw) return fallback
  return raw.split('=')[1].split(',').map(Number).filter((value) => Number.isFinite(value))
}

const SCORES = listArg('scores', [100, 200, 250, 300, 400])
const GAPS = listArg('gaps', [30, 120, 240, 300])

const cases = buildIntentEvalCases()
const normalCases = cases.filter((item) => item.kind !== 'excluded')
const excludedCases = cases.filter((item) => item.kind === 'excluded')

function measure(minimumScore, minimumGap) {
  configureNavigationDecisionPolicy({ minimumScore, minimumGap })
  evaluateIntentCases(cases)
  const overall = summarizeEvaluatedCases(normalCases)
  const violations = excludedCases.filter((item) => item.result.violation).length
  return {
    minimumScore,
    minimumGap,
    pageDetermined: overall.top1 + overall.delegated,
    top1: overall.top1,
    recall3: overall.recall3,
    wrong: overall.wrong,
    clarify: overall.clarify,
    openLlm: overall.toLlm - overall.delegated,
    unsupported: overall.unsupported,
    violations,
    followUp: overall.followUp,
    total: overall.total,
  }
}

const rows = []
for (const minimumScore of SCORES) {
  for (const minimumGap of GAPS) {
    rows.push(measure(minimumScore, minimumGap))
  }
}

// 目标排序：页面确定数 ↑，错跳/违规/澄清/开放 LLM ↓
const objectiveKey = (row) => [
  row.pageDetermined,
  -row.wrong,
  -row.violations,
  -row.clarify,
  -row.openLlm,
].join('|')

rows.sort((left, right) =>
  right.pageDetermined - left.pageDetermined
  || left.wrong - right.wrong
  || left.violations - right.violations
  || left.clarify - right.clarify
  || left.openLlm - right.openLlm
  || left.minimumScore - right.minimumScore
  || left.minimumGap - right.minimumGap)

// 指标相同即同一"平台区"（阈值在一个区间内都等价）。取平台区里最靠近中位数的
// 组合，避免把阈值贴在平台边缘——词表或权重稍动一下就会掉出平台。
const bestKey = objectiveKey(rows[0])
const plateau = rows.filter((row) => objectiveKey(row) === bestKey)
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const medianScore = median(plateau.map((row) => row.minimumScore))
const medianGap = median(plateau.map((row) => row.minimumGap))
const best = [...plateau].sort((left, right) =>
  (Math.abs(left.minimumScore - medianScore) + Math.abs(left.minimumGap - medianGap))
  - (Math.abs(right.minimumScore - medianScore) + Math.abs(right.minimumGap - medianGap))
  || right.minimumGap - left.minimumGap
  || right.minimumScore - left.minimumScore)[0]
const current = rows.find((row) =>
  row.minimumScore === defaultNavigationDecisionPolicy.minimumScore
  && row.minimumGap === defaultNavigationDecisionPolicy.minimumGap)

if (args.includes('--json')) {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    total: normalCases.length,
    excludedTotal: excludedCases.length,
    current,
    best,
    plateau: plateau.map((row) => ({ minimumScore: row.minimumScore, minimumGap: row.minimumGap })),
    rows,
  }, null, 2))
} else {
  console.log(`用例：常规 ${normalCases.length} / 反向 ${excludedCases.length}`)
  console.log('')
  console.log('minimumScore  minimumGap  页面确定  top1   候选top3  错跳  违规  澄清  开放LLM  确认提示')
  for (const row of rows) {
    console.log([
      String(row.minimumScore).padStart(12),
      String(row.minimumGap).padStart(10),
      String(row.pageDetermined).padStart(9),
      String(row.top1).padStart(5),
      String(row.recall3).padStart(8),
      String(row.wrong).padStart(5),
      String(row.violations).padStart(5),
      String(row.clarify).padStart(5),
      String(row.openLlm).padStart(8),
      String(row.followUp).padStart(8),
    ].join('  '))
  }
  console.log('')
  console.log(`最优指标平台区（${plateau.length} 个组合）：${plateau.map((row) => `${row.minimumScore}/${row.minimumGap}`).join('、')}`)
  if (current) {
    console.log(`当前值 score=${current.minimumScore} gap=${current.minimumGap}：页面确定 ${current.pageDetermined}/${current.total}，错跳 ${current.wrong}，违规 ${current.violations}，澄清 ${current.clarify}，开放 LLM ${current.openLlm}`)
  }
  console.log(`推荐值 score=${best.minimumScore} gap=${best.minimumGap}（平台区中位数附近）：页面确定 ${best.pageDetermined}/${best.total}，错跳 ${best.wrong}，违规 ${best.violations}，澄清 ${best.clarify}，开放 LLM ${best.openLlm}`)
}

resetNavigationDecisionPolicy()
