/**
 * 模块：客户授信余额（租户客户接口 tenant-customers/credit）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：新增/调减授信余额、查询授信余额汇总列表、搜索授信余额汇总列表、查询指定客户授信明细列表、搜索指定客户授信明细
 * 说明：写操作均为 multipart/form-data
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 新增/调减授信余额返回 */
export interface CreditLogResult {
  log_id: string
  bill_no: string
  customer_id: string
  amount: number
  new_credit_amount: number
  record_type: string
  created_at: string
}

/** 授信余额汇总条目（query/search 返回） */
export interface CreditSummaryItem {
  customer_id: string
  customer_name: string
  credit_amount: number
  credit_used_total: number
  credit_remaining: number
}

/** 授信余额汇总列表响应（query/search 返回） */
export interface CreditSummaryListResponse {
  total: number
  global_issued_total: number
  global_used_total: number
  global_remaining_total: number
  customers: CreditSummaryItem[]
}

/** 指定客户授信明细条目（query/search 返回） */
export interface CreditLogDetailItem {
  log_id: string
  bill_no: string
  issued_amount: number
  used_amount: number
  record_type: string
  created_at: string
  remark?: string
}

/** 指定客户授信明细列表响应（query/search 返回） */
export interface CreditLogListResponse {
  total: number
  customer_id: string
  customer_name: string
  customer_credit_total: number
  customer_used_total: number
  customer_remaining_total: number
  details: CreditLogDetailItem[]
}

/** 新增/调减授信余额入参 */
export interface CreditLogPayload {
  customer_id: string
  amount: number
  remark?: string
}

/** 新增/调减客户授信余额（正数=新增，负数=调减） */
export function addCreditLog(data: CreditLogPayload): Promise<ApiResponse<CreditLogResult>> {
  return post<CreditLogResult>('/api/v1/tenant-customers/credit-logs', toMultipart(data as unknown as Record<string, unknown>))
}

/** 查询授信余额汇总列表 */
export function getCreditSummaryList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<CreditSummaryListResponse>> {
  return get<CreditSummaryListResponse>('/api/v1/tenant-customers/credit-summary/query', params as unknown as Record<string, unknown>)
}

/** 搜索授信余额汇总列表（全局汇总按搜索结果范围统计） */
export function searchCreditSummary(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<CreditSummaryListResponse>> {
  return get<CreditSummaryListResponse>('/api/v1/tenant-customers/credit-summary/search', params as unknown as Record<string, unknown>)
}

/** 查询指定客户授信明细列表 */
export function getCreditLogList(params: {
  customer_id: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<CreditLogListResponse>> {
  return get<CreditLogListResponse>('/api/v1/tenant-customers/credit-logs/query', params as unknown as Record<string, unknown>)
}

/** 搜索指定客户授信明细（search_field 可传 ["start_time","end_time"]，search_value 传 {start_time,end_time} 时间范围） */
export function searchCreditLogs(params: {
  customer_id: string
  search_field?: string
  search_value?: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<CreditLogListResponse>> {
  return get<CreditLogListResponse>('/api/v1/tenant-customers/credit-logs/search', params as unknown as Record<string, unknown>)
}
