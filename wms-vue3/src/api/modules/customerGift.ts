/**
 * 模块：客户赠送金额（租户客户接口 tenant-customers/gift）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：新增/调减赠送金额、查询赠送金额汇总列表、搜索赠送金额汇总列表、查询指定客户赠送明细列表、搜索指定客户赠送明细
 * 说明：写操作均为 multipart/form-data
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 新增/调减赠送金额返回 */
export interface GiftLogResult {
  log_id: string
  bill_no: string
  customer_id: string
  amount: number
  new_gift_amount: number
  record_type: string
  created_at: string
}

/** 赠送金额汇总条目（query/search 返回） */
export interface GiftSummaryItem {
  customer_id: string
  customer_name: string
  gift_amount: number
  cumulative_used_gift_amount: number
  remaining_gift_amount: number
  cumulative_added_gift_amount: number
}

/** 赠送金额汇总列表响应（query/search 返回） */
export interface GiftSummaryListResponse {
  total: number
  global_remaining_gift_amount: number
  global_cumulative_used_gift_amount: number
  global_cumulative_added_gift_amount: number
  customers: GiftSummaryItem[]
}

/** 指定客户赠送明细条目（query/search 返回） */
export interface GiftLogDetailItem {
  log_id: string
  bill_no: string
  issued_amount: number
  used_amount: number
  record_type: string
  biz_type: string
  before_amount: number
  after_amount: number
  signed_amount: number
  created_by: string
  created_by_name: string
  created_at: string
  remark?: string
}

/** 指定客户赠送明细列表响应（query/search 返回） */
export interface GiftLogListResponse {
  total: number
  page: number
  page_size: number
  customer_id: string
  customer_name: string
  customer_gift_total: number
  customer_used_total: number
  customer_remaining_total: number
  details: GiftLogDetailItem[]
}

/** 新增/调减赠送金额入参 */
export interface GiftLogPayload {
  customer_id: string
  amount: number
  remark?: string
}

/** 新增/调减客户赠送金额（正数=新增，负数=调减） */
export function addGiftLog(data: GiftLogPayload): Promise<ApiResponse<GiftLogResult>> {
  return post<GiftLogResult>('/api/v1/tenant-customers/gift-logs', toMultipart(data as unknown as Record<string, unknown>))
}

/** 查询赠送金额汇总列表 */
export function getGiftSummaryList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<GiftSummaryListResponse>> {
  return get<GiftSummaryListResponse>('/api/v1/tenant-customers/gift-summary/query', params as unknown as Record<string, unknown>)
}

/** 搜索赠送金额汇总列表（全局汇总按搜索结果范围统计） */
export function searchGiftSummary(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<GiftSummaryListResponse>> {
  return get<GiftSummaryListResponse>('/api/v1/tenant-customers/gift-summary/search', params as unknown as Record<string, unknown>)
}

/** 查询指定客户赠送明细列表 */
export function getGiftLogList(params: {
  customer_id: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<GiftLogListResponse>> {
  return get<GiftLogListResponse>('/api/v1/tenant-customers/gift-logs/query', params as unknown as Record<string, unknown>)
}

/** 搜索指定客户赠送明细（search_field 可传 ["start_time","end_time"]，search_value 传 {start_time,end_time} 时间范围） */
export function searchGiftLogs(params: {
  customer_id: string
  search_field?: string
  search_value?: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<GiftLogListResponse>> {
  return get<GiftLogListResponse>('/api/v1/tenant-customers/gift-logs/search', params as unknown as Record<string, unknown>)
}

/** 赠送使用明细条目 */
export interface GiftUsageItem {
  log_id: string
  bill_no: string
  biz_type: string
  record_type: string
  amount: number
  signed_amount: number
  before_amount: number
  after_amount: number
  remark?: string
  created_by: string
  created_by_name: string
  created_at: string
}

/** 赠送使用明细列表响应 */
export interface GiftUsageListResponse {
  total: number
  page: number
  page_size: number
  customer_summary: {
    customer_id: string
    customer_name: string
    gift_amount: number
    cumulative_used_gift_amount: number
    cumulative_added_gift_amount: number
  }
  items: GiftUsageItem[]
}

/** 查询指定客户赠送使用明细 */
export function getGiftUsageList(params: {
  customer_id: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<GiftUsageListResponse>> {
  return get<GiftUsageListResponse>('/api/v1/tenant-customers/gift-usage/list', params as unknown as Record<string, unknown>)
}
