/**
 * 模块：客户余额汇总 + 余额变动明细（tenant-customers/balance-summary, tenant-customers/balance-logs）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：余额汇总列表/搜索、余额变动明细列表/搜索（按天分组）
 */
import { get } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 余额汇总条目 */
export interface BalanceSummaryItem {
  customer_id: string
  customer_name: string
  area_id?: string
  area_name?: string
  is_monthly_settlement: number
  monthly_days: number
  settlement_day: number
  balance: number
  follower_user_id?: string
  follower_user_name?: string
  salesman_user_id?: string
  salesman_user_name?: string
}

/** 余额汇总列表响应 */
export interface BalanceSummaryListResponse {
  total: number
  page: number
  page_size: number
  global_balance: number
  global_positive_balance: number
  global_negative_balance: number
  customers: BalanceSummaryItem[]
}

/** 余额变动明细条目 */
export interface BalanceLogItem {
  log_id: string
  bill_no: string
  sales_order_id?: string
  biz_type: string
  record_type: string
  amount: number
  issued_amount: number
  used_amount: number
  before_amount: number
  after_amount: number
  remark?: string
  created_by: string
  created_by_name: string
  created_at: string
}

/** 按天分组 */
export interface DailyGroup {
  date: string
  day_start_balance: number
  day_end_balance: number
  day_change_amount: number
  details: BalanceLogItem[]
}

/** 余额变动明细列表响应 */
export interface BalanceLogListResponse {
  total: number
  page: number
  page_size: number
  tenant_code: string
  tenant_name: string
  customer_id: string
  customer_name: string
  current_balance: number
  daily_groups: DailyGroup[]
}

/** 查询客户余额汇总列表 */
export function getBalanceSummaryList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<BalanceSummaryListResponse>> {
  return get<BalanceSummaryListResponse>('/api/v1/tenant-customers/balance-summary/query', params as unknown as Record<string, unknown>)
}

/** 搜索客户余额汇总列表 */
export function searchBalanceSummary(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<BalanceSummaryListResponse>> {
  return get<BalanceSummaryListResponse>('/api/v1/tenant-customers/balance-summary/search', params as unknown as Record<string, unknown>)
}

/** 查询客户余额变动明细（按天分组） */
export function getBalanceLogs(params: {
  customer_id: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<BalanceLogListResponse>> {
  return get<BalanceLogListResponse>('/api/v1/tenant-customers/balance-logs/query', params as unknown as Record<string, unknown>)
}

/** 搜索客户余额变动明细 */
export function searchBalanceLogs(params: {
  customer_id: string
  search_field?: string
  search_value?: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<BalanceLogListResponse>> {
  return get<BalanceLogListResponse>('/api/v1/tenant-customers/balance-logs/search', params as unknown as Record<string, unknown>)
}
