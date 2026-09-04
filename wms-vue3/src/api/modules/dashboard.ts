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

/** 顶部汇总 */
export interface DashboardSummary {
  pendingOrders: number
  stockAlerts: number
  todayInbound: number
  updateTime: string
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
  summary: DashboardSummary
  statGroups: DashboardStatGroups
  recentInbounds: RecentInboundItem[]
  alerts: StockAlertItem[]
  /** 近7天每日趋势（折线图） */
  dailyTrends: DailyTrendItem[]
  /** 各仓库库存分布（柱状图） */
  warehouseStock: WarehouseStockItem[]
  /** 订单状态分布（环形图） */
  orderDistribution: OrderDistributionItem[]
}

/** 每日趋势条目 */
export interface DailyTrendItem {
  date: string
  inbound: number
  outbound: number
}

/** 仓库库存条目 */
export interface WarehouseStockItem {
  name: string
  total: number
  saleable: number
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
