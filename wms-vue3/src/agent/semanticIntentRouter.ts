import {
  agentNavigationPages,
  findAgentNavigationCandidates,
  type AgentNavigationMode,
  type AgentNavigationSection,
} from './navigationCatalog.ts'
import type { TaskExecutionContract } from './runtime/taskExecutionLedger.ts'
import { resolveLocalBusinessIntent } from './intent/businessIntent.ts'
import { compileBusinessIntent } from './intent/intentRegistry.ts'
import { decideIntentConfidence } from './intent/intentConfidence.ts'

export type DeterministicTaskIntent =
  | {
      kind: 'navigate'
      pageId: string
      pageTitle: string
      mode: AgentNavigationMode
      contract: TaskExecutionContract
    }
  | {
      kind: 'clarify'
      message: string
      suggestions: string[]
    }
  | {
      kind: 'navigate-section'
      section: 'finance'
      sectionTitle: '财务管理'
    }
  | {
      kind: 'unsupported'
      message: string
    }
  | {
      kind: 'agent'
      contract: TaskExecutionContract
    }
  | {
      kind: 'business-action'
      pageId: string
      pageTitle: string
      agentPageId: string
      actionId: string
      args: Record<string, unknown>
      contract: TaskExecutionContract
    }

const createPattern = /(?:新增|新建|创建|开单)/
const navigationPattern = /(?:打开|进入|跳转|定位|前往|带我到|切换到|去往|回到|返回|我想看|想看|看看|看一下|查看页面)/
const queryPattern = /(?:查询|搜索|查找|帮我查|想查|查一下|有什么|有哪些|什么|哪些|谁|哪位|哪个|多少|几条|昨天|今天|最近|记录|情况|退货|退回)/
const deliveryOutboundItemsPattern =
  /(?:出货|出了|发货|发出).*(?:什么货|哪些货|货品|商品|产品|明细)|(?:什么货|哪些货|货品|商品|产品).*(?:出货|出了|发货|发出)/
const deliveryOutboundSituationPattern =
  /(?:出货|发货).*(?:情况|统计|怎么样)|(?:情况|统计).*(?:出货|发货)/
const salesProductSummaryPattern =
  /(?:产品|商品|货品).*(?:销量|销售量|销售额|卖了多少|卖得多|卖得最好|排行|排名|汇总|统计)|(?:销量|销售量|销售额|卖了多少|卖得多|卖得最好|排行|排名|汇总|统计).*(?:产品|商品|货品)/
const salesGoodsPattern =
  /(?:卖货|卖了|销售了|售出).*(?:什么货|哪些货|什么东西|哪些东西|货品|商品|产品|明细|记录)|(?:什么货|哪些货|什么东西|哪些东西|货品|商品|产品).*(?:卖货|卖了|销售了|售出)/
const outboundItemsPattern =
  /(?:出库).*(?:什么货|哪些货|货品|商品|产品|明细)|(?:什么货|哪些货|货品|商品|产品).*(?:出库)/
const outboundSituationPattern =
  /(?:出库).*(?:情况|统计|怎么样)|(?:情况|统计).*(?:出库)/
const supplierReturnItemsPattern =
  /(?:退给|退回|退货给).*(?:供应商|供货商|厂家)|(?:供应商|供货商|厂家).*(?:退货|退回)/
const inboundItemsPattern =
  /(?:入了|进了|到了|收了|入库).*(?:什么货|哪些货|货品|商品|产品|明细)|(?:什么货|哪些货|货品|商品|产品).*(?:入库|进货|到货|收货)/
const inventoryGoodsPattern =
  /(?:仓库|库存).*(?:还有|现有|现在有).*(?:什么货|哪些货|多少货|货品|商品|产品)|(?:还有|现有|现在有).*(?:什么货|哪些货|多少货|货品|商品|产品).*(?:仓库|库存)/
const publicCustomerPattern = /(?:公海).*(?:客户)|(?:客户).*(?:公海)/
const supplierPaymentPattern =
  /(?:供应商|供货商|厂家).*(?:付款单|付款|付货款)|(?:付款单|付款|付货款).*(?:供应商|供货商|厂家)/
const supplierPaymentExcludedPattern = /(?:预付款|月结付款|月结)/
const supplierPrepaymentPattern =
  /(?:供应商|供货商|厂家).*(?:预付款)|(?:预付款).*(?:供应商|供货商|厂家)/
const recentNewCustomerPattern =
  /(?:最近|近期|这几天).*(?:新客户|新增客户|新开拓客户)|(?:新客户|新增客户|新开拓客户).*(?:最近|近期|这几天)/
const deliveryGoodsPattern =
  /(?:什么货|哪些货|货品|商品|产品).*(?:要送|待送|需要送|准备送|送货|配送)|(?:要送|待送|需要送|准备送).*(?:什么货|哪些货|货品|商品|产品)/
const financeOverviewPattern =
  /(?:财务).*(?:情况|状况|概况|这块|方面|整体)|(?:最近|整体|总体).*(?:财务)/

const sectionTerms: Record<AgentNavigationSection, string[]> = {
  dashboard: ['仪表盘', '首页', '工作台', '运营总览'],
  system: ['系统管理', '系统'],
  customer: ['客户管理', '客户'],
  product: ['产品管理', '商品管理', '产品'],
  warehouse: ['仓库管理', '仓库'],
  purchase: ['采购管理', '采购'],
  sales: ['销售管理', '销售'],
  delivery: ['配送管理', '配送', '物流'],
  finance: ['财务管理', '财务'],
}

function navigationIntent(pageId: string, pageTitle: string): DeterministicTaskIntent {
  return {
    kind: 'navigate',
    pageId,
    pageTitle,
    mode: 'list',
    contract: {
      kind: 'navigation',
      expectedPageId: pageId,
      expectedMode: 'list',
    },
  }
}

function mentionedSections(task: string): AgentNavigationSection[] {
  return (Object.entries(sectionTerms) as Array<[AgentNavigationSection, string[]]>)
    .filter(([, terms]) => terms.some((term) => task.includes(term)))
    .map(([section]) => section)
}

function sectionSuggestions(section: AgentNavigationSection): string[] {
  return agentNavigationPages
    .filter((page) => page.section === section)
    .slice(0, 6)
    .map((page) => page.title)
}

function clarification(messagePrefix: string, suggestions: string[]): DeterministicTaskIntent {
  const suffix = suggestions.length ? `，例如：${suggestions.join('、')}` : ''
  return {
    kind: 'clarify',
    message: `${messagePrefix}，请告诉我具体要查看哪个业务页面${suffix}。`,
    suggestions,
  }
}

export function resolveDeterministicTaskIntent(task: string): DeterministicTaskIntent {
  const normalizedTask = task.trim()
  const localBusinessIntent = resolveLocalBusinessIntent(normalizedTask)
  const businessConfidenceDecision = localBusinessIntent
    ? decideIntentConfidence(
        [
          { score: localBusinessIntent.confidence, value: localBusinessIntent.intent },
          ...localBusinessIntent.alternatives.map((alternative) => ({
            score: alternative.confidence,
            value: alternative.intent,
          })),
        ],
        { minimumScore: 0.85, minimumGap: 0.15 },
      )
    : null
  const compiledBusinessIntent = (
    localBusinessIntent
    && businessConfidenceDecision?.kind === 'confident'
    && businessConfidenceDecision.top.value === localBusinessIntent.intent
  )
    ? compileBusinessIntent(localBusinessIntent)
    : null
  if (compiledBusinessIntent) {
    return {
      ...compiledBusinessIntent,
      contract: {
        kind: 'business-action',
        expectedPageId: compiledBusinessIntent.agentPageId,
        expectedActionIds: [compiledBusinessIntent.actionId],
      },
    }
  }

  const isCreate = createPattern.test(normalizedTask)
  const isQuery = queryPattern.test(normalizedTask)
  const isNavigation = isCreate || navigationPattern.test(normalizedTask)
  const candidates = findAgentNavigationCandidates(normalizedTask, 8)
  const confidenceDecision = decideIntentConfidence(
    candidates.map((candidate) => ({ score: candidate.score, value: candidate })),
  )

  if (isQuery && inventoryGoodsPattern.test(normalizedTask)) {
    return navigationIntent('warehouse.stock', '产品库存')
  }

  if ((isNavigation || isQuery) && publicCustomerPattern.test(normalizedTask)) {
    return navigationIntent('customer.public', '公海客户')
  }

  if ((isNavigation || isQuery) && recentNewCustomerPattern.test(normalizedTask)) {
    return navigationIntent('customer.new', '新开拓客户')
  }

  if ((isNavigation || isQuery) && supplierPrepaymentPattern.test(normalizedTask)) {
    return navigationIntent('finance.prepayment', '预付款单')
  }

  if (
    (isNavigation || isQuery)
    && supplierPaymentPattern.test(normalizedTask)
    && !supplierPaymentExcludedPattern.test(normalizedTask)
  ) {
    return navigationIntent('finance.payment-order', '付款单')
  }

  if (isQuery && deliveryGoodsPattern.test(normalizedTask)) {
    return navigationIntent('delivery.task', '配送任务')
  }

  if ((isNavigation || isQuery) && (
    deliveryOutboundItemsPattern.test(normalizedTask)
    || deliveryOutboundSituationPattern.test(normalizedTask)
  )) {
    return navigationIntent('delivery.task', '配送任务')
  }

  // 销售商品“统计汇总”和“逐行明细”是高度特异的业务表达，不依赖通用
  // navigation/query 动词门槛，避免“查看产品销量排行”因缺少通用触发词而漏到 LLM。
  if (salesProductSummaryPattern.test(normalizedTask)) {
    return navigationIntent('sales.report.product-summary', '产品销售汇总表')
  }

  if (salesGoodsPattern.test(normalizedTask)) {
    return navigationIntent('sales.report.order-detail', '销售订单明细表')
  }

  if (isQuery && supplierReturnItemsPattern.test(normalizedTask)) {
    return navigationIntent('purchase.return', '采购退货单')
  }

  if (isQuery && inboundItemsPattern.test(normalizedTask)) {
    return navigationIntent('purchase.report.inbound-detail', '采购入库单明细')
  }

  if (isQuery && outboundItemsPattern.test(normalizedTask)) {
    return navigationIntent('sales.order', '销售订单')
  }

  if (isQuery && outboundSituationPattern.test(normalizedTask)) {
    return navigationIntent('sales.order', '销售订单')
  }

  if ((isNavigation || isQuery) && candidates.length === 0 && financeOverviewPattern.test(normalizedTask)) {
    return {
      kind: 'navigate-section',
      section: 'finance',
      sectionTitle: '财务管理',
    }
  }

  if (
    (isNavigation || isQuery)
    && confidenceDecision.kind !== 'confident'
    && confidenceDecision.candidates.length > 0
  ) {
    return clarification(
      confidenceDecision.kind === 'ambiguous'
        ? '这个请求可能对应多个页面'
        : '这个请求的页面匹配度不足',
      confidenceDecision.candidates.slice(0, 4).map(({ value }) => value.page.title),
    )
  }

  const matchedPage = confidenceDecision.kind === 'confident'
    ? confidenceDecision.top.value.page
    : undefined
  if (isQuery && matchedPage) {
    const actionKeyword = matchedPage.capabilities.find(
      (capability) =>
        capability.kind === 'write'
        && capability.keywords.some((keyword) => normalizedTask.includes(keyword)),
    )
    const capability = actionKeyword
      ?? matchedPage.capabilities.find((item) => item.kind === 'read')

    if (!capability) {
      return navigationIntent(matchedPage.id, matchedPage.title)
    }
    return {
      kind: 'agent',
      contract: {
        kind: 'business-action',
        expectedPageId: matchedPage.agentPageId ?? matchedPage.id,
        expectedActionIds: [capability.id],
      },
    }
  }

  if (isNavigation && matchedPage) {
    const mode: AgentNavigationMode = isCreate ? 'create' : 'list'
    if (mode === 'create' && !matchedPage.create) {
      return {
        kind: 'unsupported',
        message: `“${matchedPage.title}”当前没有可直接进入的新增页面。`,
      }
    }
    return {
      kind: 'navigate',
      pageId: matchedPage.id,
      pageTitle: matchedPage.title,
      mode,
      contract: {
        kind: 'navigation',
        expectedPageId: matchedPage.id,
        expectedMode: mode,
      },
    }
  }

  const sections = mentionedSections(normalizedTask)
  if ((isNavigation || isQuery) && sections.length === 1) {
    const suggestions = sectionSuggestions(sections[0])
    return clarification('该业务模块包含多个页面', suggestions)
  }

  // 兜底：空候选/低置信一律交给 LLM（完整语义清单已由 getPageAgentInstructions
  // 注入系统指令）。路由不再硬拦成空澄清——避免"匹配器眼瞎"（如"员工信息"未命中
  // "员工资料"子串）时用户被一句"没有找到唯一匹配的业务页面"拦截；LLM 判不了时
  // 自会走 ask_user 澄清。
  return { kind: 'agent', contract: { kind: 'open' } }
}
