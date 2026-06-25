/**
 * 模块：客户预付款余额（租户客户接口 tenant-customers/prepayment）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：新增/调减预付款余额、查询预付款余额汇总列表、搜索预付款余额汇总列表、查询指定客户预付款明细列表、搜索指定客户预付款明细
 * 说明：写操作均为 multipart/form-data
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 新增/调减预付款余额返回 */
export interface PrepaymentLogResult {
  log_id: string
  bill_no: string
  customer_id: string
  amount: number
  new_prepayment_amount: number
  record_type: string
  created_at: string
}

/** 预付款余额汇总条目（query/search 返回） */
export interface PrepaymentSummaryItem {
  customer_id: string
  customer_name: string
  prepayment_amount: number
  prepayment_used_total: number
  prepayment_remaining: number
}

/** 预付款余额汇总列表响应（query/search 返回） */
export interface PrepaymentSummaryListResponse {
  total: number
  global_prepayment_total: number
  global_prepayment_used: number
  global_prepayment_remaining: number
  customers: PrepaymentSummaryItem[]
}

/** 指定客户预付款明细条目（query/search 返回） */
export interface PrepaymentLogDetailItem {
  log_id: string
  bill_no: string
  issued_amount: number
  used_amount: number
  record_type: string
  created_at: string
  remark?: string
}

/** 指定客户预付款明细列表响应（query/search 返回） */
export interface PrepaymentLogListResponse {
  total: number
  customer_id: string
  customer_name: string
  customer_prepayment_total: number
  customer_used_total: number
  customer_remaining_total: number
  details: PrepaymentLogDetailItem[]
}

/** 新增/调减预付款余额入参 */
export interface PrepaymentLogPayload {
  customer_id: string
  amount: number
  remark?: string
}

/** 新增/调减客户预付款余额（正数=新增，负数=调减） */
export function addPrepaymentLog(data: PrepaymentLogPayload): Promise<ApiResponse<PrepaymentLogResult>> {
  return post<PrepaymentLogResult>('/api/v1/tenant-customers/prepayment-logs', toMultipart(data as unknown as Record<string, unknown>))
}

/** 查询预付款余额汇总列表 */
export function getPrepaymentSummaryList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<PrepaymentSummaryListResponse>> {
  return get<PrepaymentSummaryListResponse>('/api/v1/tenant-customers/prepayment-summary/query', params as unknown as Record<string, unknown>)
}

/** 搜索预付款余额汇总列表（全局汇总按搜索结果范围统计） */
export function searchPrepaymentSummary(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<PrepaymentSummaryListResponse>> {
  return get<PrepaymentSummaryListResponse>('/api/v1/tenant-customers/prepayment-summary/search', params as unknown as Record<string, unknown>)
}

/** 查询指定客户预付款明细列表 */
export function getPrepaymentLogList(params: {
  customer_id: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<PrepaymentLogListResponse>> {
  return get<PrepaymentLogListResponse>('/api/v1/tenant-customers/prepayment-logs/query', params as unknown as Record<string, unknown>)
}

/** 搜索指定客户预付款明细（search_field 可传 ["start_time","end_time"]，search_value 传 {start_time,end_time} 时间范围） */
export function searchPrepaymentLogs(params: {
  customer_id: string
  search_field?: string
  search_value?: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<PrepaymentLogListResponse>> {
  return get<PrepaymentLogListResponse>('/api/v1/tenant-customers/prepayment-logs/search', params as unknown as Record<string, unknown>)
}
