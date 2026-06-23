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
}

// ==================== API 方法 ====================

export function getDashboardOverview(params?: DashboardQueryParams): Promise<ApiResponse<DashboardOverview>> {
  return get<DashboardOverview>('/dashboard/overview', params as unknown as Record<string, unknown>)
}
