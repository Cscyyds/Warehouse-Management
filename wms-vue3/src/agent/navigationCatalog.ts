export type AgentNavigationMode = 'list' | 'create'
export type AgentNavigationSection =
  | 'dashboard'
  | 'system'
  | 'customer'
  | 'product'
  | 'warehouse'
  | 'purchase'
  | 'sales'
  | 'delivery'
  | 'finance'

export interface AgentSemanticCapability {
  id: string
  kind: 'read' | 'write'
  description: string
  keywords: string[]
}

export interface AgentNavigationLocation {
  name: string
  query?: Record<string, string>
}

export interface AgentNavigationPage {
  id: string
  title: string
  aliases: string[]
  section: AgentNavigationSection
  description: string
  keywords: string[]
  intentExamples: string[]
  excludedIntents: string[]
  capabilities: AgentSemanticCapability[]
  agentPageId?: string
  list: AgentNavigationLocation
  create?: AgentNavigationLocation
}

type AgentNavigationPageDefinition = Omit<
  AgentNavigationPage,
  | 'section'
  | 'description'
  | 'keywords'
  | 'intentExamples'
  | 'excludedIntents'
  | 'capabilities'
  | 'agentPageId'
>

export type AgentNavigationResolution =
  | {
      ok: true
      page: AgentNavigationPage
      mode: AgentNavigationMode
      location: AgentNavigationLocation
    }
  | {
      ok: false
      reason: 'not_found' | 'ambiguous' | 'mode_not_supported'
      suggestions: string[]
    }

const commonCreate = (type: string): AgentNavigationLocation => ({
  name: 'AddTemplate',
  query: { type },
})

const agentNavigationPageDefinitions: AgentNavigationPageDefinition[] = [
  // 工作台
  { id: 'dashboard.overview', title: '仪表盘', aliases: ['首页', '工作台', '运营总览'], list: { name: 'Dashboard' } },

  // 系统管理
  { id: 'system.personnel', title: '人事资料管理', aliases: ['人员管理', '员工管理', '用户管理'], list: { name: 'Personnel' }, create: commonCreate('personnel') },
  { id: 'system.organization', title: '组织机构管理', aliases: ['组织管理', '机构管理'], list: { name: 'Organization' }, create: commonCreate('organization') },
  { id: 'system.position', title: '岗位管理', aliases: ['职位管理'], list: { name: 'Position' }, create: commonCreate('position') },
  { id: 'system.roles', title: '角色管理', aliases: ['权限角色'], list: { name: 'Roles' }, create: commonCreate('role') },
  { id: 'system.admin', title: '二级管理员', aliases: ['管理员管理'], list: { name: 'Admin' } },
  { id: 'system.area', title: '行政区划', aliases: ['地区管理', '行政区域'], list: { name: 'Area' }, create: commonCreate('area') },
  { id: 'system.logs', title: '访问日志', aliases: ['系统日志', '操作日志'], list: { name: 'Logs' } },
  { id: 'system.online', title: '在线用户', aliases: ['在线人员'], list: { name: 'Online' } },

  // 客户管理
  { id: 'customer.type', title: '客户类型', aliases: ['客户分类'], list: { name: 'CustomerType' }, create: commonCreate('customerType') },
  { id: 'customer.new', title: '新开拓客户', aliases: ['客户线索', '潜在客户'], list: { name: 'CustomerNew' }, create: commonCreate('customerNew') },
  { id: 'customer.info', title: '客户资料', aliases: ['正式客户', '正式客户信息', '客户档案'], list: { name: 'CustomerInfo' }, create: commonCreate('customerInfo') },
  { id: 'customer.public', title: '公海客户', aliases: ['客户公海'], list: { name: 'CustomerPublic' } },
  { id: 'customer.region', title: '区域管理', aliases: ['客户区域'], list: { name: 'CustomerRegion' }, create: commonCreate('customerRegion') },
  { id: 'customer.finance.credit', title: '客户授信余额表', aliases: ['客户授信', '授信余额'], list: { name: 'CustomerFinanceCredit' } },
  { id: 'customer.finance.prepay', title: '预付款余额表', aliases: ['客户预付款余额'], list: { name: 'CustomerFinancePrepay' } },
  { id: 'customer.finance.gift', title: '赠送金额余额表', aliases: ['客户赠送金额', '赠送余额'], list: { name: 'CustomerFinanceGift' }, create: { name: 'CustomerGiftAdd' } },
  { id: 'customer.finance.balance', title: '客户余额表', aliases: ['客户余额'], list: { name: 'CustomerFinanceBalance' } },
  { id: 'customer.task.visit', title: '拜访任务单', aliases: ['客户拜访任务', '拜访任务'], list: { name: 'CustomerTaskVisit' }, create: { name: 'CustomerTaskVisitAdd' } },

  // 产品管理
  { id: 'product.category', title: '产品类别', aliases: ['商品类别', '产品分类'], list: { name: 'ProductCategory' }, create: commonCreate('productCategory') },
  { id: 'product.unit', title: '计量单位', aliases: ['产品单位', '单位管理'], list: { name: 'ProductUnit' }, create: commonCreate('productUnit') },
  { id: 'product.info', title: '产品资料', aliases: ['产品档案', '商品资料', '商品档案'], list: { name: 'ProductInfo' }, create: commonCreate('productInfo') },
  { id: 'product.unsold', title: '滞销产品表', aliases: ['滞销产品', '滞销商品'], list: { name: 'ProductUnsold' } },

  // 仓库管理
  { id: 'warehouse.location', title: '库位管理', aliases: ['仓库库位'], list: { name: 'WarehouseLocation' }, create: commonCreate('warehouseLocation') },
  { id: 'warehouse.shelf', title: '放货货位', aliases: ['货架管理', '放货位'], list: { name: 'WarehouseShelf' }, create: commonCreate('warehouseShelf') },
  { id: 'warehouse.plastic', title: '塑料盒管理', aliases: ['周转箱管理', '塑料盒'], list: { name: 'WarehousePlastic' }, create: commonCreate('warehousePlastic') },
  { id: 'warehouse.stock', title: '产品库存', aliases: ['商品库存', '库存查询'], list: { name: 'WarehouseStock' } },
  { id: 'warehouse.printer', title: '打印机', aliases: ['打印机管理'], list: { name: 'WarehousePrinter' }, create: commonCreate('warehousePrinter') },

  // 采购管理
  { id: 'purchase.supplier.type', title: '供应商类型', aliases: ['供应商分类'], list: { name: 'SupplierType' }, create: commonCreate('purchaseSupplierType') },
  { id: 'purchase.supplier', title: '供应商档案', aliases: ['供应商资料', '供应商管理'], list: { name: 'Supplier' }, create: commonCreate('purchaseSupplier') },
  { id: 'purchase.supplier.credit', title: '供应商授信', aliases: ['供应商授信余额'], list: { name: 'SupplierCredit' } },
  { id: 'purchase.supplier.gift', title: '供应商赠送金额', aliases: ['供应商赠送余额'], list: { name: 'SupplierGift' } },
  { id: 'purchase.order', title: '采购订单', aliases: ['采购单', '采购开单'], list: { name: 'PurchaseOrder' }, create: commonCreate('purchaseOrder') },
  { id: 'purchase.inbound', title: '采购入库单', aliases: ['采购入库', '入库单'], list: { name: 'PurchaseInbound' }, create: commonCreate('purchaseInbound') },
  { id: 'purchase.return', title: '采购退货单', aliases: ['采购退货'], list: { name: 'PurchaseReturn' }, create: commonCreate('purchaseReturn') },
  { id: 'purchase.report.return-summary', title: '采购退货汇总表', aliases: ['采购退货汇总'], list: { name: 'PurchaseReportReturnSummary' } },
  { id: 'purchase.report.inbound-detail', title: '采购入库单明细', aliases: ['采购入库明细'], list: { name: 'PurchaseReportInboundDetail' } },
  { id: 'purchase.report.supplier-balance', title: '供应商余额表', aliases: ['供应商余额'], list: { name: 'PurchaseReportSupplierBalance' } },

  // 销售管理
  { id: 'sales.order', title: '销售订单', aliases: ['销售单', '销售开单', '开单'], list: { name: 'SalesOrder' }, create: commonCreate('salesOrder') },
  { id: 'sales.return', title: '销售退货单', aliases: ['销售退货'], list: { name: 'SalesReturn' }, create: commonCreate('salesReturn') },
  { id: 'sales.reconciliation', title: '销售对账单', aliases: ['对账单管理', '销售对账'], list: { name: 'SalesReconciliation' }, create: { name: 'SalesReconciliationAdd' } },
  { id: 'sales.report.product-summary', title: '产品销售汇总表', aliases: ['产品销售汇总', '商品销售汇总'], list: { name: 'SalesReportProductSummary' } },
  { id: 'sales.report.customer-summary', title: '客户销售汇总表', aliases: ['客户销售汇总'], list: { name: 'SalesReportCustomerSummary' } },
  { id: 'sales.report.order-detail', title: '销售订单明细表', aliases: ['销售订单明细'], list: { name: 'SalesReportOrderDetail' } },
  { id: 'sales.report.customer-order-detail', title: '客户订货明细表', aliases: ['客户订货明细'], list: { name: 'SalesReportCustomerOrderDetail' } },

  // 配送管理
  { id: 'delivery.task', title: '配送任务', aliases: ['配送任务单'], list: { name: 'DeliveryTask' }, create: { name: 'DeliveryTaskAdd' } },
  { id: 'delivery.logistics', title: '物流单号管理', aliases: ['物流单号'], list: { name: 'DeliveryLogistics' } },
  { id: 'delivery.driver', title: '司机档案', aliases: ['司机管理', '驾驶员档案'], list: { name: 'DeliveryDriver' }, create: { name: 'DeliveryDriverAdd' } },
  { id: 'delivery.vehicle', title: '车辆管理', aliases: ['车辆档案'], list: { name: 'DeliveryVehicle' }, create: commonCreate('vehicle') },
  { id: 'delivery.company', title: '物流公司', aliases: ['物流公司管理'], list: { name: 'DeliveryCompany' }, create: commonCreate('logisticsCompany') },

  // 财务管理
  { id: 'finance.subject', title: '科目管理', aliases: ['财务科目', '会计科目'], list: { name: 'FinanceSubject' } },
  { id: 'finance.bank-account', title: '银行账户', aliases: ['银行账户管理'], list: { name: 'FinanceBankAccount' }, create: commonCreate('bankAccount') },
  { id: 'finance.other-receipt', title: '其他收款', aliases: ['其他收款单'], list: { name: 'FinanceOtherReceipt' }, create: commonCreate('otherReceipt') },
  { id: 'finance.transfer', title: '收款单', aliases: ['销售收款单', '收款管理'], list: { name: 'FinanceTransfer' }, create: commonCreate('collectionReceipt') },
  { id: 'finance.gift', title: '月结收款单', aliases: ['月结收款'], list: { name: 'FinanceGift' }, create: { name: 'MonthlyReceiptOrderAdd' } },
  { id: 'finance.precollection', title: '预收款单', aliases: ['预收款'], list: { name: 'FinancePrecollection' }, create: { name: 'PrecollectionOrderAdd' } },
  { id: 'finance.payment-order', title: '付款单', aliases: ['付款管理'], list: { name: 'FinancePaymentOrder' }, create: commonCreate('paymentOrder') },
  { id: 'finance.monthly-payment', title: '月结付款单', aliases: ['月结付款'], list: { name: 'FinanceMonthlyPayment' }, create: commonCreate('monthlyPaymentOrder') },
  { id: 'finance.prepayment', title: '预付款单', aliases: ['采购预付款单', '预付款管理'], list: { name: 'FinancePrepayment' }, create: commonCreate('prepaymentOrder') },
  { id: 'finance.other-payment', title: '其他付款', aliases: ['其他付款单'], list: { name: 'FinanceOtherPayment' }, create: commonCreate('otherPayment') },
]

const sectionLabels: Record<AgentNavigationSection, string> = {
  dashboard: '工作台',
  system: '系统管理',
  customer: '客户管理',
  product: '产品管理',
  warehouse: '仓库管理',
  purchase: '采购管理',
  sales: '销售管理',
  delivery: '配送管理',
  finance: '财务管理',
}

const semanticOverrides: Record<string, Partial<AgentNavigationPage>> = {
  ...agentSemanticPages,
  'customer.info': {
    description: '用于查看正式客户档案，并按客户名称、客户类型和状态查询客户。',
    keywords: ['客户信息', '客户查询', '客户档案', '正式客户', '客户'],
    intentExamples: ['查看客户信息', '查询某个客户', '进入客户资料页面'],
    excludedIntents: ['新开拓客户', '公海客户', '供应商资料'],
    capabilities: [{
      id: 'customer.search',
      kind: 'read',
      description: '按客户名称、类型和状态查询正式客户',
      keywords: ['查询', '搜索', '查找', '客户信息'],
    }],
    agentPageId: 'customer.info.list',
  },
  'warehouse.stock': {
    description: '用于查看产品库存数量和库存状态，不用于查询历史出库商品明细。',
    keywords: ['库存', '产品库存', '商品库存'],
    intentExamples: ['查看库存', '进入产品库存页面','查询某个产品的库存数量'],
    excludedIntents: ['出库记录', '出库商品明细', '销售出库'],
  },
  'purchase.order': {
    description: '用于查看和新增采购订单，不用于销售订单或采购入库记录。',
    keywords: ['采购订单', '采购单'],
    intentExamples: ['查看采购订单', '新增采购订单'],
    excludedIntents: ['销售订单', '采购入库', '采购退货'],
  },
  'purchase.inbound': {
    description: '用于查看和新增采购入库单，表示采购商品进入仓库。',
    keywords: ['采购入库', '入库单'],
    intentExamples: ['查看采购入库单', '新增采购入库单','查询某个客户的采购入库单','了解一下入库情况'],
    excludedIntents: ['销售出库', '采购订单', '采购退货'],
  },
  'purchase.return': {
    description: '用于查看和新增采购退货单，可能包含退货出库，但不代表普通销售出库。',
    keywords: ['采购退货', '供应商退货'],
    intentExamples: ['查看采购退货单', '新增采购退货单','看一下退货情况'],
    excludedIntents: ['销售出库', '销售退货', '采购入库'],
  },
  'sales.order': {
    description: '用于查看、新增和审核销售订单，并查看订单当前仓库状态；暂不支持按出库日期查询商品明细。',
    keywords: ['销售订单', '销售单', '销售开单', '卖货', '卖了什么货'],
    intentExamples: ['查看销售订单', '新增销售订单', '查询某个客户的销售订单', '昨天卖了什么货'],
    excludedIntents: ['采购订单', '采购入库', '出库商品明细', '出货', '发货'],
    capabilities: [
      {
        id: 'sales-order.search',
        kind: 'read',
        description: '按订单号、客户、结算方式、审核状态和创建日期查询销售订单',
        keywords: ['查询', '搜索', '查找', '订单'],
      },
      {
        id: 'sales-order.audit-approve',
        kind: 'write',
        description: '审核通过一张当前页面中的未审核销售订单',
        keywords: ['审核', '审核通过'],
      },
    ],
    agentPageId: 'sales.order.list',
  },
  'delivery.task': {
    description: '用于管理已出库销售订单的配送、装车、发货和送达任务；“出货”按配送业务解释。',
    keywords: ['配送任务', '配送单', '送货任务', '今天要送哪些订单', '今天有哪些货要送', '出货', '发货', '出了什么货'],
    intentExamples: ['查看配送任务', '今天要送哪些订单', '我先看一下昨天出了什么货', '查看出货情况'],
    excludedIntents: ['卖货', '销售订单', '采购入库'],
  },
  'sales.return': {
    description: '用于查看和新增销售退货单，不用于普通销售订单或采购退货。',
    keywords: ['销售退货', '客户退货', '客户把货退回来'],
    intentExamples: ['查看销售退货单', '客户把货退回来了', '新增销售退货单'],
    excludedIntents: ['采购退货', '销售出库', '销售订单'],
  },
  'sales.report.order-detail': {
    description: '用于查看销售订单中的产品、数量和金额明细；当前没有 Agent 查询 Action。',
    keywords: ['销售订单明细', '订单产品明细'],
    intentExamples: ['查看销售订单明细', '查看订单里的商品明细'],
    excludedIntents: ['出库商品明细', '采购订单明细'],
  },
}

function sectionFromPageId(pageId: string): AgentNavigationSection {
  const section = pageId.split('.')[0] as AgentNavigationSection
  return section in sectionLabels ? section : 'system'
}

export const agentNavigationPages: AgentNavigationPage[] = agentNavigationPageDefinitions.map(
  (definition) => {
    const section = sectionFromPageId(definition.id)
    const override = semanticOverrides[definition.id] ?? {}
    return {
      ...definition,
      section,
      description: override.description ?? `用于进入${definition.title}业务页面。`,
      keywords: override.keywords ?? [],
      intentExamples: override.intentExamples ?? [`查看${definition.title}`],
      excludedIntents: override.excludedIntents ?? [],
      capabilities: override.capabilities ?? [],
      ...(override.agentPageId ? { agentPageId: override.agentPageId } : {}),
    }
  },
)

function normalizeNavigationTerm(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s，。！？、,.!?·:：;；'"“”‘’()（）【】\[\]_-]+/g, '')
    .replace(/(?:页面|列表页)$/g, '')
}

function pageTerms(page: AgentNavigationPage): string[] {
  return [page.id, page.title, ...page.aliases, ...page.keywords]
    .map(normalizeNavigationTerm)
    .filter(Boolean)
}

export function resolveAgentNavigation(
  pageName: string,
  mode: AgentNavigationMode,
): AgentNavigationResolution {
  if (/[\\/?#]|:\/\//.test(pageName)) {
    return { ok: false, reason: 'not_found', suggestions: [] }
  }
  const term = normalizeNavigationTerm(pageName)
  if (!term) return { ok: false, reason: 'not_found', suggestions: [] }

  const exactMatches = agentNavigationPages.filter((page) => pageTerms(page).includes(term))
  let matches = exactMatches
  if (!matches.length && term.length >= 2) {
    matches = agentNavigationPages.filter((page) =>
      pageTerms(page).some((candidate) => candidate.includes(term) || term.includes(candidate)),
    )
  }

  if (!matches.length) return { ok: false, reason: 'not_found', suggestions: [] }
  if (matches.length > 1) {
    return {
      ok: false,
      reason: 'ambiguous',
      suggestions: matches.slice(0, 6).map((page) => page.title),
    }
  }

  const page = matches[0]
  const location = mode === 'create' ? page.create : page.list
  if (!location) {
    return {
      ok: false,
      reason: 'mode_not_supported',
      suggestions: [page.title],
    }
  }
  return { ok: true, page, mode, location }
}

export interface AgentNavigationCandidate {
  page: AgentNavigationPage
  score: number
  matchedTerms: string[]
}

export function findAgentNavigationCandidates(
  query: string,
  limit = 8,
): AgentNavigationCandidate[] {
  const normalizedQuery = normalizeNavigationTerm(query)
  if (!normalizedQuery) return []

  return agentNavigationPages
    .map((page) => {
      const matchedTerms: string[] = []
      let score = 0
      for (const rawTerm of [page.title, ...page.aliases, ...page.keywords]) {
        const term = normalizeNavigationTerm(rawTerm)
        if (!term) continue
        if (normalizedQuery.includes(term)) {
          matchedTerms.push(rawTerm)
          score = Math.max(score, 100 + term.length * 10)
        } else if (normalizedQuery.length >= 2 && term.includes(normalizedQuery)) {
          matchedTerms.push(rawTerm)
          score = Math.max(score, 20 + normalizedQuery.length)
        }
      }
      if (page.excludedIntents.some((item) => normalizedQuery.includes(normalizeNavigationTerm(item)))) {
        score = 0
      }
      return { page, score, matchedTerms }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.page.title.localeCompare(right.page.title, 'zh-CN'))
    .slice(0, limit)
}

function semanticPageText(page: AgentNavigationPage): string {
  const capabilities = page.capabilities.length
    ? page.capabilities.map((item) => `${item.id}: ${item.description}`).join('；')
    : '仅页面导航'
  const exclusions = page.excludedIntents.length
    ? `；不适用：${page.excludedIntents.join('、')}`
    : ''
  return `- ${page.id}｜${page.title}${page.create ? ' [可新增]' : ''}｜${page.description}${exclusions}；能力：${capabilities}`
}

export function getAgentNavigationCatalogText(query?: string): string {
  const candidates = query ? findAgentNavigationCandidates(query, 6) : []
  if (candidates.length) return candidates.map(({ page }) => semanticPageText(page)).join('\n')

  return Object.entries(sectionLabels)
    .map(([section, label]) => {
      const titles = agentNavigationPages
        .filter((page) => page.section === section)
        .map((page) => `${page.id}:${page.title}${page.create ? '[可新增]' : ''}`)
      return `- ${label}：${titles.join('、')}`
    })
    .join('\n')
}

export function getAgentNavigationParentRouteName(
  routeName: string,
  query: Record<string, unknown>,
): string | undefined {
  const matchesLocation = (location: AgentNavigationLocation | undefined): boolean => {
    if (!location || location.name !== routeName) return false
    return Object.entries(location.query ?? {}).every(
      ([key, value]) => String(query[key] ?? '') === value,
    )
  }

  const page = agentNavigationPages.find(
    (candidate) => matchesLocation(candidate.list) || matchesLocation(candidate.create),
  )
  return page?.list.name
}
import { agentSemanticPages } from './semanticCatalog/index.ts'
