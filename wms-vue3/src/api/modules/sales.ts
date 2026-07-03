/**
 * 模块：销售订单管理
 * 源接口：07_租客员工_销售订单.md
 * 范围：销售订单主单+明细完整生命周期（16个接口）
 *
 * 后端契约：
 *   - 列表/搜索返回 key 为 sales_orders
 *   - 明细列表/搜索返回 key 为 items
 *   - 详情返回裸对象含 items[]
 *   - 枚举字段返回双份：中文显示名 + 标准值（*_value）
 *   - settlement_method 标准值：CASH/MONTHLY/CREDIT/PREPAYMENT
 *   - audit_status：0=未审核 1=审核通过 2=已反审核 3=审核失败
 *   - warehouse_status：0=未发送 1=已发送 2=退回 3=已出库（虚拟）
 *   - 创建/更新/审核等写操作为 multipart/form-data
 *   - 金额字段返回为字符串（2或4位小数）
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

// ==================== 类型定义 ====================

/** 审核状态：0=未审核 1=审核通过 2=已反审核 3=审核失败 */
export type SalesAuditStatus = 0 | 1 | 2 | 3

/** 仓库状态：0=未发送 1=已发送 2=退回 3=已出库（虚拟） */
export type SalesWarehouseStatus = 0 | 1 | 2 | 3

/** 结算方式标准值 */
export type SettlementMethod = 'CASH' | 'MONTHLY' | 'CREDIT' | 'PREPAYMENT'

/** 销售订单明细项（详情/列表中返回） */
export interface SalesOrderItemV2 {
  sales_order_item_id: string
  item_no: string
  sales_order_id?: string
  product_id: string
  product_code: string
  product_name: string
  category_name?: string
  specification?: string | null
  color?: string | null
  unit_id?: string
  unit_name?: string
  sale_price?: string
  last_sale_price?: string | null
  discount_rate?: string
  discount_price: string
  qty: string
  line_sales_amount: string
  use_gift_amount?: string
  tax_rate: string
  tax_amount: string
  line_receivable_amount: string
  warehouse_task_status?: number
  line_remark?: string | null
  deleted_flag?: number
  created_by?: string
  created_by_name?: string
  updated_by?: string
  updated_by_name?: string
  created_at?: string
  updated_at?: string
}

/** 销售订单列表项（接口7/10 返回，无明细） */
export interface SalesOrderListItemV2 {
  sales_order_id: string
  sales_order_no: string
  bill_type: string
  bill_type_value: string
  settlement_method: string
  settlement_method_value: SettlementMethod
  customer_id: string
  customer_name: string
  city?: string | null
  receive_address?: string | null
  settlement_bank_id?: string | null
  settlement_bank_name?: string | null
  delivery_method?: string | null
  delivery_method_value?: string | null
  carrier_company_id?: string | null
  carrier_company_name?: string | null
  outbound_date?: string | null
  total_sales_amount: string
  receivable_amount: string
  use_prepayment_amount: string
  use_gift_amount: string
  rounding_amount: string
  total_tax_amount: string
  customer_remark?: string | null
  audit_status: SalesAuditStatus
  warehouse_status: SalesWarehouseStatus
  warehouse_status_name?: string
  send_by?: string | null
  send_by_name?: string | null
  send_at?: string | null
  can_cancel_send?: boolean
  return_remark?: string | null
  return_at?: string | null
  return_by?: string | null
  return_by_name?: string | null
  deleted_flag?: number
  created_at?: string
  created_by?: string
  created_by_name?: string
  updated_by?: string
  updated_by_name?: string
}

/** 销售订单详情（接口8，含明细列表） */
export interface SalesOrderDetailV2 extends SalesOrderListItemV2 {
  items: SalesOrderItemV2[]
}

/** 列表/搜索响应（key 为 sales_orders） */
export interface SalesOrderListResponse {
  total: number
  page: number
  page_size: number
  sales_orders: SalesOrderListItemV2[]
}

/** 明细列表/搜索响应（key 为 items） */
export interface SalesOrderItemListResponse {
  total: number
  page: number
  page_size: number
  items: SalesOrderItemV2[]
}

/** 明细搜索返回项（含主单关联信息） */
export interface SalesOrderItemSearchResult extends SalesOrderItemV2 {
  sales_order_no?: string
  customer_name?: string
  settlement_method?: string
  settlement_method_value?: string
}

/** 审核预检返回 */
export interface SalesAuditPreview {
  has_gift_overflow: boolean
  gift_overflow_amount: string
  requested_gift_amount: string
  actual_gift_amount: string
  has_prepayment_overflow: boolean
  prepayment_overflow_amount: string
  requested_prepayment_amount: string
  actual_prepayment_amount: string
  balance_sufficient: boolean
  current_balance: string
  required_amount: string
}

/** 列表查询参数（接口7） */
export interface SalesOrderQueryParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}

/** 搜索参数（接口10/11） */
export interface SalesOrderSearchParams {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}

/** 创建销售订单主单入参（接口1） */
export interface SalesOrderCreatePayload {
  bill_type: string
  settlement_method: string
  customer_id: string
  items: string
  city?: string
  receive_address?: string
  settlement_bank_id?: string
  delivery_method?: string
  carrier_company_id?: string
  outbound_date?: string
  rounding_amount?: string | number
  use_prepayment_amount?: string | number
  use_gift_amount?: string | number
  customer_remark?: string
}

/** 更改主单入参（接口3） */
export interface SalesOrderUpdatePayload {
  sales_order_id: string
  city?: string
  receive_address?: string
  settlement_bank_id?: string
  delivery_method?: string
  carrier_company_id?: string
  outbound_date?: string
  use_prepayment_amount?: string | number
  use_gift_amount?: string | number
  rounding_amount?: string | number
  customer_remark?: string
}

// ==================== 接口实现 ====================

const BASE = '/api/v1/tenant-sales-orders'

// --- 接口1：创建销售订单 ---
export function createSalesOrderV2(
  data: SalesOrderCreatePayload
): Promise<ApiResponse<SalesOrderDetailV2>> {
  return post<SalesOrderDetailV2>(`${BASE}/create`, toMultipart(data as unknown as Record<string, unknown>))
}

// --- 接口2：追加销售订单明细 ---
export function addSalesOrderItems(
  salesOrderId: string,
  items: Array<{ product_id: string; qty: number | string; discount_price: number | string; tax_rate?: number | string; line_remark?: string }>
): Promise<ApiResponse<SalesOrderDetailV2>> {
  const payload = { sales_order_id: salesOrderId, items: JSON.stringify(items) }
  return post<SalesOrderDetailV2>(`${BASE}/items/create`, toMultipart(payload))
}

// --- 接口3：更改销售订单主单 ---
export function updateSalesOrderV2(
  data: SalesOrderUpdatePayload
): Promise<ApiResponse<SalesOrderDetailV2>> {
  return post<SalesOrderDetailV2>(`${BASE}/update`, toMultipart(data as unknown as Record<string, unknown>))
}

// --- 接口4：更改销售订单明细（批量） ---
export function updateSalesOrderItems(
  salesOrderId: string,
  items: Array<{ sales_order_item_id: string; discount_price?: string | number; qty?: number | string; tax_rate?: string | number; line_remark?: string }>
): Promise<ApiResponse<SalesOrderDetailV2>> {
  const payload = { sales_order_id: salesOrderId, items: JSON.stringify(items) }
  return post<SalesOrderDetailV2>(`${BASE}/items/update`, toMultipart(payload))
}

// --- 接口5：删除销售订单 ---
export function deleteSalesOrderV2(salesOrderId: string): Promise<ApiResponse<{ sales_order_id: string }>> {
  return post<{ sales_order_id: string }>(`${BASE}/delete`, toMultipart({ sales_order_id: salesOrderId }))
}

// --- 接口6：删除销售订单明细 ---
export function deleteSalesOrderItem(salesOrderItemId: string): Promise<ApiResponse<{ sales_order_item_id: string }>> {
  return post<{ sales_order_item_id: string }>(`${BASE}/items/delete`, toMultipart({ sales_order_item_id: salesOrderItemId }))
}

// --- 接口7：销售订单列表查询 ---
export function getSalesOrderListV2(params?: SalesOrderQueryParams): Promise<ApiResponse<SalesOrderListResponse>> {
  return get<SalesOrderListResponse>(`${BASE}/list`, params as unknown as Record<string, unknown>)
}

// --- 接口8：销售订单详情 ---
export function getSalesOrderDetailV2(salesOrderId: string): Promise<ApiResponse<SalesOrderDetailV2>> {
  return get<SalesOrderDetailV2>(`${BASE}/detail`, { sales_order_id: salesOrderId })
}

// --- 接口9：销售订单明细列表 ---
export function getSalesOrderItemList(
  salesOrderId: string,
  params?: { page?: number; sort_by?: string; sort_order?: string }
): Promise<ApiResponse<SalesOrderItemListResponse>> {
  return get<SalesOrderItemListResponse>(`${BASE}/items/list`, { sales_order_id: salesOrderId, ...params } as unknown as Record<string, unknown>)
}

// --- 接口10：销售订单搜索 ---
export function searchSalesOrdersV2(params: SalesOrderSearchParams): Promise<ApiResponse<SalesOrderListResponse>> {
  return get<SalesOrderListResponse>(`${BASE}/search`, params as unknown as Record<string, unknown>)
}

// --- 接口11：销售订单明细搜索 ---
export function searchSalesOrderItems(params: SalesOrderSearchParams): Promise<ApiResponse<SalesOrderItemListResponse>> {
  return get<SalesOrderItemListResponse>(`${BASE}/items/search`, params as unknown as Record<string, unknown>)
}

// --- 接口12：销售订单审核（批量，四态） ---
export function auditSalesOrderV2(
  salesOrderId: string | string[],
  auditStatus: SalesAuditStatus
): Promise<ApiResponse<{ updated_count: number; sales_order_ids: string[]; audit_status: number }>> {
  const idValue = Array.isArray(salesOrderId) ? JSON.stringify(salesOrderId) : salesOrderId
  return post<{ updated_count: number; sales_order_ids: string[]; audit_status: number }>(
    `${BASE}/audit`,
    toMultipart({ sales_order_id: idValue, audit_status: String(auditStatus) })
  )
}

// --- 接口13：销售订单审核预检 ---
export function getSalesAuditPreview(salesOrderId: string): Promise<ApiResponse<SalesAuditPreview>> {
  return get<SalesAuditPreview>(`${BASE}/audit/preview`, { sales_order_id: salesOrderId })
}

// --- 接口14：发送仓库（批量） ---
export function sendSalesOrderToWarehouseV2(
  salesOrderIds: string[]
): Promise<ApiResponse<{ updated_count: number; sales_order_ids: string[]; warehouse_status: number }>> {
  return post<{ updated_count: number; sales_order_ids: string[]; warehouse_status: number }>(
    `${BASE}/warehouse/status/update`,
    toMultipart({ sales_order_ids: JSON.stringify(salesOrderIds), warehouse_status: '1' })
  )
}

// --- 接口15：仓库退回（单个） ---
export function warehouseReturnSalesOrderV2(
  salesOrderId: string,
  returnRemark: string
): Promise<ApiResponse<{ sales_order_id: string; sales_order_no: string; warehouse_status: number; return_remark: string }>> {
  return post<{ sales_order_id: string; sales_order_no: string; warehouse_status: number; return_remark: string }>(
    `${BASE}/warehouse/return`,
    toMultipart({ sales_order_id: salesOrderId, return_remark: returnRemark })
  )
}

// --- 接口16：撤销发送仓库（批量） ---
export function cancelSendSalesOrderV2(
  salesOrderIds: string[]
): Promise<ApiResponse<{ updated_count: number; sales_order_ids: string[] }>> {
  return post<{ updated_count: number; sales_order_ids: string[] }>(
    `${BASE}/warehouse/cancel-send`,
    toMultipart({ sales_order_ids: JSON.stringify(salesOrderIds) })
  )
}
