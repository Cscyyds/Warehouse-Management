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

// ==================== 可销售产品查询（接口0a/0b） ====================

/** 可销售产品项（接口0a/0b 返回，available_stock 已扣减采购退货预占量） */
export interface AvailableProductItem {
  product_id: string
  product_code: string
  product_name: string
  product_type: string
  category_id: string
  category_name: string
  specification: string
  color: string
  unit_id: string
  unit_name: string
  min_sale_price: string
  sale_price: string               // 当前客户专属售价（未匹配则为最低售价）
  available_stock: string           // 已扣减采购退货预占量的真实可用库存
  is_combined: number               // 0否 1是
  product_status: string            // 固定 ON_SALE
  remark?: string | null
}

/** 可销售产品列表响应 */
export interface AvailableProductListResponse {
  total: number
  page: number
  page_size: number
  items: AvailableProductItem[]
}

/** 查询可销售产品列表（接口0a） */
export function getAvailableProducts(params?: {
  customer_id?: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<AvailableProductListResponse>> {
  return get<AvailableProductListResponse>(`${BASE}/available-products/list`, params as unknown as Record<string, unknown>)
}

/** 搜索可销售产品（接口0b） */
export function searchAvailableProducts(params: {
  search_field: string
  search_value: string
  customer_id?: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<AvailableProductListResponse>> {
  return get<AvailableProductListResponse>(`${BASE}/available-products/search`, params as unknown as Record<string, unknown>)
}

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
  prepayment_ratio?: number         // 预付款比例（0-100），仅PREPAYMENT时返回实际值
  prepayment_amount?: string        // 应支付预付款金额，仅PREPAYMENT时返回实际值
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

/** 审核预检返回（已与采购预检对齐，后端移除了 balance_sufficient/current_balance/required_amount） */
export interface SalesAuditPreview {
  has_gift_overflow: boolean
  gift_overflow_amount: string
  requested_gift_amount: string
  actual_gift_amount: string
  has_prepayment_overflow: boolean
  prepayment_overflow_amount: string
  requested_prepayment_amount: string
  actual_prepayment_amount: string
}

/** 列表查询参数（接口7） */
export interface SalesOrderQueryParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
  audit_status?: number
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
  prepayment_ratio?: number
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
  prepayment_ratio?: number          // 预付款比例（0-100整数），仅PREPAYMENT方式有效
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

// --- 接口13：销售订单审核预检（批量） ---
export function getSalesAuditPreview(salesOrderIds: string[]): Promise<ApiResponse<{ items: SalesAuditPreview[] }>> {
  return get<{ items: SalesAuditPreview[] }>(`${BASE}/audit/preview`, { sales_order_ids: JSON.stringify(salesOrderIds) })
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

// ==================== 销售退货 ====================

const RETURN_BASE = '/api/v1/tenant-sales-returns'

export type SalesReturnMethod = 'RETURN_AND_REFUND' | 'RETURN_ONLY' | 'REFUND_ONLY'

export interface SalesReturnListItem {
  sales_return_id: string
  return_no: string
  customer_id: string
  customer_name: string
  sales_order_id: string | null
  sales_order_no: string | null
  return_date: string | null
  return_method: SalesReturnMethod
  return_method_display?: string
  return_amount: string
  audit_status: number
  warehouse_status: number
  send_by?: string
  send_by_name?: string
  send_at?: string
  is_refund_gift_amount: number
  refund_gift_amount: string
  is_refund_prepayment_amount: number
  refund_prepayment_amount: string
  remark?: string
  created_at?: string
  created_by_name?: string
}

export interface SalesReturnLineItem {
  sales_return_item_id?: string
  sales_return_id?: string
  sales_order_item_id?: string
  product_id?: string
  product_code?: string
  product_name?: string
  specification?: string
  color?: string
  unit_id?: string
  unit_name?: string
  sale_price?: string
  return_price: string | number
  return_qty: string | number
  return_amount?: string
  in_stock_qty?: string
  actual_in_stock_qty?: string
  deducted_out_qty?: string
  warehouse_task_status?: number
  product_status?: string
  remark?: string
}

export interface SalesReturnDetail extends SalesReturnListItem {
  items: SalesReturnLineItem[]
  images?: string[]
  attachments?: Array<{ name: string; url: string }>
}

export interface AvailableSalesOrderItem {
  sales_order_item_id: string
  sales_order_id: string
  sales_order_no?: string
  product_id: string
  product_code: string
  product_name: string
  specification?: string
  color?: string
  unit_id?: string
  unit_name?: string
  discount_price: string
  qty: string
  actual_out_qty: string
  returned_qty: string
  pending_out_qty: string
  pending_return_qty: string
  remaining: string
}

export interface AvailableSalesOrderGroup {
  sales_order_id: string
  order_no: string
  settlement_method: string
  receivable_amount: string
  pending_receivable_amount: string
  received_amount: string
  children: AvailableSalesOrderItem[]
}

export interface SalesReturnCreatePayload {
  customer_id: string
  return_method: string
  items: string
  has_sales_record?: string
  sales_order_id?: string
  return_date?: string
  inbound_date?: string
  is_refund_gift_amount?: string
  refund_gift_amount?: string
  is_refund_prepayment_amount?: string
  refund_prepayment_amount?: string
  remark?: string
}

export interface SalesReturnUpdatePayload {
  sales_return_id: string
  return_method?: string
  return_date?: string
  inbound_date?: string
  is_refund_gift_amount?: string
  refund_gift_amount?: string
  is_refund_prepayment_amount?: string
  refund_prepayment_amount?: string
  remark?: string
}

// SR1：列表
export function getSalesReturnListV2(params?: {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<{ total: number; page: number; page_size: number; sales_returns: SalesReturnListItem[] }>> {
  return get(`${RETURN_BASE}/list`, params as Record<string, unknown>)
}

// SR2：搜索
export function searchSalesReturnsV2(params: {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<{ total: number; page: number; page_size: number; sales_returns: SalesReturnListItem[] }>> {
  return get(`${RETURN_BASE}/search`, params as Record<string, unknown>)
}

// SR3：详情
export function getSalesReturnDetailV2(salesReturnId: string): Promise<ApiResponse<SalesReturnDetail>> {
  return get<SalesReturnDetail>(`${RETURN_BASE}/detail`, { sales_return_id: salesReturnId })
}

// SR4：创建
export function createSalesReturnV2(data: SalesReturnCreatePayload, files?: { images?: File[]; attachments?: File[] }): Promise<ApiResponse<{ sales_return_id: string; return_no: string }>> {
  const form = toMultipart(data as unknown as Record<string, string>)
  if (files?.images) files.images.forEach(f => form.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => form.append('attachments', f))
  return post(`${RETURN_BASE}/create`, form)
}

// SR5：更新
export function updateSalesReturnV2(data: SalesReturnUpdatePayload, files?: { images?: File[]; attachments?: File[] }): Promise<ApiResponse<unknown>> {
  const form = toMultipart(data as unknown as Record<string, string>)
  if (files?.images) files.images.forEach(f => form.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => form.append('attachments', f))
  return post(`${RETURN_BASE}/update`, form)
}

// SR6：删除
export function deleteSalesReturnV2(salesReturnId: string): Promise<ApiResponse<unknown>> {
  return post(`${RETURN_BASE}/delete`, toMultipart({ sales_return_id: salesReturnId }))
}

// SR7：审核
export function auditSalesReturnV2(salesReturnId: string | string[], auditStatus: number): Promise<ApiResponse<unknown>> {
  const idValue = Array.isArray(salesReturnId) ? JSON.stringify(salesReturnId) : salesReturnId
  return post(`${RETURN_BASE}/audit`, toMultipart({ sales_return_id: idValue, audit_status: String(auditStatus) }))
}

// SR8：发送仓库
export function sendSalesReturnToWarehouseV2(salesReturnIds: string[]): Promise<ApiResponse<unknown>> {
  return post(`${RETURN_BASE}/warehouse/status/update`, toMultipart({ sales_return_ids: JSON.stringify(salesReturnIds), warehouse_status: '1' }))
}

// SR9：新增明细
export function addSalesReturnItems(salesReturnId: string, items: Array<Partial<SalesReturnLineItem>>): Promise<ApiResponse<unknown>> {
  return post(`${RETURN_BASE}/items/create`, toMultipart({ sales_return_id: salesReturnId, items: JSON.stringify(items) }))
}

// SR10：修改明细
export function updateSalesReturnItems(salesReturnId: string, items: Array<Partial<SalesReturnLineItem> & { sales_return_item_id: string }>): Promise<ApiResponse<unknown>> {
  return post(`${RETURN_BASE}/items/update`, toMultipart({ sales_return_id: salesReturnId, items: JSON.stringify(items) }))
}

// SR11：删除明细
export function deleteSalesReturnItem(salesReturnItemId: string): Promise<ApiResponse<unknown>> {
  return post(`${RETURN_BASE}/items/delete`, toMultipart({ sales_return_item_id: salesReturnItemId }))
}

// 可退明细列表
export function getAvailableSalesOrderItems(params: {
  customer_id: string
  page?: number
  page_size?: number
}): Promise<ApiResponse<{ total: number; page: number; page_size: number; items: AvailableSalesOrderGroup[] }>> {
  return get(`${RETURN_BASE}/available-order-items`, params as Record<string, unknown>)
}

// 可退明细搜索
export function searchAvailableSalesOrderItems(params: {
  customer_id: string
  search_field: string
  search_value: string
  page?: number
  page_size?: number
}): Promise<ApiResponse<{ total: number; page: number; page_size: number; items: AvailableSalesOrderItem[] }>> {
  return get(`${RETURN_BASE}/available-order-items/search`, params as Record<string, unknown>)
}

// 冲减预计算
export function calculateSalesReturnDeduction(params: {
  sales_order_item_id: string
  return_qty: string
}): Promise<ApiResponse<{ return_qty: string; from_shipped: string; deduct_out: string }>> {
  return get(`${RETURN_BASE}/calculate-deduction`, params as Record<string, unknown>)
}

// ==================== 销售对账单 ====================

const RECON_BASE = '/api/v1/tenant-sales-reconciliation'

export interface SalesReconciliationOrderDetail {
  sales_order_id: string
  sales_order_no: string
  receivable_amount: string
}

export interface SalesReconciliationReturnDetail {
  sales_return_id: string
  return_no: string
  return_amount: string
}

export interface SalesReconciliationItem {
  reconciliation_id: string
  reconciliation_no: string
  customer_id: string
  customer_name: string
  reconciliation_date: string
  reconciliation_month: string
  discount_rate: string
  deduction_amount: string
  reconciliation_amount: string
  discount_amount: string
  receivable_amount: string
  sales_orders: SalesReconciliationOrderDetail[]
  sales_returns: SalesReconciliationReturnDetail[]
  remark?: string | null
  audit_status?: number
  created_at?: string | null
  created_by_name?: string | null
}

export interface SalesReconciliationListResponse {
  total: number
  page: number
  page_size: number
  items: SalesReconciliationItem[]
}

export function createSalesReconciliation(data: {
  customer_id: string
  reconciliation_date: string
  sales_order_ids: string[]
  discount_rate?: number | string
  deduction_amount?: number | string
  remark?: string
  sales_return_ids?: string[]
}): Promise<ApiResponse<SalesReconciliationItem>> {
  const payload: Record<string, unknown> = {
    customer_id: data.customer_id,
    reconciliation_date: data.reconciliation_date,
    sales_order_ids: JSON.stringify(data.sales_order_ids),
  }
  if (data.discount_rate !== undefined) payload.discount_rate = String(data.discount_rate)
  if (data.deduction_amount !== undefined) payload.deduction_amount = String(data.deduction_amount)
  if (data.remark) payload.remark = data.remark
  if (data.sales_return_ids && data.sales_return_ids.length > 0) {
    payload.sales_return_ids = JSON.stringify(data.sales_return_ids)
  }
  return post<SalesReconciliationItem>(`${RECON_BASE}/create`, toMultipart(payload))
}

export function getSalesReconciliationList(params?: {
  customer_id?: string
  reconciliation_month?: string
  audit_status?: number
  page?: number
  page_size?: number
}): Promise<ApiResponse<SalesReconciliationListResponse>> {
  return get<SalesReconciliationListResponse>(`${RECON_BASE}/list`, params as unknown as Record<string, unknown>)
}

export function getSalesReconciliationDetail(reconciliation_id: string): Promise<ApiResponse<SalesReconciliationItem>> {
  return get<SalesReconciliationItem>(`${RECON_BASE}/detail`, { reconciliation_id })
}

export function addSalesReconciliationOrders(reconciliation_id: string, sales_order_ids: string[]): Promise<ApiResponse<SalesReconciliationItem>> {
  return post<SalesReconciliationItem>(`${RECON_BASE}/add-sales-orders`, toMultipart({
    reconciliation_id,
    sales_order_ids: JSON.stringify(sales_order_ids),
  }))
}

export function addSalesReconciliationReturns(reconciliation_id: string, sales_return_ids: string[]): Promise<ApiResponse<SalesReconciliationItem>> {
  return post<SalesReconciliationItem>(`${RECON_BASE}/add-sales-returns`, toMultipart({
    reconciliation_id,
    sales_return_ids: JSON.stringify(sales_return_ids),
  }))
}

// ==================== 销售汇总报表 ====================

/** 产品销售汇总项（接口17） */
export interface ProductSalesSummaryItem {
  product_id: string
  product_code: string
  product_name: string
  category_id: string
  category_name: string
  specification: string
  unit_name: string
  color: string
  supplier_name: string
  actual_sales_qty: string
  available_stock: string
  buyer_count: number
  actual_sales_amount: string
  actual_cost_amount: string
  actual_profit_amount: string
  gross_margin_rate: string
  sales_share: string
  cost_share: string
  profit_share: string
}

/** 产品下客户销售项（接口19） */
export interface ProductCustomerSalesItem {
  customer_id: string
  customer_name: string
  actual_sales_qty: string
  actual_sales_amount: string
}

/** 客户销售汇总项（接口21） */
export interface CustomerSalesSummaryItem {
  customer_id: string
  customer_name: string
  customer_type_name: string
  actual_sales_amount: string
  total_prepayment_amount: string
  total_gift_amount: string
  total_rounding_amount: string
  total_receivable_amount: string
  follower_user_id: string
  follower_user_name: string
  salesman_user_id: string
  salesman_user_name: string
}

/** 客户实际销售详情项-按产品聚合（接口23） */
export interface CustomerSalesDetailItem {
  customer_id: string
  customer_name: string
  product_id: string
  product_code: string
  product_name: string
  category_name: string
  specification: string
  color: string
  unit_name: string
  actual_sales_qty: string
  actual_sales_amount: string
}

/** 客户销售明细项-订单行级（接口24） */
export interface CustomerSalesLineItem {
  sales_order_item_id: string
  sales_order_no: string
  customer_id: string
  customer_name: string
  product_id: string
  product_code: string
  product_name: string
  category_name: string
  specification: string
  unit_name: string
  color: string
  sale_price: string
  discount_rate: string
  discount_price: string
  actual_sales_qty: string
  actual_sales_amount: string
  tax_rate: string
  tax_amount: string
  unit_discount: string
  total_discount: string
  use_gift: number
  use_gift_amount: string
  line_receivable_amount: string
  outbound_date: string
  created_by: string
  created_by_name: string
  salesman_user_id: string
  salesman_user_name: string
}

/** 通用分页响应（汇总报表） */
export interface SummaryListResponse<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}

// --- 接口17：产品销售汇总列表 ---
export function getProductSalesSummary(params?: {
  page?: number
  sort_by?: string
  sort_order?: string
  product_code?: string
  product_name?: string
  category_id?: string
  color?: string
}): Promise<ApiResponse<SummaryListResponse<ProductSalesSummaryItem>>> {
  return get<SummaryListResponse<ProductSalesSummaryItem>>(`${BASE}/product-sales-summary`, params as Record<string, unknown>)
}

// --- 接口18：搜索产品销售汇总 ---
export function searchProductSalesSummary(params: SalesOrderSearchParams): Promise<ApiResponse<SummaryListResponse<ProductSalesSummaryItem>>> {
  return get<SummaryListResponse<ProductSalesSummaryItem>>(`${BASE}/product-sales-summary/search`, params as unknown as Record<string, unknown>)
}

// --- 接口19：指定产品下客户销售情况 ---
export function getProductCustomerSales(params: {
  product_id: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SummaryListResponse<ProductCustomerSalesItem>>> {
  return get<SummaryListResponse<ProductCustomerSalesItem>>(`${BASE}/product-sales-summary/customers`, params as Record<string, unknown>)
}

// --- 接口20：搜索指定产品下客户销售情况 ---
export function searchProductCustomerSales(params: {
  product_id: string
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SummaryListResponse<ProductCustomerSalesItem>>> {
  return get<SummaryListResponse<ProductCustomerSalesItem>>(`${BASE}/product-sales-summary/customers/search`, params as Record<string, unknown>)
}

// --- 接口21：客户销售汇总列表 ---
export function getCustomerSalesSummary(params?: {
  page?: number
  sort_by?: string
  sort_order?: string
  customer_name?: string
  customer_id?: string
  customer_type_id?: string
  follower_user_id?: string
  salesman_user_id?: string
}): Promise<ApiResponse<SummaryListResponse<CustomerSalesSummaryItem>>> {
  return get<SummaryListResponse<CustomerSalesSummaryItem>>(`${BASE}/customer-sales-summary`, params as Record<string, unknown>)
}

// --- 接口22：搜索客户销售汇总 ---
export function searchCustomerSalesSummary(params: SalesOrderSearchParams): Promise<ApiResponse<SummaryListResponse<CustomerSalesSummaryItem>>> {
  return get<SummaryListResponse<CustomerSalesSummaryItem>>(`${BASE}/customer-sales-summary/search`, params as unknown as Record<string, unknown>)
}

// --- 接口23：客户实际销售详情（按产品聚合） ---
export function getCustomerSalesDetail(params: {
  customer_id: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SummaryListResponse<CustomerSalesDetailItem>>> {
  return get<SummaryListResponse<CustomerSalesDetailItem>>(`${BASE}/customer-sales-detail`, params as Record<string, unknown>)
}

// --- 接口24：客户销售明细（订单行级） ---
export function getCustomerSalesItems(params: {
  customer_id: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SummaryListResponse<CustomerSalesLineItem>>> {
  return get<SummaryListResponse<CustomerSalesLineItem>>(`${BASE}/customer-sales-items`, params as Record<string, unknown>)
}

// --- 接口25：客户销售详情与明细配套搜索 ---
export function searchCustomerSales(params: {
  query_type: 'detail' | 'items'
  customer_id: string
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SummaryListResponse<CustomerSalesDetailItem | CustomerSalesLineItem>>> {
  return get<SummaryListResponse<CustomerSalesDetailItem | CustomerSalesLineItem>>(`${BASE}/customer-sales/search`, params as Record<string, unknown>)
}

export function removeSalesReconciliationOrders(reconciliation_id: string, sales_order_ids: string[]): Promise<ApiResponse<SalesReconciliationItem>> {
  return post<SalesReconciliationItem>(`${RECON_BASE}/remove-sales-orders`, toMultipart({
    reconciliation_id,
    sales_order_ids: JSON.stringify(sales_order_ids),
  }))
}

export function removeSalesReconciliationReturns(reconciliation_id: string, sales_return_ids: string[]): Promise<ApiResponse<SalesReconciliationItem>> {
  return post<SalesReconciliationItem>(`${RECON_BASE}/remove-sales-returns`, toMultipart({
    reconciliation_id,
    sales_return_ids: JSON.stringify(sales_return_ids),
  }))
}
