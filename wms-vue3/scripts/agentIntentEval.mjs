/**
 * Agent 页面识别评测（意图层）
 *
 * 从语义目录（navigationCatalog + semanticCatalog）自动派生用例，量化
 * "用户话术 → 目标页面/动作"的识别准确性，用于：
 *   1. 建立基线（第 1 步）
 *   2. 匹配算法升级前后对比（第 3 步回归）
 *
 * 用法:
 *   node --experimental-strip-types scripts/agentIntentEval.mjs
 *   node --experimental-strip-types scripts/agentIntentEval.mjs --json
 *   node --experimental-strip-types scripts/agentIntentEval.mjs --min-top1=0.8 --max-wrong-route=0.05
 */
import { readFileSync } from 'node:fs'
import { agentNavigationPages, getAgentNavigationParentRouteName } from '../src/agent/navigationCatalog.ts'
import {
  buildIntentEvalCases,
  evaluateIntentCases,
  summarizeEvaluatedCases,
} from './lib/agentIntentCases.mjs'

// ── 1. 用例生成 + 执行（用例库见 scripts/lib/agentIntentCases.mjs） ──

const cases = evaluateIntentCases(buildIntentEvalCases())

// ── 3. URL/路由一致性检查 ───────────────────────────────────

const urlChecks = []
for (const page of agentNavigationPages) {
  urlChecks.push({
    label: `list 自映射 ${page.id}`,
    detail: `${page.list.name} → ${page.id}`,
    ok: getAgentNavigationParentRouteName(page.list.name, page.list.query ?? {}) === page.list.name,
  })
  if (page.create) {
    urlChecks.push({
      label: `create 反查 ${page.id}`,
      detail: `${page.create.name}(${JSON.stringify(page.create.query ?? {})}) → ${page.list.name}`,
      ok: getAgentNavigationParentRouteName(page.create.name, page.create.query ?? {}) === page.list.name,
    })
  }
}

const routerSource = readFileSync(new URL('../src/router/index.ts', import.meta.url), 'utf8')
const routePathByName = new Map()
for (const match of routerSource.matchAll(/path:\s*'([^']+)'[\s\S]{0,220}?name:\s*'([^']+)'/g)) {
  routePathByName.set(match[2], match[1])
}
const routeNameChecks = []
for (const page of agentNavigationPages) {
  const locations = page.create ? [page.list, page.create] : [page.list]
  for (const location of locations) {
    routeNameChecks.push({
      label: `${page.id} → ${location.name}`,
      path: routePathByName.get(location.name),
      ok: routePathByName.has(location.name),
    })
  }
}

// ── 4. 统计与报告 ───────────────────────────────────────────

const GROUP_ORDER = ['title', 'alias', 'keyword', 'synonym', 'intentExample', 'handmade', 'excluded']

const summarize = summarizeEvaluatedCases

function pct(value, total) {
  if (!total) return '—'
  return `${((value / total) * 100).toFixed(1)}%`
}

const normalCases = cases.filter((item) => item.kind !== 'excluded')
const excludedCases = cases.filter((item) => item.kind === 'excluded')

const lines = []
lines.push('# Agent 页面识别评测报告（意图层）')
lines.push('')
lines.push(`- 生成时间：${new Date().toISOString()}`)
lines.push(`- 用例总数：${cases.length}（常规 ${normalCases.length} / 反向 ${excludedCases.length}）`)
lines.push('')
lines.push('## 总体指标（常规用例）')
lines.push('')
const overall = summarize(normalCases)
lines.push('| 指标 | 数值 |')
lines.push('| --- | --- |')
lines.push(`| top1 命中率 | ${pct(overall.top1, overall.total)}（${overall.top1}/${overall.total}） |`)
lines.push(`| 候选 top3 召回率 | ${pct(overall.recall3, overall.total)}（${overall.recall3}/${overall.total}） |`)
lines.push(`| 错跳率（路由到非期望页面） | ${pct(overall.wrong, overall.total)}（${overall.wrong}/${overall.total}） |`)
lines.push(`| 澄清率 | ${pct(overall.clarify, overall.total)} |`)
lines.push(`| 交 LLM 兜底率 | ${pct(overall.toLlm, overall.total)} |`)
lines.push(`| 其中：已带页面/动作约束的委派（页面已确定，LLM 只填参数） | ${pct(overall.delegated, overall.total)}（${overall.delegated}） |`)
lines.push(`| 完全开放式交 LLM（未确定页面） | ${pct(overall.toLlm - overall.delegated, overall.total)}（${overall.toLlm - overall.delegated}） |`)
const candidateReadyButLlm = normalCases.filter((item) => item.result.intentKind === 'agent' && item.result.recall3)
lines.push(`| 其中：匹配层候选已命中期望页但仍交 LLM | ${candidateReadyButLlm.length}（占交LLM的 ${pct(candidateReadyButLlm.length, overall.toLlm)}） |`)
lines.push(`| 不支持 | ${overall.unsupported} |`)
lines.push(`| 无路由预期通过（noise） | ${overall.noRoutePass} |`)
lines.push('')
lines.push('## 分类指标')
lines.push('')
lines.push('| 类别 | 用例数 | top1 | 候选top3 | 错跳 | 澄清 | 委派 | 交LLM | 不支持 |')
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
for (const group of GROUP_ORDER) {
  const items = cases.filter((item) => item.kind === group)
  if (!items.length) continue
  const s = summarize(items)
  lines.push(`| ${group} | ${s.total} | ${pct(s.top1, s.total)} | ${pct(s.recall3, s.total)} | ${s.wrong} | ${s.clarify} | ${s.delegated} | ${s.toLlm} | ${s.unsupported} |`)
}
lines.push('')
lines.push('## 反向用例（excludedIntents）')
lines.push('')
const excludedViolations = excludedCases.filter((item) => item.result.violation)
lines.push(`- 违规率（错误路由回来源页）：${pct(excludedViolations.length, excludedCases.length)}（${excludedViolations.length}/${excludedCases.length}）`)
if (excludedViolations.length) {
  lines.push('')
  lines.push('| 话术 | 来源页 | 实际路由 |')
  lines.push('| --- | --- | --- |')
  for (const item of excludedViolations.slice(0, 20)) {
    lines.push(`| ${item.utterance} | ${item.ownerPageId} | ${item.result.routedPageId} |`)
  }
}
lines.push('')
lines.push('## 错跳明细（按类别，最多 30 条）')
lines.push('')
const wrongCases = normalCases.filter((item) => item.result.wrongRoute)
const sharedWrong = wrongCases.filter((item) => item.result.actualAlsoClaims)
lines.push(`- 错跳总数：${wrongCases.length}，其中目标页也对同话术有词条声明（合理共享词/排序问题）：${sharedWrong.length}`)
lines.push('')
lines.push('| 话术 | 期望页面 | 实际路由 | 匹配层候选(top3) | 目标页也声明该词 |')
lines.push('| --- | --- | --- | --- | --- |')
for (const item of wrongCases.slice(0, 30)) {
  lines.push(`| ${item.utterance} | ${item.expectedPageIds.join('/')} | ${item.result.routedPageId} | ${item.result.candidateIds.join(', ') || '(空)'} | ${item.result.actualAlsoClaims ? '是' : '否'} |`)
}
lines.push('')
lines.push('## 委派明细（页面/动作已确定，交 LLM 填参数，最多 30 条）')
lines.push('')
const delegatedCases = normalCases.filter((item) => item.result.delegated && !item.result.top1Hit)
lines.push(`- 委派总数：${delegatedCases.length}（均已在匹配层命中期望页的候选，页面上限已由 contract 约束）`)
lines.push('')
lines.push('| 话术 | 期望页面 | 匹配层候选(top3) |')
lines.push('| --- | --- | --- |')
for (const item of delegatedCases.slice(0, 30)) {
  lines.push(`| ${item.utterance} | ${item.expectedPageIds.join('/')} | ${item.result.candidateIds.join(', ') || '(空)'} |`)
}
lines.push('')
lines.push('## 落空明细（澄清 / 开放式交 LLM / 不支持，最多 30 条）')
lines.push('')
const missCases = normalCases.filter((item) => !item.result.top1Hit && !item.result.wrongRoute
  && !item.result.delegated && item.result.intentKind !== 'navigate-section')
lines.push(`- 落空总数：${missCases.length}（澄清 ${missCases.filter((i) => i.result.intentKind === 'clarify').length} / 开放式交LLM ${missCases.filter((i) => i.result.intentKind === 'agent').length} / 不支持 ${missCases.filter((i) => i.result.intentKind === 'unsupported').length}）`)
lines.push('')
lines.push('| 话术 | 期望页面 | 路由结果 | 匹配层候选(top3) |')
lines.push('| --- | --- | --- | --- |')
for (const item of missCases.slice(0, 30)) {
  lines.push(`| ${item.utterance} | ${item.expectedPageIds.join('/')} | ${item.result.intentKind} | ${item.result.candidateIds.join(', ') || '(空)'} |`)
}
lines.push('')
lines.push('## URL/路由一致性')
lines.push('')
const urlFailed = urlChecks.filter((check) => !check.ok)
lines.push(`- location 反查：${urlChecks.length - urlFailed.length}/${urlChecks.length} 通过`)
if (urlFailed.length) {
  for (const check of urlFailed) lines.push(`  - 失败：${check.label}（${check.detail}）`)
}
const routeFailed = routeNameChecks.filter((check) => !check.ok)
lines.push(`- 路由名存在性：${routeNameChecks.length - routeFailed.length}/${routeNameChecks.length} 通过`)
if (routeFailed.length) {
  for (const check of routeFailed) lines.push(`  - 失败：${check.label}`)
}
lines.push('')

const useJson = process.argv.includes('--json')
if (useJson) {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    overall,
    candidateReadyButLlm: candidateReadyButLlm.length,
    groups: Object.fromEntries(GROUP_ORDER.map((group) => [group, summarize(cases.filter((item) => item.kind === group))])),
    excluded: {
      total: excludedCases.length,
      violations: excludedViolations.length,
    },
    wrongRouteSample: wrongCases.slice(0, 50).map((item) => ({
      utterance: item.utterance,
      expected: item.expectedPageIds,
      actual: item.result.routedPageId,
      candidates: item.result.candidateIds,
    })),
    missSample: missCases.slice(0, 50).map((item) => ({
      utterance: item.utterance,
      expected: item.expectedPageIds,
      routeKind: item.result.intentKind,
      candidates: item.result.candidateIds,
    })),
    delegatedSample: delegatedCases.slice(0, 50).map((item) => ({
      utterance: item.utterance,
      expected: item.expectedPageIds,
      candidates: item.result.candidateIds,
    })),
    urlChecks: { failed: urlFailed, failedRouteNames: routeFailed },
  }, null, 2))
} else {
  console.log(lines.join('\n'))
}

// 阈值门禁（可选）
const minTop1Arg = process.argv.find((arg) => arg.startsWith('--min-top1='))
const maxWrongArg = process.argv.find((arg) => arg.startsWith('--max-wrong-route='))
const maxViolationArg = process.argv.find((arg) => arg.startsWith('--max-excluded-violations='))
const maxOpenLlmArg = process.argv.find((arg) => arg.startsWith('--max-open-llm='))
let failed = 0
if (minTop1Arg) {
  const minTop1 = Number(minTop1Arg.split('=')[1])
  const actual = overall.total ? overall.top1 / overall.total : 0
  if (actual < minTop1) {
    console.error(`[gate] top1 命中率 ${(actual * 100).toFixed(1)}% < 要求 ${(minTop1 * 100).toFixed(1)}%`)
    failed += 1
  }
}
if (maxWrongArg) {
  const maxWrong = Number(maxWrongArg.split('=')[1])
  const actual = overall.total ? overall.wrong / overall.total : 0
  if (actual > maxWrong) {
    console.error(`[gate] 错跳率 ${(actual * 100).toFixed(1)}% > 允许 ${(maxWrong * 100).toFixed(1)}%`)
    failed += 1
  }
}
if (maxViolationArg) {
  const maxViolations = Number(maxViolationArg.split('=')[1])
  if (excludedViolations.length > maxViolations) {
    console.error(`[gate] 反向用例违规 ${excludedViolations.length} 条 > 允许 ${maxViolations} 条`)
    failed += 1
  }
}
if (maxOpenLlmArg) {
  const maxOpenLlm = Number(maxOpenLlmArg.split('=')[1])
  const openLlm = overall.toLlm - overall.delegated
  if (openLlm > maxOpenLlm) {
    console.error(`[gate] 开放式交 LLM ${openLlm} 条 > 允许 ${maxOpenLlm} 条`)
    failed += 1
  }
}
if (failed > 0) process.exitCode = 1
