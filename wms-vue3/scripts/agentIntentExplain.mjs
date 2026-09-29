/**
 * 单词话术识别解释器（调试用）
 *
 * 打印某个话术的：目录候选（分数 + 命中词）、置信度决策、最终路由。
 * 用于复盘错跳 / 校准阈值时定位是"打分排序"还是"决策策略"的问题。
 *
 * 用法:
 *   node --experimental-strip-types scripts/agentIntentExplain.mjs "打开销售订单明细"
 *   node --experimental-strip-types scripts/agentIntentExplain.mjs --min-score=300 --min-gap=120 "..." ...
 */
import {
  configureNavigationDecisionPolicy,
  defaultNavigationDecisionPolicy,
  findAgentNavigationCandidates,
  resetNavigationDecisionPolicy,
} from '../src/agent/navigationCatalog.ts'
import { resolveDeterministicTaskIntent } from '../src/agent/semanticIntentRouter.ts'
import { decideIntentConfidence } from '../src/agent/intent/intentConfidence.ts'

const args = process.argv.slice(2)
const minScoreArg = args.find((arg) => arg.startsWith('--min-score='))
const minGapArg = args.find((arg) => arg.startsWith('--min-gap='))
const policy = {
  ...defaultNavigationDecisionPolicy,
  ...(minScoreArg ? { minimumScore: Number(minScoreArg.split('=')[1]) } : {}),
  ...(minGapArg ? { minimumGap: Number(minGapArg.split('=')[1]) } : {}),
}
if (minScoreArg || minGapArg) {
  configureNavigationDecisionPolicy(policy)
}

const utterances = args.filter((arg) => !arg.startsWith('--'))
for (const utterance of utterances) {
  const candidates = findAgentNavigationCandidates(utterance)
  const decision = decideIntentConfidence(
    candidates.map((candidate) => ({ score: candidate.score, value: candidate.page.id })),
    policy,
  )
  const intent = resolveDeterministicTaskIntent(utterance)
  console.log(`\n=== ${utterance}`)
  console.log('  candidates:')
  for (const candidate of candidates.slice(0, 6)) {
    console.log(`    ${String(candidate.score).padStart(6)}  ${candidate.page.id}  [${candidate.matchedTerms.join(' | ')}]`)
  }
  console.log(`  confidence: ${decision.kind}${decision.top ? ` (top=${decision.top.value}, runnerUp=${decision.runnerUp?.value ?? '-'})` : ''}`)
  console.log(`  routed: ${intent.kind}${intent.pageId ? ` → ${intent.pageId}` : ''}${intent.actionId ? ` (${intent.actionId})` : ''}`)
}
resetNavigationDecisionPolicy()
