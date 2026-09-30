import { agentSemanticPages } from './semanticCatalog/index.ts'
import { agentPagePinyinAliases } from './semanticCatalog/pinyinAliases.ts'

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
  | 'profile'

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
  synonyms: string[]
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
  | 'synonyms'
  | 'intentExamples'
  | 'excludedIntents'
  | 'capabilities'
  | 'agentPageId'
>

export interface AgentNavigationAlternative {
  id: string
  title: string
}

export type AgentNavigationResolution =
  | {
      ok: true
      page: AgentNavigationPage
      mode: AgentNavigationMode
      location: AgentNavigationLocation
      // top1 与 runner-up 分数接近（gap < minimumGap）时附带的其他相关页面：
      // navigationTool 据此在跳转成功后补一句"如果你要的是其他页面"，让用户
      // 在不被拦停的情况下二次确认。
      alternatives: AgentNavigationAlternative[]
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
  { id: 'system.admin', title: '管理员', aliases: ['管理员管理'], list: { name: 'Admin' } },
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
  { id: 'warehouse.printer.model', title: '打印机型号', aliases: ['打印机型号查询', '型号配置', '标签打印机型号'], list: { name: 'WarehousePrinterModel' } },

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
  { id: 'sales.customer-order', title: '客户订货单', aliases: ['订货单', '客户订货管理'], list: { name: 'CustomerOrder' }, create: { name: 'CustomerOrderCreate' } },
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

  // 个人中心
  { id: 'profile.center', title: '个人中心', aliases: ['我的资料', '个人信息', '账号信息'], list: { name: 'Profile' } },
  { id: 'profile.change-password', title: '修改密码', aliases: ['更改密码', '重置密码', '改密码'], list: { name: 'ChangePassword' } },
  { id: 'profile.my-visit-task', title: '负责拜访任务', aliases: ['我的拜访任务', '我负责的拜访任务', '我的拜访记录'], list: { name: 'MyVisitTask' } },
]

export const sectionLabels: Record<AgentNavigationSection, string> = {
  dashboard: '工作台',
  system: '系统管理',
  customer: '客户管理',
  product: '产品管理',
  warehouse: '仓库管理',
  purchase: '采购管理',
  sales: '销售管理',
  delivery: '配送管理',
  finance: '财务管理',
  profile: '个人中心',
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
    keywords: ['库存', '产品库存', '商品库存', '查一下某个产品的库存数量'],
    intentExamples: ['查看库存', '进入产品库存页面','查询某个产品的库存数量'],
    excludedIntents: ['出库记录', '出库商品明细', '销售出库'],
    capabilities: [{
      id: 'inventory.search',
      kind: 'read',
      description: '按产品、编码、条码或货位关键词查询产品库存',
      keywords: ['查询', '库存', '还有多少', '现货'],
    }],
    agentPageId: 'warehouse.stock.list',
  },
  'purchase.order': {
    description: '用于查看和新增采购订单，不用于销售订单或采购入库记录。',
    keywords: ['采购订单', '采购单', '采购记录', '采购了什么', '买了什么'],
    intentExamples: ['查看采购订单', '新增采购订单', '查看采购记录', '今天采购了什么'],
    excludedIntents: ['销售订单', '采购入库', '采购退货'],
    capabilities: [{
      id: 'purchase-order.search',
      kind: 'read',
      description: '按订单号、供应商、产品名称、审核状态和创建日期查询采购订单',
      keywords: ['查询', '搜索', '采购了什么', '买了什么'],
    }],
    agentPageId: 'purchase.order.list',
  },
  'purchase.supplier': {
    description: '用于查看供应商或供货商档案，并按名称、编码和状态查询。',
    keywords: ['供应商', '供货商', '厂家资料', '供应商档案'],
    intentExamples: ['查看供应商资料', '查询某个供货商', '进入供应商档案页面'],
    excludedIntents: ['客户资料', '物流公司', '供应商余额'],
    capabilities: [{
      id: 'supplier.search',
      kind: 'read',
      description: '按供应商名称、编码和状态查询供应商档案',
      keywords: ['查询', '搜索', '供应商资料', '供货商资料'],
    }],
    agentPageId: 'purchase.supplier.list',
  },
  'purchase.inbound': {
    description: '用于查看和新增采购入库单，表示采购商品进入仓库。',
    keywords: ['采购入库', '入库单'],
    intentExamples: ['查看采购入库单', '新增采购入库单','查询某个客户的采购入库单','了解一下入库情况'],
    excludedIntents: ['销售出库', '采购订单', '采购退货'],
    capabilities: [{
      id: 'purchase-inbound.search',
      kind: 'read',
      description: '按入库单号、供应商、入库状态和创建日期查询采购入库单',
      keywords: ['查询', '搜索', '采购入库', '到货'],
    }],
    agentPageId: 'purchase.inbound.list',
  },
  'purchase.return': {
    description: '用于查看和新增采购退货单，可能包含退货出库，但不代表普通销售出库。',
    keywords: ['采购退货', '供应商退货', '采购退货记录', '采退单'],
    intentExamples: ['查看采购退货单', '新增采购退货单','看一下退货情况'],
    excludedIntents: ['销售出库', '销售退货', '采购入库'],
    capabilities: [{
      id: 'purchase-return.search',
      kind: 'read',
      description: '按退货单号、供应商、出库状态和创建日期查询采购退货单',
      keywords: ['查询', '搜索', '采购退货', '退给供应商'],
    }],
    agentPageId: 'purchase.return.list',
  },
  'sales.order': {
    description: '用于查看、新增和审核销售订单主单，并查看订单客户、审核状态和仓库状态；不用于逐行查询卖出的具体商品。',
    keywords: ['销售订单', '销售单', '销售开单', '卖货单'],
    intentExamples: ['查看销售订单', '新增销售订单', '查询某个客户的销售订单'],
    excludedIntents: ['采购订单', '采购入库', '出库商品明细', '出货', '发货', '卖了什么', '销售商品明细'],
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
    keywords: ['配送任务', '配送单', '送货任务', '物流', '今天要送哪些订单', '今天有哪些货要送', '出货', '发货', '出了什么货'],
    intentExamples: ['查看配送任务', '看一下物流', '今天要送哪些订单', '我先看一下昨天出了什么货', '查看出货情况'],
    excludedIntents: ['卖货', '销售订单', '采购入库'],
    capabilities: [{
      id: 'delivery-task.search',
      kind: 'read',
      description: '按任务关键词、状态和计划发车日期查询配送任务',
      keywords: ['查询', '配送任务', '出货', '发货', '发车'],
    }],
    agentPageId: 'delivery.task.list',
  },
  'sales.return': {
    description: '用于查看和新增销售退货单，不用于普通销售订单或采购退货。',
    keywords: ['销售退货', '客户退货', '客户把货退回来', '销退单'],
    intentExamples: ['查看销售退货单', '客户把货退回来了', '新增销售退货单'],
    excludedIntents: ['采购退货', '销售出库', '销售订单'],
    capabilities: [{
      id: 'sales-return.search',
      kind: 'read',
      description: '按退货单号、客户、退货方式、审核状态和创建日期查询销售退货单',
      keywords: ['查询', '搜索', '销售退货', '客户退货'],
    }],
    agentPageId: 'sales.return.list',
  },
  'sales.report.order-detail': {
    description: '用于逐行查看销售订单中实际卖出的具体产品、数量和金额；“某天卖了什么/销售了哪些东西”属于本页面，不是产品销售汇总。',
    keywords: ['销售订单明细', '订单产品明细', '销售商品明细', '卖了什么', '销售了什么', '卖了哪些东西', '销售了哪些商品', '卖货明细', '卖了多少货'],
    synonyms: ['卖出的东西', '卖出的商品', '销售商品记录'],
    intentExamples: ['查看销售订单明细', '查看订单里的商品明细', '今天卖了什么东西', '昨天销售了哪些商品'],
    excludedIntents: ['出库商品明细', '采购订单明细', '产品销量排行', '销售汇总统计'],
    capabilities: [{
      id: 'sales-order-detail.search',
      kind: 'read',
      description: '按订单、客户、产品和创建日期查询销售商品明细',
      keywords: ['查询', '卖了什么', '销售商品明细', '卖货明细'],
    }],
    agentPageId: 'sales.order-detail.list',
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
      synonyms: override.synonyms ?? [],
      intentExamples: override.intentExamples ?? [`查看${definition.title}`],
      excludedIntents: override.excludedIntents ?? [],
      capabilities: override.capabilities ?? [],
      ...(override.agentPageId ? { agentPageId: override.agentPageId } : {}),
    }
  },
)

function normalizeLiteralTerm(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s，。！？、,.!?·:：;；'"“”‘’()（）【】\[\]_-]+/g, '')
}

export function normalizeNavigationTerm(value: string): string {
  return normalizeLiteralTerm(value).replace(/(?:页面|列表页)$/g, '')
}

// 用户话术既可以带后缀（"打开仪表盘页面"）也可以不带（"打开仪表盘"），
// 目录词条则按下标字面匹配。因此请求侧同时用"剥后缀"和"原样"两种形态匹配，
// 避免把"我的页面"这类词条削成"我的"后误配到"修改我的登录密码"。
function queryForms(value: string): string[] {
  return [...new Set([normalizeNavigationTerm(value), normalizeLiteralTerm(value)])]
    .filter((form) => form.length > 0)
}

export interface NavigationDecisionPolicy {
  minimumScore: number
  minimumGap: number
}

// 匹配层决策阈值：由评测集网格搜索得到（scripts/agentIntentCalibrate.mjs）。
// 实测平台区（954 常规用例 top1 941、错跳 0、反向违规 0）：minimumScore 200~300
// 等价（100 时反向违规 2 条，400 时 46 条退化为澄清）；minimumGap 只影响
// "是否附带确认提示"，取 120 时约 3.6% 话术会先跳转再确认。
// 调整词表权重或新增语义后需复跑校准。
export const defaultNavigationDecisionPolicy: NavigationDecisionPolicy = {
  minimumScore: 250,
  minimumGap: 120,
}

let navigationDecisionPolicy: NavigationDecisionPolicy = { ...defaultNavigationDecisionPolicy }

export function getNavigationDecisionPolicy(): NavigationDecisionPolicy {
  return navigationDecisionPolicy
}

export function configureNavigationDecisionPolicy(policy: Partial<NavigationDecisionPolicy>): void {
  navigationDecisionPolicy = { ...navigationDecisionPolicy, ...policy }
}

export function resetNavigationDecisionPolicy(): void {
  navigationDecisionPolicy = { ...defaultNavigationDecisionPolicy }
}

function finalizeNavigationResolution(
  page: AgentNavigationPage,
  mode: AgentNavigationMode,
  alternatives: AgentNavigationAlternative[],
): AgentNavigationResolution {
  const location = mode === 'create' ? page.create : page.list
  if (!location) {
    return { ok: false, reason: 'mode_not_supported', suggestions: [page.title] }
  }
  return { ok: true, page, mode, location, alternatives }
}

export function resolveAgentNavigation(
  pageName: string,
  mode: AgentNavigationMode,
): AgentNavigationResolution {
  if (/[\\/?#]|:\/\//.test(pageName)) {
    return { ok: false, reason: 'not_found', suggestions: [] }
  }
  const literal = normalizeLiteralTerm(pageName)
  if (!literal) return { ok: false, reason: 'not_found', suggestions: [] }

  // LLM 按系统指令传语义页面 ID 时精确命中，不再走打分。
  const byId = agentNavigationPages.find((page) => normalizeLiteralTerm(page.id) === literal)
  if (byId) return finalizeNavigationResolution(byId, mode, [])

  // 与本地确定性路由、候选详述共用同一个匹配器：两个通道对同一句话得出同一答案。
  // 排除词优先把干净候选排前面；全部被排除时不拒绝，回落最接近的页面
  // （跳转后由调用方附"是否指其他页面"提示，比硬拒体验好）。
  const allCandidates = findAgentNavigationCandidates(pageName, 8)
  const cleanCandidates = allCandidates.filter(
    (candidate) => !isExcludedNavigationQuery(candidate.page.id, pageName),
  )
  const candidates = cleanCandidates.length ? cleanCandidates : allCandidates
  const top = candidates[0]
  if (!top) return { ok: false, reason: 'not_found', suggestions: [] }

  const policy = getNavigationDecisionPolicy()
  if (top.score < policy.minimumScore) {
    // 有相关候选但都不够格：不猜，让 LLM 按建议改用具体业务页面名称重试。
    return {
      ok: false,
      reason: 'ambiguous',
      suggestions: candidates.slice(0, 6).map(({ page }) => page.title),
    }
  }

  const runnerUp = candidates[1]
  const alternatives = runnerUp && top.score - runnerUp.score < policy.minimumGap
    ? candidates
        .slice(1)
        .filter((candidate) => candidate.score >= policy.minimumScore)
        .slice(0, 3)
        .map(({ page }) => ({ id: page.id, title: page.title }))
    : []
  return finalizeNavigationResolution(top.page, mode, alternatives)
}

export interface AgentNavigationCandidate {
  page: AgentNavigationPage
  score: number
  matchedTerms: string[]
  // 该页面命中的最长词条（归一化后）与命中档位：用于词条覆盖度比较
  // （见 finalizePageMatches）。
  bestTerm: string
  bestTier: number
}

// 字段权重与分档基准：title 最高、intentExamples 参与匹配以覆盖自然语句，
// 具体数值由评测集（scripts/agentIntentEval.mjs）回归校准。
const titleWeight = 4
const aliasWeight = 3
const keywordWeight = 2
const exampleWeight = 1.5

interface WeightedPageTerm {
  raw: string
  term: string
  weight: number
}

function weightedPageTerms(page: AgentNavigationPage): WeightedPageTerm[] {
  const weighted: Array<[string, number]> = [
    [page.title, titleWeight],
    ...page.aliases.map((term): [string, number] => [term, aliasWeight]),
    ...page.keywords.map((term): [string, number] => [term, keywordWeight]),
    ...page.synonyms.map((term): [string, number] => [term, exampleWeight]),
    ...page.intentExamples.map((term): [string, number] => [term, exampleWeight]),
  ]
  // 同一页面重复声明同一个词（标题/别名/关键词经常互为副本）只按最高权重计一次：
  // 否则重复字段会让"赠送余额"这类泛词叠加到盖过更具体页面的程度。
  const byTerm = new Map<string, WeightedPageTerm>()
  for (const [raw, weight] of weighted) {
    const term = normalizeLiteralTerm(raw)
    if (!term) continue
    const existing = byTerm.get(term)
    if (!existing || weight > existing.weight) byTerm.set(term, { raw, term, weight })
  }
  return [...byTerm.values()]
}

// 命中档位：1=词条与请求完全相同，2=请求包含词条，3=词条包含请求（弱）。
// 档位用于"词条覆盖度"比较：只有同档（都包含在请求里）的长短词条才比较
// 具体性，避免反向包含的弱命中反过来盖过精确命中。
interface TermMatch {
  contribution: number
  tier: number
}

function termMatch(term: string, query: string): TermMatch | null {
  if (term === query) return { contribution: 300 + term.length * 20, tier: 1 }
  if (query.includes(term)) return { contribution: 150 + term.length * 15, tier: 2 }
  if (query.length >= 2 && term.length >= 2 && term.includes(query)) {
    return { contribution: 40 + query.length * 5, tier: 3 }
  }
  return null
}

function editDistance(left: string, right: string, limit: number): number | null {
  if (Math.abs(left.length - right.length) > limit) return null
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row]
    let rowMinimum = row
    for (let column = 1; column <= right.length; column += 1) {
      const substitution = left[row - 1] === right[column - 1] ? 0 : 1
      const value = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitution,
      )
      current.push(value)
      if (value < rowMinimum) rowMinimum = value
    }
    if (rowMinimum > limit) return null
    previous = current
  }
  const distance = previous[right.length]
  return distance <= limit ? distance : null
}

interface RawPageMatch {
  page: AgentNavigationPage
  term: string
  tier: number
  contribution: number
  matchedTerm: string
}

interface FuzzyPageMatch extends RawPageMatch {
  distance: number
  weight: number
}

function latinRuns(query: string): string[] {
  return query.match(/[a-z0-9]{2,}/g) ?? []
}

function collectTextualMatches(query: string): RawPageMatch[] {
  const matches: RawPageMatch[] = []
  for (const page of agentNavigationPages) {
    for (const { raw, term, weight } of weightedPageTerms(page)) {
      const match = termMatch(term, query)
      if (!match) continue
      matches.push({
        page,
        term,
        tier: match.tier,
        contribution: Math.round(match.contribution * weight),
        matchedTerm: raw,
      })
    }
  }
  return matches
}

function collectPinyinMatches(query: string): RawPageMatch[] {
  const runs = latinRuns(query)
  if (!runs.length) return []
  const matches: RawPageMatch[] = []
  for (const page of agentNavigationPages) {
    for (const alias of agentPagePinyinAliases[page.id] ?? []) {
      if (!runs.includes(alias)) continue
      matches.push({
        page,
        term: alias,
        tier: 2,
        contribution: Math.round((140 + alias.length * 10) * keywordWeight),
        matchedTerm: alias,
      })
    }
  }
  return matches
}

function collectFuzzyMatches(query: string): RawPageMatch[] {
  if (!/^[\u4e00-\u9fff]{2,6}$/.test(query)) return []
  const matches: FuzzyPageMatch[] = []
  for (const page of agentNavigationPages) {
    for (const { raw, term, weight } of weightedPageTerms(page)) {
      if (term.length < 2 || term.length > 6) continue
      if (!/^[\u4e00-\u9fff]+$/.test(term)) continue
      const limit = term.length <= 2 || query.length <= 2 ? 1 : 2
      const distance = editDistance(query, term, limit)
      if (distance === null) continue
      matches.push({ page, term, weight, tier: 3, distance, contribution: 0, matchedTerm: raw })
    }
  }
  // 只保留全局最小编辑距离的匹配：错别字场景下"采购定单→采购订单"（距离 1）
  // 必须压过"采购定单→采购入库单"（距离 2）这类字形相近但语义无关的近似。
  if (!matches.length) return []
  const bestDistance = Math.min(...matches.map((match) => match.distance))
  return matches
    .filter((match) => match.distance === bestDistance)
    .map((match) => ({
      page: match.page,
      term: match.term,
      tier: 3,
      matchedTerm: match.matchedTerm,
      contribution: Math.round(((bestDistance <= 1 ? 100 : 60) + match.term.length * 10) * match.weight),
    }))
}

function hasExcludedIntent(page: AgentNavigationPage, queries: string[]): boolean {
  return page.excludedIntents.some((item) => {
    const term = normalizeLiteralTerm(item)
    return term.length > 0 && queries.some((query) => query.includes(term))
  })
}

/**
 * 排除词硬否决：目录对该页面显式声明话术"不适用"时，该页面不得作为路由目标。
 * 打分层的 ×0.3 惩罚只影响排序；否决必须独立生效，否则被惩罚压到阈值之下的
 * 页面会失去对业务意图层的否决力（见 §11.5.15 已知限制 2 的修复）。
 */
export function isExcludedNavigationQuery(pageId: string, query: string): boolean {
  const page = agentNavigationPages.find((item) => item.id === pageId)
  if (!page) return false
  return hasExcludedIntent(page, queryForms(query))
}

function finalizePageMatches(
  matches: RawPageMatch[],
  queries: string[],
  limit: number,
): AgentNavigationCandidate[] {
  const byPage = new Map<string, RawPageMatch[]>()
  for (const match of matches) {
    const list = byPage.get(match.page.id)
    if (list) list.push(match)
    else byPage.set(match.page.id, [match])
  }

  const rankedCandidates = [...byPage.values()]
    .map((pageMatches) => {
      const ranked = [...pageMatches].sort((left, right) => right.contribution - left.contribution)
      const best = ranked[0]
      // 只累计"不被最佳命中词包含"的其余命中：'采购入库单' 页面同时命中
      // 标题+别名+关键词时，'采购入库'/'入库单' 都已被标题覆盖，重复累计会
      // 让泛化页面盖过命中更长词条的专指页面（如"采购入库单明细"）。
      const rest = ranked
        .slice(1)
        .filter((match) => !best.term.includes(match.term))
        .reduce((sum, item) => sum + item.contribution, 0)
      let score = best.contribution + Math.min(rest, Math.round(best.contribution * 0.4))
      const page = best.page
      // excludedIntents 改为惩罚而非清零：保留信号但不得盖过显式命中。
      if (hasExcludedIntent(page, queries)) score = Math.round(score * 0.3)
      return { page, score, matchedTerms: ranked.map((item) => item.matchedTerm), bestTerm: best.term, bestTier: best.tier }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.page.title.localeCompare(right.page.title, 'zh-CN'))

  // 词条覆盖优先：请求同时包含长短两个词条时，长词条（更具体）所在页面胜出。
  // 例如"销售订单明细"覆盖"销售订单"、"供货商赠送余额"覆盖"赠送余额"。
  // 只对同为"被请求包含"（tier 2）的命中生效，并且用"分数至少压过被覆盖者
  // 1 分"表达，保证决策层按分数重排后顺序仍然一致。
  let adjusted = true
  while (adjusted) {
    adjusted = false
    for (const shorter of rankedCandidates) {
      if (shorter.bestTier !== 2) continue
      for (const longer of rankedCandidates) {
        if (longer === shorter || longer.bestTier !== 2) continue
        if (longer.bestTerm.length <= shorter.bestTerm.length) continue
        if (!longer.bestTerm.includes(shorter.bestTerm)) continue
        if (longer.score > shorter.score) continue
        longer.score = shorter.score + 1
        adjusted = true
      }
    }
  }

  return rankedCandidates
    .sort((left, right) => right.score - left.score || left.page.title.localeCompare(right.page.title, 'zh-CN'))
    .slice(0, limit)
}

export function findAgentNavigationCandidates(
  query: string,
  limit = 8,
): AgentNavigationCandidate[] {
  const forms = queryForms(query)
  if (!forms.length) return []

  // L1 文本匹配（精确/包含/反向包含）优先；L2 拼音与 L3 编辑距离仅在
  // 更高级别完全落空时启用，避免引入反向误配。
  const textual = forms.flatMap((form) => collectTextualMatches(form))
  if (textual.length) return finalizePageMatches(textual, forms, limit)

  const pinyin = forms.flatMap((form) => collectPinyinMatches(form))
  if (pinyin.length) return finalizePageMatches(pinyin, forms, limit)

  return finalizePageMatches(
    forms.flatMap((form) => collectFuzzyMatches(form)),
    forms,
    limit,
  )
}

function semanticPageText(page: AgentNavigationPage): string {
  const capabilities = page.capabilities.length
    ? page.capabilities.map((item) => `${item.id}: ${item.description}`).join('；')
    : '仅页面导航'
  const exclusions = page.excludedIntents.length
    ? `；不适用：${page.excludedIntents.join('、')}`
    : ''
  const synonyms = page.synonyms.length
    ? `；近义词：${page.synonyms.join('、')}`
    : ''
  return `- ${page.id}｜${page.title}${page.create ? ' [可新增]' : ''}｜${page.description}${exclusions}${synonyms}；能力：${capabilities}`
}

function sectionOverviewText(): string {
  return Object.entries(sectionLabels)
    .map(([section, label]) => {
      const titles = agentNavigationPages
        .filter((page) => page.section === section)
        .map((page) => `${page.id}:${page.title}${page.create ? '[可新增]' : ''}`)
      return `- ${label}：${titles.join('、')}`
    })
    .join('\n')
}

export function getAgentNavigationCatalogText(query?: string): string {
  const candidates = query ? findAgentNavigationCandidates(query, 6) : []
  const overview = sectionOverviewText()
  if (!candidates.length) return overview

  // 候选详述用于精确匹配；全量索引防止候选选偏时 LLM 无从纠偏。
  return [
    '与当前请求最相关的语义页面：',
    candidates.map(({ page }) => semanticPageText(page)).join('\n'),
    '',
    '全部页面的完整索引（当以上候选均不匹配时，请从索引中按语义选择页面 ID；仍无法确定时用 ask_user 询问）：',
    overview,
  ].join('\n')
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
