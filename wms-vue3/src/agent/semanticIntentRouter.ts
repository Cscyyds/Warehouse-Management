import {
  agentNavigationPages,
  findAgentNavigationCandidates,
  type AgentNavigationMode,
  type AgentNavigationSection,
} from './navigationCatalog.ts'
import type { TaskExecutionContract } from './runtime/taskExecutionLedger.ts'

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

const createPattern = /(?:新增|新建|创建|开单)/
const navigationPattern = /(?:打开|进入|跳转|定位|前往|带我到|切换到|去往|回到|返回|我想看|想看|看看|看一下|查看页面)/
const queryPattern = /(?:查询|搜索|查找|帮我查|想查|查一下|有什么|有哪些|什么|哪些|谁|哪位|哪个|多少|几条|昨天|今天|最近|记录|情况|退货|退回)/
const outboundItemsPattern =
  /(?:出库|出货|出了|发出).*(?:什么货|哪些货|货品|商品|产品|明细)|(?:什么货|哪些货|货品|商品|产品).*(?:出库|出货|出了|发出)/
const outboundSituationPattern =
  /(?:出库|出货).*(?:情况|统计|怎么样)|(?:情况|统计).*(?:出库|出货)/
const supplierReturnItemsPattern =
  /(?:退给|退回|退货给).*(?:供应商|供货商|厂家)|(?:供应商|供货商|厂家).*(?:退货|退回)/
const inboundItemsPattern =
  /(?:入了|进了|到了|收了|入库).*(?:什么货|哪些货|货品|商品|产品|明细)|(?:什么货|哪些货|货品|商品|产品).*(?:入库|进货|到货|收货)/
const inventoryGoodsPattern =
  /(?:仓库|库存).*(?:还有|现有|现在有).*(?:什么货|哪些货|货品|商品|产品)|(?:还有|现有|现在有).*(?:什么货|哪些货|货品|商品|产品).*(?:仓库|库存)/
const publicCustomerPattern = /(?:公海).*(?:客户)|(?:客户).*(?:公海)/
const supplierPaymentPattern =
  /(?:供应商|供货商|厂家).*(?:付款单|付款|付货款)|(?:付款单|付款|付货款).*(?:供应商|供货商|厂家)/
const supplierPaymentExcludedPattern = /(?:预付款|月结付款|月结)/
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
  const isCreate = createPattern.test(normalizedTask)
  const isQuery = queryPattern.test(normalizedTask)
  const isNavigation = isCreate || navigationPattern.test(normalizedTask)
  const candidates = findAgentNavigationCandidates(normalizedTask, 8)
  const topScore = candidates[0]?.score ?? 0
  const topCandidates = candidates.filter((item) => item.score === topScore)

  if (isQuery && inventoryGoodsPattern.test(normalizedTask)) {
    return navigationIntent('warehouse.stock', '产品库存')
  }

  if ((isNavigation || isQuery) && publicCustomerPattern.test(normalizedTask)) {
    return navigationIntent('customer.public', '公海客户')
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

  if (topCandidates.length > 1 && (isNavigation || isQuery)) {
    return clarification(
      '这个请求可能对应多个页面',
      topCandidates.map(({ page }) => page.title),
    )
  }

  const matchedPage = topCandidates[0]?.page
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
        expectedPageId: matchedPage.id,
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

  if (isNavigation || isQuery) {
    return clarification('没有找到唯一匹配的业务页面', [])
  }

  return { kind: 'agent', contract: { kind: 'open' } }
}
