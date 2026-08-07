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
      // 可选：导航成功后追加一条 follow-up 提示（用于 ambiguous 场景，
      // 让用户在不卡顿的情况下收到"如果你指的是其他类型请告诉我"的二次确认）。
      followUp?: { message: string; suggestions: string[] }
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
const profileCenterPattern =
  /(?:个人中心|我的资料|我的账号|我的账户)/
const profileChangePasswordPattern =
  /(?:改|修改|更改|重置|重设|换|设置|更换).{0,8}(?:密码|口令)|(?:密码|口令).{0,8}(?:改|修改|更改|重置|重设|换|设置|更换)/
const profileChangePasswordExcludedPattern = /(?:员工|用户|账号管理)/
const profileMyVisitTaskPattern =
  /(?:我负责的拜访|负责的拜访任务|我的拜访任务|我的拜访记录|我的拜访|我.{0,8}(?:拜访过|拜访了|已拜访|去拜访|要拜访|需拜访|需要拜访).{0,12}(?:客户|单位|公司)?)/
const globalVisitTaskPattern =
  /(?:(?:所有人|全部|全员|全部人员|其他人).{0,10}(?:拜访任务|拜访记录|客户拜访)|(?:拜访任务|拜访记录|客户拜访).{0,10}(?:所有人|全部|全员|全部人员|其他人))/
const namedCustomerEntityPattern =
  /(?:叫|名为|名称是|客户名为).{1,40}客户|(?:查询|查一下|查找|看看|看一下|查看).{0,20}客户(?:名称|名字)/
const customerPageConflictPattern =
  /(?:客户资料|正式客户|客户档案).*(?:新开拓客户|客户线索|潜在客户)|(?:新开拓客户|客户线索|潜在客户).*(?:客户资料|正式客户|客户档案)/

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
  profile: ['个人中心', '我的资料'],
}

// 每个业务模块的"代表性主页"：当用户提到某模块但未匹配到具体页面时，
// 跳转到该模块主页（产品判断：通常是最高频访问的子页面），再附 follow-up
// 让用户在不卡顿的前提下确认是否指其他子页面。
const sectionTopPage: Record<AgentNavigationSection, string> = {
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

function navigationIntent(
  pageId: string,
  pageTitle: string,
): Extract<DeterministicTaskIntent, { kind: 'navigate' }> {
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
  // 指明具体客户名称时，先进入客户资料页并让用户确认客户归属，避免把名称
  // 直接当成正式客户查询而忽略它也可能是线索或公海客户。普通“客户信息”查询
  // 仍保留下面的业务 Action 快路径。
  const deferNamedCustomerQuery =
    localBusinessIntent?.intent === 'customer.query'
    && namedCustomerEntityPattern.test(normalizedTask)

  if (compiledBusinessIntent && !deferNamedCustomerQuery) {
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

  // 明确表达两个客户子页面时，强制采用候选排序结果走“先导航、后追问”。
  // 该规则不依赖两个页面的分数刚好落在 minimumGap 内，避免一个高权重短语
  // 把另一个同样明确的页面完全压掉。
  if (customerPageConflictPattern.test(normalizedTask)) {
    const customerCandidates = [
      ...candidates,
      ...findAgentNavigationCandidates('客户资料', 8),
      ...findAgentNavigationCandidates('新开拓客户', 8),
    ]
      .filter(({ page }) => ['customer.info', 'customer.new'].includes(page.id))
      .reduce((items, candidate) => {
        const existing = items.find((item) => item.page.id === candidate.page.id)
        if (!existing || candidate.score > existing.score) {
          return [...items.filter((item) => item.page.id !== candidate.page.id), candidate]
        }
        return items
      }, [] as typeof candidates)
      .sort((left, right) => right.score - left.score || left.page.id.localeCompare(right.page.id))
    const top = customerCandidates[0]?.page
    if (top) {
      const others = customerCandidates.slice(1).map(({ page }) => page.title)
      const nav = navigationIntent(top.id, top.title)
      return {
        ...nav,
        followUp: {
          message: `已为你打开【${top.title}】。如果你指的是其他类型（如 ${others.join('、')}），请告诉我具体要查看哪个。`,
          suggestions: others,
        },
      }
    }
  }

  if ((isNavigation || isQuery) && namedCustomerEntityPattern.test(normalizedTask)) {
    const topPage = agentNavigationPages.find((page) => page.id === 'customer.info')
    if (topPage) {
      const suggestions = sectionSuggestions('customer')
        .filter((title) => title !== topPage.title)
      return {
        ...navigationIntent(topPage.id, topPage.title),
        followUp: {
          message: `已为你打开【${topPage.title}】。如果该名称对应新开拓客户或公海客户，请告诉我，我可以切换到相应页面。`,
          suggestions,
        },
      }
    }
  }

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

  // 个人中心三页：“我要改密码”“我的拜访记录”等口语缺少通用
  // navigation/query 触发词，且“负责拜访任务”需与全局“拜访任务单”区分，
  // 因此走高特异确定性快路径，避免落给 LLM 猜错页面。
  if (profileChangePasswordPattern.test(normalizedTask) && !profileChangePasswordExcludedPattern.test(normalizedTask)) {
    return navigationIntent('profile.change-password', '修改密码')
  }

  if (profileMyVisitTaskPattern.test(normalizedTask)) {
    return navigationIntent('profile.my-visit-task', '负责拜访任务')
  }

  if (globalVisitTaskPattern.test(normalizedTask)) {
    return navigationIntent('customer.task.visit', '拜访任务单')
  }

  if (profileCenterPattern.test(normalizedTask)) {
    return navigationIntent('profile.center', '个人中心')
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

  // insufficient：top 本身置信度也不够格（score < 120），不能贸然跳转，
  // 仍走澄清让用户先确认。
  if (
    (isNavigation || isQuery)
    && confidenceDecision.kind === 'insufficient'
    && confidenceDecision.candidates.length > 0
  ) {
    return clarification(
      '这个请求的页面匹配度不足',
      confidenceDecision.candidates.slice(0, 4).map(({ value }) => value.page.title),
    )
  }

  // ambiguous：top1 与 top2 都够格但太接近（gap < 15）。产品策略改为：
  // **不要什么都不做**，先跳到 top 候选，再追加一条 follow-up 让用户
  // 在不打断流程的情况下确认是否指其他类型。
  if (
    (isNavigation || isQuery)
    && confidenceDecision.kind === 'ambiguous'
    && confidenceDecision.candidates.length > 0
  ) {
    const top = confidenceDecision.candidates[0].value.page
    const others = confidenceDecision.candidates
      .slice(1, 4)
      .map(({ value }) => value.page.title)
    const nav = navigationIntent(top.id, top.title)
    return {
      ...nav,
      followUp: {
        message: others.length
          ? `已为你打开【${top.title}】。如果你指的是其他类型（如 ${others.join('、')}），请告诉我具体要查看哪个。`
          : `已为你打开【${top.title}】。`,
        suggestions: others,
      },
    }
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
    const section = sections[0]
    const topPageId = sectionTopPage[section]
    const topPage = agentNavigationPages.find((page) => page.id === topPageId)
    if (topPage) {
      // 单 section 命中（candidates=0 但能识别出业务模块，例如"可口可乐的客户"）：
      // 先跳到该模块主页 + follow-up 列其他子页面，**不要什么都不做**让用户停顿。
      const others = sectionSuggestions(section).filter((title) => title !== topPage.title)
      const nav = navigationIntent(topPage.id, topPage.title)
      return {
        ...nav,
        followUp: {
          message: others.length
            ? `已为你打开【${topPage.title}】。如果你想查看该模块下的其他页面（如 ${others.join('、')}），请告诉我具体要查看哪个。`
            : `已为你打开【${topPage.title}】。`,
          suggestions: others,
        },
      }
    }
    return clarification('该业务模块包含多个页面', sectionSuggestions(section))
  }

  // 兜底：空候选/低置信一律交给 LLM（完整语义清单已由 getPageAgentInstructions
  // 注入系统指令）。路由不再硬拦成空澄清——避免"匹配器眼瞎"（如"员工信息"未命中
  // "员工资料"子串）时用户被一句"没有找到唯一匹配的业务页面"拦截；LLM 判不了时
  // 自会走 ask_user 澄清。
  return { kind: 'agent', contract: { kind: 'open' } }
}
