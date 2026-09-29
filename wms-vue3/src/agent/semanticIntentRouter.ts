import {
  agentNavigationPages,
  findAgentNavigationCandidates,
  getNavigationDecisionPolicy,
  isExcludedNavigationQuery,
  sectionLabels,
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

const createPattern = /(?:新增|新建|创建|开单|开一[张个])/
const navigationPattern = /(?:打开|进入|跳转|定位|前往|带我到|切换到|去往|回到|返回|我想看|想看|看看|看一下|查看页面)/
const queryPattern = /(?:查询|搜索|查找|帮我查|想查|查一下|有什么|有哪些|什么|哪些|谁|哪位|哪个|多少|几条|昨天|今天|最近|记录|情况|退货|退回)/
const salesProductSummaryPattern =
  /(?:产品|商品|货品).*(?:销量|销售量|销售额|卖了多少|卖得多|卖得最好|排行|排名|汇总|统计)|(?:销量|销售量|销售额|卖了多少|卖得多|卖得最好|排行|排名|汇总|统计).*(?:产品|商品|货品)/
const outboundItemsPattern =
  /(?:出库).*(?:什么货|哪些货|货品|商品|产品|明细)|(?:什么货|哪些货|货品|商品|产品).*(?:出库)/
const outboundSituationPattern =
  /(?:出库).*(?:情况|统计|怎么样)|(?:情况|统计).*(?:出库)/
const inboundItemsPattern =
  /(?:入了|进了|到了|收了|入库).*(?:什么货|哪些货|货品|商品|产品|明细)|(?:什么货|哪些货|货品|商品|产品).*(?:入库|进货|到货|收货)/
const financeOverviewPattern =
  /(?:财务).*(?:情况|状况|概况|这块|方面|整体)|(?:最近|整体|总体).*(?:财务)/
const profileChangePasswordPattern =
  /(?:改|修改|更改|重置|重设|换|设置|更换).{0,8}(?:密码|口令)|(?:密码|口令).{0,8}(?:改|修改|更改|重置|重设|换|设置|更换)/
const profileChangePasswordExcludedPattern = /(?:员工|用户|账号管理)/
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

// 区块标签直呼（"系统管理"/"打开仓库管理"）：话术本身就是区块名时，若目录对该词
// 只有编辑距离近似（无字面命中），近似赢家（如"岗位管理"）不得抢在区块语义之前。
const sectionLabelRules = (Object.entries(sectionLabels) as Array<[AgentNavigationSection, string]>).map(
  ([section, label]) => ({
    section,
    pattern: new RegExp(
      `^(?:打开|进入|跳转|切换到|去往|回到|带我到|我想看|想看|看看|看一下|查看)?${label}(?:页面|列表页)?$`,
    ),
  }),
)

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

/** 区块主页导航 + 追问列出该模块其余页面，供"不卡顿的二次确认"复用。 */
function sectionTopNavigation(section: AgentNavigationSection): DeterministicTaskIntent | undefined {
  const topPage = agentNavigationPages.find((page) => page.id === sectionTopPage[section])
  if (!topPage) return undefined
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

export function resolveDeterministicTaskIntent(task: string): DeterministicTaskIntent {
  const normalizedTask = task.trim()
  const navigationDecisionPolicy = getNavigationDecisionPolicy()
  const candidates = findAgentNavigationCandidates(normalizedTask, 8)
  // 排除词硬否决：目录声明"不适用"的页面不参与决策。打分层 ×0.3 惩罚只影响排序，
  // 若否决页留在候选里，被惩罚压到阈值之下反而会让业务意图层/幸存者绕过排除声明。
  const routableCandidates = candidates.filter(
    (candidate) => !isExcludedNavigationQuery(candidate.page.id, normalizedTask),
  )
  const confidenceDecision = decideIntentConfidence(
    routableCandidates.map((candidate) => ({ score: candidate.score, value: candidate })),
    navigationDecisionPolicy,
  )
  // 语义目录是页面选择的单一事实来源：只要目录 top 候选达到"够格"分数（不论
  // 它与 top2 是否接近），业务意图与正则快路径都不得改用其他页面——top2 接近
  // 时后面的 ambiguous 分支会用"先跳 top1 + follow-up"处理，而不是让更粗的
  // 正则把用户带到另一页。目录没有够格候选时才由它们兜底。
  const topCandidate = confidenceDecision.kind === 'confident'
    ? confidenceDecision.top
    : confidenceDecision.candidates[0]
  const catalogTopPageId = topCandidate && topCandidate.score >= navigationDecisionPolicy.minimumScore
    ? topCandidate.value.page.id
    : undefined
  const prefersOtherPage = (pageId: string): boolean =>
    catalogTopPageId !== undefined && catalogTopPageId !== pageId

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
  // 业务意图层同样受排除词硬约束：目标页对当前话术声明"不适用"时不得执行
  // （如"查看库存的出库记录"不得触发库存查询 Action）。
  const businessIntentExcluded = compiledBusinessIntent
    ? isExcludedNavigationQuery(compiledBusinessIntent.pageId, normalizedTask)
    : false
  // 建单意图优先于查询意图：话术表达"开一张/新增"时用户要的是空白表单，
  // 目标页有新增路由就不得再编译成查询 Action（如"开一张采购入库单"）。
  const businessIntentSupersededByCreate = Boolean(
    compiledBusinessIntent
    && createPattern.test(normalizedTask)
    && agentNavigationPages.find((page) => page.id === compiledBusinessIntent.pageId)?.create,
  )

  if (
    compiledBusinessIntent
    && !deferNamedCustomerQuery
    && !businessIntentExcluded
    && !businessIntentSupersededByCreate
    && !prefersOtherPage(compiledBusinessIntent.pageId)
  ) {
    return {
      ...compiledBusinessIntent,
      contract: {
        kind: 'business-action',
        expectedPageId: compiledBusinessIntent.agentPageId,
        expectedActionIds: [compiledBusinessIntent.actionId],
      },
    }
  }

  // 全部候选都被排除（如"查看库存的出库记录"）：产品口径是**不拒绝用户**——
  // 跳到最接近的页面并追问确认，而不是一句"没有合适页面"把人挡回去。
  // 底线：业务意图层已在上方拦截，不会在这类页面静默执行查询动作冒充答案。
  if (candidates.length > 0 && routableCandidates.length === 0) {
    const top = candidates[0].page
    const others = candidates.slice(1, 4).map((candidate) => candidate.page.title)
    const nav = navigationIntent(top.id, top.title)
    return {
      ...nav,
      followUp: {
        message: others.length
          ? `已为你打开【${top.title}】。如果你要找的是其他页面（如 ${others.join('、')}），请告诉我具体要查看哪个。`
          : `已为你打开【${top.title}】。如果这不是你要找的页面，请告诉我具体要查看哪个业务页面。`,
        suggestions: others,
      },
    }
  }

  const isCreate = createPattern.test(normalizedTask)
  const isQuery = queryPattern.test(normalizedTask)
  const isNavigation = isCreate || navigationPattern.test(normalizedTask)
  // 正则快路径仅在语义目录没有给出明确结论时才可抢先选择页面。
  const allowsFastPath = (pageId: string) => !prefersOtherPage(pageId)

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

  if ((isNavigation || isQuery) && allowsFastPath('customer.info') && namedCustomerEntityPattern.test(normalizedTask)) {
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

  // 2026-09-28 正则瘦身：已被语义目录/业务意图层覆盖的快路径已删除，仅保留以下
  // 高特异块（口语话术，目录词表无法在不引入误配的前提下覆盖；见 §11.5.15 与
  // docs/Agent页面识别准确性优化方案_20260928.md §8 遗留待决 ④）。

  // “统计…卖了多少/排行/汇总”这类聚合口语缺少通用触发词，避免漏给 LLM。
  if (allowsFastPath('sales.report.product-summary') && salesProductSummaryPattern.test(normalizedTask)) {
    return navigationIntent('sales.report.product-summary', '产品销售汇总表')
  }

  // “重置一下密码”“修改我的登录密码”等插入语/近义说法不会被目录词条子串命中；
  // 排除“员工/用户/账号管理”前缀，避免把管理员改密带到个人改密页。
  if (allowsFastPath('profile.change-password') && profileChangePasswordPattern.test(normalizedTask) && !profileChangePasswordExcludedPattern.test(normalizedTask)) {
    return navigationIntent('profile.change-password', '修改密码')
  }

  // “最近到了哪些商品”等到货口语：目录命中不足，保留确定性导航。
  if (isQuery && allowsFastPath('purchase.report.inbound-detail') && inboundItemsPattern.test(normalizedTask)) {
    return navigationIntent('purchase.report.inbound-detail', '采购入库单明细')
  }

  // “出库了/出库情况”与目录的“出库商品明细”排除词互斥，需按“货+出库”语序单独判定。
  if (isQuery && allowsFastPath('sales.order') && outboundItemsPattern.test(normalizedTask)) {
    return navigationIntent('sales.order', '销售订单')
  }

  if (isQuery && allowsFastPath('sales.order') && outboundSituationPattern.test(normalizedTask)) {
    return navigationIntent('sales.order', '销售订单')
  }

  // 目录无任何候选但能识别“财务+情况/概况”时，进入财务顶层而不是交 LLM。
  if (candidates.length === 0 && financeOverviewPattern.test(normalizedTask)) {
    return {
      kind: 'navigate-section',
      section: 'finance',
      sectionTitle: '财务管理',
    }
  }

  // 区块标签直呼且目录只有模糊近似（无任何字面命中）时，近似赢家不得抢答，
  // 回落区块主页 + 追问（如"系统管理"→人事资料管理，而非编辑距离最近的"岗位管理"）。
  const labelRule = sectionLabelRules.find(({ pattern }) => pattern.test(normalizedTask))
  if (
    labelRule
    && candidates.length > 0
    && candidates.every((candidate) => candidate.bestTier === 3)
  ) {
    const sectionNav = sectionTopNavigation(labelRule.section)
    if (sectionNav) return sectionNav
  }

  // insufficient：top 本身置信度也不够格（score < minimumScore），不能贸然跳转，
  // 仍走澄清让用户先确认。
  if (
    confidenceDecision.kind === 'insufficient'
    && confidenceDecision.candidates.length > 0
  ) {
    return clarification(
      '这个请求的页面匹配度不足',
      confidenceDecision.candidates.slice(0, 4).map(({ value }) => value.page.title),
    )
  }

  // ambiguous：top1 与 top2 都够格但太接近（gap < minimumGap）。产品策略改为：
  // **不要什么都不做**，先跳到 top 候选，再追加一条 follow-up 让用户
  // 在不打断流程的情况下确认是否指其他类型。
  if (
    confidenceDecision.kind === 'ambiguous'
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

  // 置信度达标即行动，不再要求"打开/查看/查询"等通用触发词：
  // 页面名本身就是最明确的导航意图（如裸词"仪表盘"）。
  const matchedPage = confidenceDecision.kind === 'confident'
    ? confidenceDecision.top.value.page
    : undefined
  if (matchedPage) {
    if (isCreate) {
      if (!matchedPage.create) {
        return {
          kind: 'unsupported',
          message: `“${matchedPage.title}”当前没有可直接进入的新增页面。`,
        }
      }
      return {
        kind: 'navigate',
        pageId: matchedPage.id,
        pageTitle: matchedPage.title,
        mode: 'create',
        contract: {
          kind: 'navigation',
          expectedPageId: matchedPage.id,
          expectedMode: 'create',
        },
      }
    }

    if (isQuery) {
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

    return navigationIntent(matchedPage.id, matchedPage.title)
  }

  const sections = mentionedSections(normalizedTask)
  if (sections.length === 1) {
    // 单 section 命中（candidates=0 但能识别出业务模块，例如"可口可乐的客户"）：
    // 先跳到该模块主页 + follow-up 列其他子页面，**不要什么都不做**让用户停顿。
    const sectionNav = sectionTopNavigation(sections[0])
    if (sectionNav) return sectionNav
    return clarification('该业务模块包含多个页面', sectionSuggestions(sections[0]))
  }

  // 兜底：空候选/低置信一律交给 LLM（完整语义清单已由 getPageAgentInstructions
  // 注入系统指令）。路由不再硬拦成空澄清——避免"匹配器眼瞎"（如"员工信息"未命中
  // "员工资料"子串）时用户被一句"没有找到唯一匹配的业务页面"拦截；LLM 判不了时
  // 自会走 ask_user 澄清。
  return { kind: 'agent', contract: { kind: 'open' } }
}
