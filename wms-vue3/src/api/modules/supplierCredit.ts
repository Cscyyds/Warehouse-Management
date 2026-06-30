/**
 * 模块：供应商授信余额（租客供应商接口 tenant-suppliers/credit）
 * 源接口：docs/06_采购管理_待接入接口清单.md（模块F）
 * 功能：新增/调减授信额度、查询授信余额汇总列表、搜索授信余额汇总、查询授信明细列表、搜索授信明细
 * 说明：写操作均为 multipart/form-data（addSupplierCreditLog 内部用 toMultipart）
 *   - 后端实现：tenant_purchase_management.py
 *   - 汇总列表 key 为 items（非 customers）；明细列表 key 也为 items
 *   - 汇总项金额字段为 balance_amount（非 credit_amount）；明细 amount 为绝对值，方向看 record_type
 *   - 全局汇总为 global_issued / global_used（无 remaining）
 *   - 单据前缀 SG（bill_no），手动操作 biz_type=SUPPLIER_CREDIT_MANUAL
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 供应商授信汇总项（F2/F3 返回） */
export interface SupplierCreditSummaryItem {
  supplier_id: string
  supplier_name: string
  supplier_code?: string
  contact_phone?: string | null
  balance_amount: string                 // 授信余额（credit_amount 快照，原始字符串如 "0.0000"）
  created_at?: string | null
}

/** 供应商授信汇总列表响应（F2 返回，含全局汇总） */
export interface SupplierCreditSummaryListResponse {
  total: number
  page?: number
  page_size?: number
  global_issued: number                 // 全租户授信总额
  global_used: number                   // 全租户已用授信
  items: SupplierCreditSummaryItem[]
}

/** 供应商授信汇总搜索响应（F3 返回，无全局汇总） */
export interface SupplierCreditSummarySearchResponse {
  total: number
  page?: number
  page_size?: number
  items: SupplierCreditSummaryItem[]
}

/** 供应商授信明细项（F10/F11 返回） */
export interface SupplierCreditLogItem {
  id?: number
  log_id: string
  biz_no: string
  bill_no: string                        // 与 biz_no 同值
  company_id?: string
  supplier_id: string
  biz_type: string                       // 如 SUPPLIER_CREDIT_MANUAL / PURCHASE_ORDER_AUDIT
  account_item: string                   // 固定 "CREDIT"
  record_type: string                    // ADD=增加/退回，USE=扣减
  amount: string                         // 变动金额（绝对值，2位小数）
  before_amount: string                  // 变动前余额
  after_amount: string                   // 变动后余额
  remark?: string | null
  created_by?: string | null
  created_by_name?: string | null
  created_at?: string | null
}

/** 供应商授信明细列表响应（F10/F11 返回） */
export interface SupplierCreditLogListResponse {
  total: number
  page?: number
  page_size?: number
  items: SupplierCreditLogItem[]
}

/** 新增/调减授信入参（F1） */
export interface SupplierCreditLogPayload {
  supplier_id: string
  amount: number | string                // 正数=新增，负数=调减，不能为0
  remark?: string
}

/** 新增/调减授信返回（F1） */
export interface SupplierCreditLogResult {
  log_id: string
  bill_no: string                        // SG+yyyymmdd+4位序号
  supplier_id: string
  amount: number                         // 本次变动金额（带符号）
  new_balance: number                    // 操作后授信余额
  record_type: string                    // 固定 "ADD"
  created_at?: string | null
}

/** 新增/调减供应商授信额度（正数=新增，负数=调减）
 * URL: POST /api/v1/tenant-suppliers/credit-logs
 */
export function addSupplierCreditLog(data: SupplierCreditLogPayload): Promise<ApiResponse<SupplierCreditLogResult>> {
  return post<SupplierCreditLogResult>('/api/v1/tenant-suppliers/credit-logs', toMultipart(data as unknown as Record<string, unknown>))
}

/** 查询供应商授信汇总列表
 * URL: GET /api/v1/tenant-suppliers/credit-summary/query
 */
export function getSupplierCreditSummaryList(params?: {
  page?: number
  page_size?: number
  sort_by?: string                       // 仅 credit_amount 生效
  sort_order?: string
}): Promise<ApiResponse<SupplierCreditSummaryListResponse>> {
  return get<SupplierCreditSummaryListResponse>('/api/v1/tenant-suppliers/credit-summary/query', params as unknown as Record<string, unknown>)
}

/** 搜索供应商授信汇总列表
 * URL: GET /api/v1/tenant-suppliers/credit-summary/search
 * search_field 允许：supplier_id(精确)/supplier_name(模糊)/supplier_code(模糊)
 */
export function searchSupplierCreditSummary(params: {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SupplierCreditSummarySearchResponse>> {
  return get<SupplierCreditSummarySearchResponse>('/api/v1/tenant-suppliers/credit-summary/search', params as unknown as Record<string, unknown>)
}

/** 查询供应商授信明细列表
 * URL: GET /api/v1/tenant-suppliers/credit-logs/query
 */
export function getSupplierCreditLogList(params?: {
  supplier_id?: string
  biz_type?: string
  page?: number
  page_size?: number
  sort_by?: string                       // 仅 amount 生效
  sort_order?: string
}): Promise<ApiResponse<SupplierCreditLogListResponse>> {
  return get<SupplierCreditLogListResponse>('/api/v1/tenant-suppliers/credit-logs/query', params as unknown as Record<string, unknown>)
}

/** 搜索供应商授信明细
 * URL: GET /api/v1/tenant-suppliers/credit-logs/search
 * search_field 允许：biz_no(模糊)/biz_type(精确)/record_type(精确)/remark(模糊)/created_by_name(模糊)/start_time/end_time(时间范围)
 * 时间范围：start_time/end_time 放 search_field 数组，对应值放 search_value 对象
 */
export function searchSupplierCreditLogs(params: {
  search_field: string
  search_value: string
  supplier_id?: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SupplierCreditLogListResponse>> {
  return get<SupplierCreditLogListResponse>('/api/v1/tenant-suppliers/credit-logs/search', params as unknown as Record<string, unknown>)
}
