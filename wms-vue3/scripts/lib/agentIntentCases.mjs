/**
 * Agent 页面识别评测用例库（意图层）
 *
 * 从语义目录（navigationCatalog + semanticCatalog）派生用例，供：
 *   - scripts/agentIntentEval.mjs        评测报告 / 基线回归
 *   - scripts/agentIntentCalibrate.mjs   决策阈值网格搜索
 *
 * 用例不落盘、每次从目录现算，保证与页面词表始终同步。
 */
import {
  agentNavigationPages,
  findAgentNavigationCandidates,
  normalizeNavigationTerm,
} from '../../src/agent/navigationCatalog.ts'
import { resolveDeterministicTaskIntent } from '../../src/agent/semanticIntentRouter.ts'

// 与 semanticIntentRouter.ts 的 sectionTopPage 保持同步（评测用：把 navigate-section 映射回页面）
export const SECTION_TOP_PAGE = {
  dashboard: 'dashboard.overview',
  system: 'system.personnel',
  customer: 'customer.info',
  product: 'product.info',
  warehouse: 'warehouse.stock',
  purchase: 'purchase.order',
  sales: 'sales.order',
  delivery: 'delivery.task',
  finance: 'finance.transfer',
  profile: 'profile.center',
}

export const HANDMADE_CASES = [
  // 现有冒烟话术（语义路由测试中已验证）
  { utterance: '仓库里现在还有什么货', expectedPageIds: ['warehouse.stock'], kind: 'handmade', tags: ['smoke'] },
  { utterance: '看看公海里的客户', expectedPageIds: ['customer.public'], kind: 'handmade', tags: ['smoke'] },
  { utterance: '查一下给供应商的付款单', expectedPageIds: ['finance.payment-order'], kind: 'handmade', tags: ['smoke'] },
  { utterance: '今天有哪些货要送', expectedPageIds: ['delivery.task'], kind: 'handmade', tags: ['smoke'] },
  { utterance: '我想看库存', expectedPageIds: ['warehouse.stock'], kind: 'handmade', tags: ['smoke'] },
  // 拼音首字母 / 全拼（L2 通道）
  { utterance: '打开cgd', expectedPageIds: ['purchase.order'], kind: 'handmade', tags: ['pinyin'] },
  { utterance: '打开khzl', expectedPageIds: ['customer.info'], kind: 'handmade', tags: ['pinyin'] },
  { utterance: '查看xsd', expectedPageIds: ['sales.order'], kind: 'handmade', tags: ['pinyin'] },
  { utterance: '打开caigoudingdan', expectedPageIds: ['purchase.order'], kind: 'handmade', tags: ['pinyin'] },
  { utterance: '打开kucun', expectedPageIds: ['warehouse.stock'], kind: 'handmade', tags: ['pinyin'] },
  // 错别字（L3 编辑距离通道）
  { utterance: '采购定单', expectedPageIds: ['purchase.order'], kind: 'handmade', tags: ['typo'] },
  { utterance: '销售定单', expectedPageIds: ['sales.order'], kind: 'handmade', tags: ['typo'] },
  { utterance: '客户资枓', expectedPageIds: ['customer.info'], kind: 'handmade', tags: ['typo'] },
  // 已知短板（基线应暴露）
  { utterance: '看看车辆', expectedPageIds: ['delivery.vehicle'], kind: 'handmade', tags: ['known-gap'] },
  { utterance: '查采退单', expectedPageIds: ['purchase.return'], kind: 'handmade', tags: ['known-gap'] },
  { utterance: '员工信息', expectedPageIds: ['system.personnel'], kind: 'handmade', tags: ['known-gap'] },
  // 无业务语义输入：期望不路由（不跳错页即通过）
  { utterance: '你好', expectedPageIds: [], kind: 'handmade', tags: ['noise'] },
  { utterance: '今天天气怎么样', expectedPageIds: [], kind: 'handmade', tags: ['noise'] },
  // 模块级说法：期望落到 section 主页或等价
  { utterance: '我想看财务情况', expectedPageIds: ['finance.transfer'], expectedSection: 'finance', kind: 'handmade', tags: ['section'] },
  { utterance: '我想看客户管理', expectedPageIds: ['customer.info'], expectedSection: 'customer', kind: 'handmade', tags: ['section'] },
  // 2026-09-28 修复回归：区块标签直呼 / 排除词硬否决 / createPattern 口语 / 词表补齐
  { utterance: '系统管理', expectedPageIds: ['system.personnel'], expectedSection: 'system', kind: 'handmade', tags: ['section-label'] },
  { utterance: '财务管理', expectedPageIds: ['finance.transfer'], expectedSection: 'finance', kind: 'handmade', tags: ['section-label'] },
  { utterance: '查看库存的出库记录', expectedPageIds: ['warehouse.stock'], kind: 'handmade', tags: ['excluded-fallback'] },
  { utterance: '销售订单的出库商品明细', expectedPageIds: ['sales.order'], kind: 'handmade', tags: ['excluded-fallback'] },
  { utterance: '查一下某个产品的库存数量', expectedPageIds: ['warehouse.stock'], kind: 'handmade', tags: ['delegated-family'] },
  { utterance: '开一张采购入库单', expectedPageIds: ['purchase.inbound'], kind: 'handmade', tags: ['create-mode'] },
  { utterance: '昨天卖了多少货', expectedPageIds: ['sales.report.order-detail'], kind: 'handmade', tags: ['sales-detail-family'] },
]

export function buildIntentEvalCases() {
  const cases = []
  const byUtterance = new Map()

  function addCase(entry) {
    // excluded 用例独立成键：反向断言（不落来源页）不与常规期望合并
    const key = entry.kind === 'excluded' ? `excluded::${entry.utterance}` : entry.utterance
    const existing = byUtterance.get(key)
    if (existing) {
      for (const id of entry.expectedPageIds) {
        if (!existing.expectedPageIds.includes(id)) existing.expectedPageIds.push(id)
      }
      existing.shared = true
      existing.ownerPageIds.push(entry.ownerPageId)
      return
    }
    byUtterance.set(key, entry)
    cases.push(entry)
  }

  for (const page of agentNavigationPages) {
    const base = { ownerPageId: page.id, expectedPageIds: [page.id], shared: false, ownerPageIds: [page.id] }

    addCase({ ...base, kind: 'title', variant: 'bare', utterance: page.title })
    addCase({ ...base, kind: 'title', variant: 'open', utterance: `打开${page.title}` })
    for (const alias of page.aliases) {
      addCase({ ...base, kind: 'alias', variant: 'open', utterance: `打开${alias}` })
    }
    for (const keyword of page.keywords) {
      addCase({ ...base, kind: 'keyword', variant: 'bare', utterance: keyword })
      addCase({ ...base, kind: 'keyword', variant: 'view', utterance: `查看${keyword}` })
    }
    for (const synonym of page.synonyms) {
      addCase({ ...base, kind: 'synonym', variant: 'bare', utterance: synonym })
      addCase({ ...base, kind: 'synonym', variant: 'view', utterance: `查看${synonym}` })
    }
    for (const example of page.intentExamples) {
      addCase({ ...base, kind: 'intentExample', variant: 'sentence', utterance: example })
    }
    for (const excluded of page.excludedIntents) {
      addCase({
        kind: 'excluded',
        variant: 'sentence',
        utterance: excluded,
        ownerPageId: page.id,
        ownerPageIds: [page.id],
        expectedPageIds: [],
        shared: false,
      })
    }
  }

  for (const item of HANDMADE_CASES) {
    addCase({
      kind: item.kind,
      variant: item.tags?.includes('noise') ? 'noise' : 'sentence',
      utterance: item.utterance,
      ownerPageId: '(handmade)',
      ownerPageIds: ['(handmade)'],
      expectedPageIds: item.expectedPageIds,
      expectedSection: item.expectedSection,
      tags: item.tags ?? [],
      shared: false,
    })
  }

  return cases
}

export function routeOf(intent) {
  if (intent.kind === 'navigate' || intent.kind === 'business-action') {
    return { pageId: intent.pageId, section: undefined, kind: intent.kind }
  }
  if (intent.kind === 'navigate-section') {
    return { pageId: SECTION_TOP_PAGE[intent.section], section: intent.section, kind: intent.kind }
  }
  return { pageId: undefined, section: undefined, kind: intent.kind }
}

export function pageDeclaresUtterance(page, utterance) {
  const query = normalizeNavigationTerm(utterance)
  if (!query) return false
  const terms = [page.title, ...page.aliases, ...page.keywords, ...page.synonyms]
    .map(normalizeNavigationTerm)
    .filter(Boolean)
  return terms.some((term) => query.includes(term) || (term.length >= 2 && term.includes(query)))
}

/** 逐用例跑真实路由器并写回 item.result（就地修改，返回同一数组） */
export function evaluateIntentCases(cases) {
  for (const item of cases) {
    const intent = resolveDeterministicTaskIntent(item.utterance)
    const routed = routeOf(intent)
    const candidates = findAgentNavigationCandidates(item.utterance, 3)
    const candidateIds = candidates.map((candidate) => candidate.page.id)

    const expectsNoRoute = item.expectedPageIds.length === 0 && !item.expectedSection
    const sectionHit = item.expectedSection
      ? (intent.kind === 'navigate-section' && intent.section === item.expectedSection)
        || (routed.pageId ? routed.pageId.startsWith(`${item.expectedSection}.`) : false)
      : false
    const top1Hit = !expectsNoRoute && (
      sectionHit
      || (routed.pageId ? item.expectedPageIds.includes(routed.pageId) : false)
    )
    const wrongRoute = !expectsNoRoute && Boolean(routed.pageId) && !top1Hit
    const recall3 = top1Hit || (candidateIds.length > 0
      && item.expectedPageIds.some((id) => candidateIds.includes(id)))
    const noRoutePass = expectsNoRoute && !routed.pageId

    let violation = false
    if (item.kind === 'excluded') {
      // 产品口径（2026-09-28）：排除词页面不再是禁区——全部候选被排除时允许
      // 跳最接近页 + follow-up 追问确认；仍算违规的是"静默跳转/直接执行该页
      // 查询动作冒充答案"（无 follow-up 的落地都视为静默）。
      violation = routed.pageId === item.ownerPageId && !intent.followUp
    }

    const actualPage = routed.pageId
      ? agentNavigationPages.find((page) => page.id === routed.pageId)
      : undefined

    item.result = {
      intentKind: intent.kind,
      routedPageId: routed.pageId,
      section: routed.section,
      candidateIds,
      top1Hit,
      wrongRoute,
      recall3,
      noRoutePass,
      violation,
      // agent 但已带"页面+动作"约束：交给 LLM 只是填查询参数，页面选择已经确定；
      // 与"完全开放式交 LLM"必须分开统计，否则会低估匹配层实际覆盖能力。
      delegated: intent.kind === 'agent' && intent.contract.kind === 'business-action',
      // ambiguous 分支在跳转后追加的"是否指其他类型"确认提示。
      followUp: Boolean(intent.followUp),
      actualAlsoClaims: actualPage && !top1Hit && item.kind !== 'excluded'
        ? pageDeclaresUtterance(actualPage, item.utterance)
        : false,
    }
  }
  return cases
}

export function summarizeEvaluatedCases(items) {
  const total = items.length
  const top1 = items.filter((item) => item.result.top1Hit).length
  const wrong = items.filter((item) => item.result.wrongRoute).length
  const clarify = items.filter((item) => item.result.intentKind === 'clarify').length
  const toLlm = items.filter((item) => item.result.intentKind === 'agent').length
  const delegated = items.filter((item) => item.result.delegated).length
  const unsupported = items.filter((item) => item.result.intentKind === 'unsupported').length
  const recall3 = items.filter((item) => item.result.recall3).length
  const noRoutePass = items.filter((item) => item.result.noRoutePass).length
  const followUp = items.filter((item) => item.result.followUp).length
  return { total, top1, wrong, clarify, toLlm, delegated, unsupported, recall3, noRoutePass, followUp }
}
