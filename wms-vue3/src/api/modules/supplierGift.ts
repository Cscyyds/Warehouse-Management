/**
 * 模块：供应商赠送金额（租客供应商接口 tenant-suppliers/gift）
 * 源接口：docs/06_采购管理_待接入接口清单.md（模块F）
 * 功能：新增/调减赠送金额、查询赠送余额汇总列表、搜索赠送余额汇总、查询赠送明细列表、搜索赠送明细
 * 说明：写操作均为 multipart/form-data（addSupplierGiftLog 内部用 toMultipart）
 *   - 后端实现：tenant_purchase_management.py
 *   - 汇总列表 key 为 items；明细列表 key 也为 items
 *   - 汇总项金额字段为 balance_amount（对应 gift_amount 快照）；明细 amount 为绝对值，方向看 record_type
 *   - 全局汇总为 global_issued / global_used
 *   - 单据前缀 SL（bill_no），手动操作 biz_type=SUPPLIER_GIFT_MANUAL
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 供应商赠送汇总项（F5/F6 返回） */
export interface SupplierGiftSummaryItem {
  supplier_id: string
  supplier_name: string
  supplier_code?: string
  contact_phone?: string | null
  balance_amount: string                 // 赠送余额（gift_amount 快照，原始字符串如 "0.0000"）
  created_at?: string | null
}

/** 供应商赠送汇总列表响应（F5 返回，含全局汇总） */
export interface SupplierGiftSummaryListResponse {
  total: number
  page?: number
  page_size?: number
  global_issued: number                   // 全租户赠送总额
  global_used: number                     // 全租户已用赠送
  items: SupplierGiftSummaryItem[]
}

/** 供应商赠送汇总搜索响应（F6 返回，无全局汇总） */
export interface SupplierGiftSummarySearchResponse {
  total: number
  page?: number
  page_size?: number
  items: SupplierGiftSummaryItem[]
}

/** 供应商赠送明细项（F12/F13 返回） */
export interface SupplierGiftLogItem {
  id?: number
  log_id: string
  biz_no: string
  bill_no: string                          // 与 biz_no 同值
  company_id?: string
  supplier_id: string
  biz_type: string                         // 如 SUPPLIER_GIFT_MANUAL / OTHER_RECEIPT_PURCHASE_REFUND
  account_item: string                     // 固定 "GIFT"
  record_type: string                      // ADD=增加/退回，USE=扣减
  amount: string                           // 变动金额（绝对值，2位小数）
  before_amount: string                    // 变动前余额
  after_amount: string                     // 变动后余额
  remark?: string | null
  created_by?: string | null
  created_by_name?: string | null
  created_at?: string | null
}

/** 供应商赠送明细列表响应（F12/F13 返回） */
export interface SupplierGiftLogListResponse {
  total: number
  page?: number
  page_size?: number
  items: SupplierGiftLogItem[]
}

/** 新增/调减赠送入参（F4） */
export interface SupplierGiftLogPayload {
  supplier_id: string
  amount: number | string                  // 正数=新增，负数=调减，不能为0
  remark?: string
}

/** 新增/调减赠送返回（F4） */
export interface SupplierGiftLogResult {
  log_id: string
  bill_no: string                          // SL+yyyymmdd+4位序号
  supplier_id: string
  amount: number                            // 本次变动金额（带符号）
  new_balance: number                      // 操作后赠送余额
  record_type: string                      // 固定 "ADD"
  created_at?: string | null
}

/** 新增/调减供应商赠送金额（正数=新增，负数=调减）
 * URL: POST /api/v1/tenant-suppliers/gift-logs
 */
export function addSupplierGiftLog(data: SupplierGiftLogPayload): Promise<ApiResponse<SupplierGiftLogResult>> {
  return post<SupplierGiftLogResult>('/api/v1/tenant-suppliers/gift-logs', toMultipart(data as unknown as Record<string, unknown>))
}

/** 查询供应商赠送汇总列表
 * URL: GET /api/v1/tenant-suppliers/gift-summary/query
 */
export function getSupplierGiftSummaryList(params?: {
  page?: number
  page_size?: number
  sort_by?: string                         // 仅 gift_amount 生效
  sort_order?: string
}): Promise<ApiResponse<SupplierGiftSummaryListResponse>> {
  return get<SupplierGiftSummaryListResponse>('/api/v1/tenant-suppliers/gift-summary/query', params as unknown as Record<string, unknown>)
}

/** 搜索供应商赠送汇总列表
 * URL: GET /api/v1/tenant-suppliers/gift-summary/search
 * search_field 允许：supplier_id(精确)/supplier_name(模糊)/supplier_code(模糊)
 */
export function searchSupplierGiftSummary(params: {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SupplierGiftSummarySearchResponse>> {
  return get<SupplierGiftSummarySearchResponse>('/api/v1/tenant-suppliers/gift-summary/search', params as unknown as Record<string, unknown>)
}

/** 查询供应商赠送明细列表
 * URL: GET /api/v1/tenant-suppliers/gift-logs/query
 */
export function getSupplierGiftLogList(params?: {
  supplier_id?: string
  biz_type?: string
  page?: number
  page_size?: number
  sort_by?: string                         // 仅 amount 生效
  sort_order?: string
}): Promise<ApiResponse<SupplierGiftLogListResponse>> {
  return get<SupplierGiftLogListResponse>('/api/v1/tenant-suppliers/gift-logs/query', params as unknown as Record<string, unknown>)
}

/** 搜索供应商赠送明细
 * URL: GET /api/v1/tenant-suppliers/gift-logs/search
 * search_field 允许：biz_no(模糊)/biz_type(精确)/record_type(精确)/remark(模糊)/created_by_name(模糊)/start_time/end_time(时间范围)
 * 时间范围：start_time/end_time 放 search_field 数组，对应值放 search_value 对象
 */
export function searchSupplierGiftLogs(params: {
  search_field: string
  search_value: string
  supplier_id?: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SupplierGiftLogListResponse>> {
  return get<SupplierGiftLogListResponse>('/api/v1/tenant-suppliers/gift-logs/search', params as unknown as Record<string, unknown>)
}
