export type AgentNavigationMode = 'list' | 'create'

export interface AgentNavigationLocation {
  name: string
  query?: Record<string, string>
}

export interface AgentNavigationPage {
  id: string
  title: string
  aliases: string[]
  list: AgentNavigationLocation
  create?: AgentNavigationLocation
}

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

export const agentNavigationPages: AgentNavigationPage[] = [
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

function normalizeNavigationTerm(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s，。！？、,.!?·:：;；'"“”‘’()（）【】\[\]_-]+/g, '')
    .replace(/(?:页面|列表页)$/g, '')
}

function pageTerms(page: AgentNavigationPage): string[] {
  return [page.id, page.title, ...page.aliases]
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

export function getAgentNavigationCatalogText(): string {
  return agentNavigationPages
    .map((page) => `${page.title}${page.create ? ' [可新增]' : ''}`)
    .join('、')
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
