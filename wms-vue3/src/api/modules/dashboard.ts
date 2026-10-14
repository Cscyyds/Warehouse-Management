/**
 * 模块：仪表盘
 * 功能：运营总览聚合接口（顶部汇总、入库/出库/发货统计、最近入库单、库存预警）
 */
import { get } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

// ==================== 请求参数 ====================

export interface DashboardQueryParams {
  warehouseId?: string
  dateRange?: 'today' | 'week' | 'month'
}

// ==================== 响应类型 ====================

/** 租户贸易模式（判据由后端给出，前端不自行拼） */
export type DashboardMode = 'TIANXIN' | 'NATIVE'

/** 顶部汇总 */
export interface DashboardSummary {
  pendingOrders: number
  stockAlerts: number
  todayInbound: number
  updateTime: string
}

/** 待仓库作业单据数（口径同扫码枪端：主单已发送仓库且存在未被全部冲减的明细） */
export interface PendingOps {
  purchaseReceipt: number
  purchaseReturn: number
  salesReturn: number
  salesOrder: number
  total: number
}

/** 库存汇总（pms_product 实时口径；无冻结库存列故不含 frozenQty） */
export interface InventorySummary {
  totalQty: number
  saleableQty: number
}

/** 库存 TOP N 产品条目（柱状图） */
export interface InventoryTopProductItem {
  /** 产品编码：作为 x 轴短标签展示 */
  code?: string
  /** 产品全名：悬浮柱子时在 tooltip 展示 */
  name: string
  total: number
  saleable: number
}

/** 天心贸易单据条目（docKey 为路由段形态，展示名由前端 tradeDocConfig 单点提供） */
export interface TianxinTradeDocItem {
  docKey: 'purchase-order' | 'sales-order' | 'purchase-return' | 'sales-return'
  /** primary=采购/销售订单主行，secondary=两类退货单次行 */
  tier: 'primary' | 'secondary'
  totalCount: number
  todayCount: number
  last7DaysCount: number
  todayQty: number
  last7DaysQty: number
  pendingOpsCount: number
  lastBillDate: string | null
}

/** 天心贸易概览块（非天心模式 docs 为空） */
export interface TianxinTradeBlock {
  docs: TianxinTradeDocItem[]
  totals: {
    totalCount: number
    todayCount: number
    last7DaysCount: number
    pendingOpsCount: number
  }
}

/** 按仓库出库分布条目（天心侧，近 7 天销货明细口径） */
export interface WarehouseOutboundItem {
  name: string
  qty: number
  billCount: number
}

/** 生产单据条目 */
export interface ProductionDocItem {
  docKey: string
  name: string
  billCount: number
  pendingOpsCount: number
  lastBillDate: string | null
  phase: string | null
  lastSuccessAt: string | null
  lastError: string | null
  unboundPrdCount: number
  syncedRecently: boolean
}

/** 生产管理概览块（未开通生产时 enabled=false 且 docs 为空） */
export interface ProductionBlock {
  enabled: boolean
  docs: ProductionDocItem[]
  totals: {
    billCount: number
    pendingOpsCount: number
    errorDocCount: number
    unboundPrdCount: number
  }
}

/** 单项统计（含同比趋势） */
export interface StatItem {
  count: number
  change: string
  trend: string
}

/** 入库/出库/发货统计组 */
export interface StatGroup {
  pending: StatItem
  completed: StatItem
}

/** 统计三组 */
export interface DashboardStatGroups {
  inbound: StatGroup
  outbound: StatGroup
  shipping: StatGroup
}

/** 最近入库单条目 */
export interface RecentInboundItem {
  no: string
  product: string
  quantity: number
  time: string
  status: string
}

/** 库存预警条目 */
export interface StockAlertItem {
  name: string
  percent: number
}

/** 仪表盘聚合响应 */
export interface DashboardOverview {
  /** 贸易模式：TIANXIN 走天心卡片，NATIVE 走 WMS 卡片 */
  mode: DashboardMode
  /** 生产管理模块是否开通（未开通时前端整块隐藏生产卡片） */
  productionEnabled: boolean
  summary: DashboardSummary
  /** 待仓库作业单据数（WMS 四类单据） */
  pendingOps: PendingOps
  statGroups: DashboardStatGroups
  recentInbounds: RecentInboundItem[]
  alerts: StockAlertItem[]
  /** 近7天每日趋势（折线图） */
  dailyTrends: DailyTrendItem[]
  /** 库存 TOP N 产品（柱状图，替代原「各仓库库存分布」） */
  inventoryTopProducts: InventoryTopProductItem[]
  /** 订单状态分布（环形图） */
  orderDistribution: OrderDistributionItem[]
  inventorySummary: InventorySummary
  inventoryItemCount: number
  /** 天心贸易四单据（仅天心模式有数据） */
  tianxinTrade: TianxinTradeBlock
  /** 天心侧按仓库出库分布（仅天心模式有数据） */
  warehouseOutbound: WarehouseOutboundItem[]
  /** 生产管理 13 类单据与同步健康 */
  production: ProductionBlock
}

/** 每日趋势条目 */
export interface DailyTrendItem {
  date: string
  inbound: number
  outbound: number
}

/** 订单分布条目 */
export interface OrderDistributionItem {
  name: string
  value: number
}

// ==================== API 方法 ====================

/**
 * 仪表盘概览。silent：仪表盘是登录后公共落地页，无 /tenant-dashboard/overview
 * 接口权限的账号会收到 403「权限不足」，页面侧已按空数据静默兜底（Dashboard.vue
 * 的 catch），无需再弹全局错误 toast 打扰用户。
 */
export function getDashboardOverview(params?: DashboardQueryParams): Promise<ApiResponse<DashboardOverview>> {
  return get<DashboardOverview>('/api/v1/tenant-dashboard/overview', params as unknown as Record<string, unknown>, { silent: true })
}
