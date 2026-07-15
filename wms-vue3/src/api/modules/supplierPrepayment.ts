/**
 * 模块：供应商预付款余额（租客供应商接口 tenant-suppliers/prepayment）
 * 源接口：docs/06_租客员工_采购管理.md（模块F：F8/F9/F14/F15）
 * 功能：查询预付款余额汇总列表/搜索、查询预付款明细列表/搜索
 * 说明：仅查询接口，无手动新增/调减（F7 不存在）
 *   - 后端实现：tenant_purchase_management.py
 *   - 汇总列表 key 为 items；明细列表 key 也为 items
 *   - 汇总项金额字段为 prepayment_amount（非 balance_amount，F8/F9 用内联序列化）
 *   - 明细 amount 为绝对值，方向看 record_type
 *   - 全局汇总为 global_remaining/cumulative_used/cumulative_added_prepayment_amount
 *   - 预付款余额只能通过预付款单据或采购单审核流程间接变动
 */
import { get } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 供应商预付款汇总项（F8/F9 返回）
 *  ⚠️ 后端 F8/F9 使用内联序列化，非 _serialize_supplier_balance_summary
 *  字段名与授信/赠送汇总不同：用 prepayment_amount 而非 balance_amount
 */
export interface SupplierPrepaymentSummaryItem {
  supplier_id: string
  supplier_name: string
  area_id?: string | null
  area_name?: string | null
  is_monthly_settlement: number         // 0否 1是
  monthly_days: number                  // 月结天数
  settlement_day: number                // 结算日
  prepayment_amount: string             // 预付款余额（字符串，4位小数）
}

/** 供应商预付款汇总列表响应（F8 返回，含全局汇总） */
export interface SupplierPrepaymentSummaryListResponse {
  total: number
  page: number
  page_size: number
  global_remaining_prepayment_amount: string         // 全租户预付款余额合计
  global_cumulative_used_prepayment_amount: string   // 全租户累计已用预付款
  global_cumulative_added_prepayment_amount: string  // 全租户累计新增预付款
  items: SupplierPrepaymentSummaryItem[]
}

/** 供应商预付款汇总搜索响应（F9 返回，含全局汇总——与 F8 结构一致） */
export interface SupplierPrepaymentSummarySearchResponse {
  total: number
  page: number
  page_size: number
  global_remaining_prepayment_amount: string
  global_cumulative_used_prepayment_amount: string
  global_cumulative_added_prepayment_amount: string
  items: SupplierPrepaymentSummaryItem[]
}

/** 供应商预付款明细项（F14/F15 返回，结构同授信/赠送明细） */
export interface SupplierPrepaymentLogItem {
  id?: number
  log_id: string
  biz_no: string
  bill_no: string                          // 与 biz_no 同值
  company_id?: string
  supplier_id: string
  biz_type: string                         // 如 PURCHASE_ORDER_AUDIT / PREPAYMENT_ORDER_CREATE / PREPAYMENT_ORDER_VOID
  account_item: string                     // 固定 "PREPAYMENT"
  record_type: string                      // ADD=增加/退回，USE=扣减
  amount: string                           // 变动金额（绝对值，2位小数）
  before_amount: string                    // 变动前余额
  after_amount: string                     // 变动后余额
  remark?: string | null
  created_by?: string | null
  created_by_name?: string | null
  created_at?: string | null
}

/** 供应商预付款明细列表响应（F14/F15 返回） */
export interface SupplierPrepaymentLogListResponse {
  total: number
  page?: number
  page_size?: number
  items: SupplierPrepaymentLogItem[]
}

/** 查询供应商预付款汇总列表（F8）
 * URL: GET /api/v1/tenant-suppliers/prepayment-summary/query
 * sort_by 支持：supplier_name / prepayment_amount / remaining_prepayment_amount
 */
export function getSupplierPrepaymentSummaryList(params?: {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SupplierPrepaymentSummaryListResponse>> {
  return get<SupplierPrepaymentSummaryListResponse>('/api/v1/tenant-suppliers/prepayment-summary/query', params as unknown as Record<string, unknown>)
}

/** 搜索供应商预付款汇总列表（F9）
 * URL: GET /api/v1/tenant-suppliers/prepayment-summary/search
 * search_field 允许：supplier_id(精确)/supplier_name(模糊)/supplier_code(模糊)
 */
export function searchSupplierPrepaymentSummary(params: {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SupplierPrepaymentSummarySearchResponse>> {
  return get<SupplierPrepaymentSummarySearchResponse>('/api/v1/tenant-suppliers/prepayment-summary/search', params as unknown as Record<string, unknown>)
}

/** 查询供应商预付款明细列表（F14）
 * URL: GET /api/v1/tenant-suppliers/prepayment-logs/query
 */
export function getSupplierPrepaymentLogList(params?: {
  supplier_id?: string
  biz_type?: string
  page?: number
  page_size?: number
  sort_by?: string                         // 仅 amount 生效
  sort_order?: string
}): Promise<ApiResponse<SupplierPrepaymentLogListResponse>> {
  return get<SupplierPrepaymentLogListResponse>('/api/v1/tenant-suppliers/prepayment-logs/query', params as unknown as Record<string, unknown>)
}

/** 搜索供应商预付款明细（F15）
 * URL: GET /api/v1/tenant-suppliers/prepayment-logs/search
 * search_field 允许：biz_no(模糊)/biz_type(精确)/record_type(精确)/remark(模糊)/created_by_name(模糊)/start_time/end_time(时间范围)
 * 时间范围：start_time/end_time 放 search_field 数组，对应值放 search_value 对象
 */
export function searchSupplierPrepaymentLogs(params: {
  search_field: string
  search_value: string
  supplier_id?: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SupplierPrepaymentLogListResponse>> {
  return get<SupplierPrepaymentLogListResponse>('/api/v1/tenant-suppliers/prepayment-logs/search', params as unknown as Record<string, unknown>)
}
