/**
 * 模块：采购管理
 * 源接口：06_租客员工_采购管理.md
 * 功能：采购订单（接口18-31）、入库单、退货单、报表
 * 说明：采购订单写操作均为 multipart/form-data（toMultipart/toFormData）；
 *   后端实际行为（已校对源码 tenant_purchase_management.py）：
 *   - 列表/搜索返回 key 为 purchase_order（单数），非 purchase_orders
 *   - 详情返回裸对象（无 wrapper key），非 { purchase_order: {...} }
 *   - 字段名：order_amount（非 total_amount）、payable_amount（非 actual_amount）
 *   - 明细行 ID 为 purchase_order_item_id，单价为 purchase_price（非 unit_price）
 *   - 删除图片/附件参数为 file_urls（非 image_urls/attachment_urls）
 *   - 删除明细为单条 purchase_order_item_id（非批量 item_ids）
 */
import { get, post, toFormData, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

// ==================== 采购订单（接口18-31） ====================

/** 采购订单列表项（接口29/31 返回，字段名与后端源码逐一核对） */
export interface PurchaseOrderListItem {
  purchase_order_id: string
  order_no: string
  supplier_id: string
  supplier_name: string
  order_date: string
  delivery_days: number
  freight_bear_type: string            // 显示名
  freight_bear_type_value?: string     // 枚举标准值
  payment_method: string               // 显示名
  payment_method_value?: string        // 枚举标准值
  order_amount: string                 // 订单金额（非 total_amount）
  rounding_amount: string
  payable_amount: string               // 应付金额（非 actual_amount）
  use_prepayment_amount?: string
  use_gift_amount?: string
  is_audited: number                   // 0=待审核, 1=已审核, 2=反审核, 3=审核失败
  is_audited_name?: string             // 审核状态中文名
  purchase_status: number              // 0=未采购, 1=已采购
  purchase_status_name?: string        // 采购状态中文名
  created_at?: string
  created_by?: string
  created_by_name?: string
}

/** 采购订单明细行（后端返回字段，逐一核对自源码第 3722-3753 行） */
export interface PurchaseOrderLineItem {
  purchase_order_item_id?: string
  purchase_order_id?: string
  item_no?: string
  product_id: string
  product_code?: string
  product_name?: string
  category_id?: string
  category_name?: string
  specification?: string | null
  color?: string | null
  unit_id?: string | null
  unit_name?: string
  purchase_price: string              // 采购单价（非 unit_price）
  qty: string
  amount?: string
  payable_amount?: string
  payable_unit_price?: string | null
  last_purchase_price?: string | null
  delivery_status?: number
  delivery_date?: string | null
  logistics_no?: string | null
  remark?: string | null
  created_at?: string
  created_by?: string
  created_by_name?: string
}

/** 采购订单完整详情（接口30 返回，后端返回裸对象，无 wrapper key） */
export interface PurchaseOrderFullDetail extends PurchaseOrderListItem {
  remark?: string | null
  items: PurchaseOrderLineItem[]
  images?: Array<{
    file_ref_id: string
    file_id: string
    file_name: string
    file_url: string
    sort_no: number
  }>
  attachments?: Array<{
    file_ref_id: string
    file_id: string
    file_name: string
    file_url: string
    file_size?: number
    sort_no: number
  }>
}

/** 采购订单列表响应（后端返回 key 为 purchase_order 单数） */
export interface PurchaseOrderListResponse {
  total: number
  page?: number
  page_size?: number
  purchase_order: PurchaseOrderListItem[]
}

/** 采购订单详情响应（后端返回裸对象，直接就是完整详情） */
export type PurchaseOrderDetailResponse = PurchaseOrderFullDetail

/** 新增采购订单入参（接口18，与后端 Schema TenantCreatePurchaseOrderRequest 核对一致） */
export interface PurchaseOrderCreatePayload {
  supplier_id: string
  order_date: string
  delivery_days: number | string
  freight_bear_type: string
  payment_method: string
  items: string  // JSON数组字符串，每条含 product_id/qty/purchase_price/remark
  rounding_amount?: string
  use_prepayment_amount?: string
  use_gift_amount?: string
  remark?: string
}

/** 修改采购订单入参（接口20，与后端 Schema TenantUpdatePurchaseOrderRequest 核对一致） */
export interface PurchaseOrderUpdatePayload {
  purchase_order_id: string
  supplier_id?: string
  order_date?: string
  delivery_days?: number | string
  freight_bear_type?: string
  payment_method?: string
  rounding_amount?: string
  use_prepayment_amount?: string
  use_gift_amount?: string
  remark?: string
}

/** 采购订单查询参数 */
export interface PurchaseOrderQueryParams {
  page?: number
  sort_by?: string
  sort_order?: string
}

/** 采购订单搜索参数 */
export interface PurchaseOrderSearchParams {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}

/** 审核预览结果（后端返回溢出检查结果，非 can_audit/reason） */
export interface AuditPreviewResult {
  has_gift_overflow: boolean
  gift_overflow_amount: string
  requested_gift_amount: string
  actual_gift_amount: string
  has_prepayment_overflow: boolean
  prepayment_overflow_amount: string
  requested_prepayment_amount: string
  actual_prepayment_amount: string
}

// --- 接口18：新增采购订单主单（支持上传图片和附件） ---
export function createPurchaseOrder(data: PurchaseOrderCreatePayload, files?: { images?: File[]; attachments?: File[] }): Promise<ApiResponse<PurchaseOrderFullDetail>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<PurchaseOrderFullDetail>('/api/v1/tenant-purchase-orders/create', fd)
}

// --- 接口19：新增采购订单明细行 ---
export function addPurchaseOrderItems(purchaseOrderId: string, items: PurchaseOrderLineItem[]): Promise<ApiResponse<{ created_count: number; purchase_order_item_ids: string[] }>> {
  const payload = { purchase_order_id: purchaseOrderId, items: JSON.stringify(items) }
  return post<{ created_count: number; purchase_order_item_ids: string[] }>('/api/v1/tenant-purchase-orders/items/create', toFormData(payload))
}

// --- 接口20：修改采购订单主单（可追加图片和附件） ---
export function updatePurchaseOrder(data: PurchaseOrderUpdatePayload, files?: { images?: File[]; attachments?: File[] }): Promise<ApiResponse<{ purchase_order_id: string; new_images?: string[]; new_attachments?: string[] }>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<{ purchase_order_id: string; new_images?: string[]; new_attachments?: string[] }>('/api/v1/tenant-purchase-orders/update', fd)
}

// --- 接口21：修改采购订单明细行 ---
export function updatePurchaseOrderItems(purchaseOrderId: string, items: PurchaseOrderLineItem[]): Promise<ApiResponse<{ updated_count: number; purchase_order_item_ids: string[] }>> {
  const payload = { purchase_order_id: purchaseOrderId, items: JSON.stringify(items) }
  return post<{ updated_count: number; purchase_order_item_ids: string[] }>('/api/v1/tenant-purchase-orders/items/update', toFormData(payload))
}

// --- 接口22：删除采购订单 ---
export function deletePurchaseOrder(purchaseOrderId: string): Promise<ApiResponse<{ purchase_order_id: string }>> {
  return post<{ purchase_order_id: string }>('/api/v1/tenant-purchase-orders/delete', toFormData({ purchase_order_id: purchaseOrderId }))
}

// --- 接口23：删除采购订单明细行（后端为单条删除，参数 purchase_order_item_id） ---
export function deletePurchaseOrderItem(purchaseOrderItemId: string): Promise<ApiResponse<{ purchase_order_item_id: string }>> {
  return post<{ purchase_order_item_id: string }>('/api/v1/tenant-purchase-orders/items/delete', toFormData({ purchase_order_item_id: purchaseOrderItemId }))
}

// --- 接口24：删除采购订单图片（后端参数为 file_urls） ---
export function deletePurchaseOrderImages(purchaseOrderId: string, fileUrls: string[]): Promise<ApiResponse<{ deleted_count: number }>> {
  const payload = { purchase_order_id: purchaseOrderId, file_urls: JSON.stringify(fileUrls) }
  return post<{ deleted_count: number }>('/api/v1/tenant-purchase-orders/images/delete', toFormData(payload))
}

// --- 接口25：删除采购订单附件（后端参数为 file_urls） ---
export function deletePurchaseOrderAttachments(purchaseOrderId: string, fileUrls: string[]): Promise<ApiResponse<{ deleted_count: number }>> {
  const payload = { purchase_order_id: purchaseOrderId, file_urls: JSON.stringify(fileUrls) }
  return post<{ deleted_count: number }>('/api/v1/tenant-purchase-orders/attachments/delete', toFormData(payload))
}

// --- 接口26：采购订单审核/反审核/重置待审核 ---
export function auditPurchaseOrder(purchaseOrderId: string | string[], isAudited: number): Promise<ApiResponse<{ updated_count: number; purchase_order_ids: string[]; is_audited: number }>> {
  const idValue = Array.isArray(purchaseOrderId) ? JSON.stringify(purchaseOrderId) : purchaseOrderId
  const payload = { purchase_order_id: idValue, is_audited: String(isAudited) }
  return post<{ updated_count: number; purchase_order_ids: string[]; is_audited: number }>('/api/v1/tenant-purchase-orders/audit', toFormData(payload))
}

// --- 接口27：采购订单审核预览（后端接受单个 purchase_order_id，返回溢出检查结果） ---
export function previewPurchaseOrderAudit(purchaseOrderId: string): Promise<ApiResponse<AuditPreviewResult>> {
  return get<AuditPreviewResult>('/api/v1/tenant-purchase-orders/audit/preview', {
    purchase_order_id: purchaseOrderId
  })
}

// --- 接口28：更新采购订单采购状态（后端仅接受 purchase_order_id，固定设为1=已采购） ---
export function updatePurchaseOrderStatus(purchaseOrderId: string): Promise<ApiResponse<{ purchase_order_id: string; order_no: string; purchase_status: number; purchase_status_name: string }>> {
  return post<{ purchase_order_id: string; order_no: string; purchase_status: number; purchase_status_name: string }>('/api/v1/tenant-purchase-orders/purchase-status/update', toFormData({ purchase_order_id: purchaseOrderId }))
}

// --- 接口29：查询采购订单列表 ---
export function getPurchaseOrderList(params: PurchaseOrderQueryParams): Promise<ApiResponse<PurchaseOrderListResponse>> {
  return get<PurchaseOrderListResponse>('/api/v1/tenant-purchase-orders/list', params as unknown as Record<string, unknown>)
}

// --- 接口30：查询采购订单详情（后端返回裸对象） ---
export function getPurchaseOrderDetail(purchaseOrderId: string): Promise<ApiResponse<PurchaseOrderDetailResponse>> {
  return get<PurchaseOrderDetailResponse>('/api/v1/tenant-purchase-orders/detail', { purchase_order_id: purchaseOrderId })
}

// --- 接口31：搜索采购订单 ---
export function searchPurchaseOrders(params: PurchaseOrderSearchParams): Promise<ApiResponse<PurchaseOrderListResponse>> {
  return get<PurchaseOrderListResponse>('/api/v1/tenant-purchase-orders/search', params as unknown as Record<string, unknown>)
}

// ==================== 采购入库单（接口32-46） ====================
// 说明（已对照接口文档）：
//   - 列表/搜索返回 key 为 purchase_receipts（复数）
//   - 详情返回 { purchase_receipt: {...} }（有 wrapper key）
//   - 创建时 items 为 JSON 数组字符串，每条含 purchase_order_item_id/in_stock_qty/remark
//   - 删除图片参数为 image_urls，删除附件参数为 attachment_urls（与订单不同）
//   - 更新入库状态单独调用接口40（warehouse/status/update）

/** 采购入库单列表项 */
export interface PurchaseReceiptListItem {
  purchase_receipt_id: string
  receipt_no: string
  supplier_id: string
  supplier_name: string
  total_amount: string
  warehouse_status: number          // 0=待入库，1=已入库
  remark?: string | null
  created_at?: string
  created_by?: string
  created_by_name?: string
}

/** 采购入库单明细行 */
export interface PurchaseReceiptLineItem {
  purchase_receipt_item_id?: string
  item_id?: string
  purchase_receipt_id?: string
  purchase_order_item_id: string    // 关联采购订单明细ID（创建时必填）
  in_stock_qty: number | string     // 入库数量（创建时必填）
  product_id?: string
  product_code?: string
  product_name?: string
  category_name?: string
  unit_name?: string
  unit_price?: string               // 单价
  qty?: number | string             // 明细行数量（更新时用）
  remark?: string | null
}

/** 采购入库单完整详情 */
export interface PurchaseReceiptFullDetail extends PurchaseReceiptListItem {
  items: PurchaseReceiptLineItem[]
  image_urls?: string[]
  attachment_urls?: string[]
}

/** 采购入库单列表响应（key 为 purchase_receipts 复数） */
export interface PurchaseReceiptListResponse {
  total: number
  page?: number
  page_size?: number
  purchase_receipts: PurchaseReceiptListItem[]
}

/** 采购入库单详情响应（有 wrapper key purchase_receipt） */
export interface PurchaseReceiptDetailResponse {
  purchase_receipt: PurchaseReceiptFullDetail
}

/** 待收货采购明细行（接口46返回） */
export interface PendingReceiptItem {
  item_id: string
  purchase_order_item_id?: string
  order_no: string
  product_id?: string
  product_code?: string
  product_name: string
  category_name?: string
  unit_name?: string
  specification?: string
  color?: string
  ordered_qty: number | string      // 订单数量
  received_qty: number | string     // 已入库数量
  pending_qty: number | string      // 待收货数量
  purchase_price?: string
}

/** 待收货明细列表响应 */
export interface PendingReceiptListResponse {
  total: number
  items: PendingReceiptItem[]
}

/** 入库单查询参数 */
export interface PurchaseReceiptQueryParams {
  page?: number
  sort_by?: string
  sort_order?: string
}

/** 入库单搜索参数 */
export interface PurchaseReceiptSearchParams {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}

// --- 接口32：新增采购入库单（multipart/form-data，items 为 JSON 字符串） ---
export function createPurchaseInbound(
  data: { supplier_id: string; items: string; remark?: string },
  files?: { images?: File[]; attachments?: File[] }
): Promise<ApiResponse<PurchaseReceiptFullDetail>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<PurchaseReceiptFullDetail>('/api/v1/tenant-purchase-receipts/create', fd)
}

// --- 接口33：修改采购入库单主单 ---
export function updatePurchaseInbound(
  id: string,
  data: { supplier_id?: string; remark?: string },
  files?: { images?: File[]; attachments?: File[] }
): Promise<ApiResponse<{ purchase_receipt_id: string; receipt_no: string }>> {
  const fd = toMultipart({ ...data, purchase_receipt_id: id } as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<{ purchase_receipt_id: string; receipt_no: string }>('/api/v1/tenant-purchase-receipts/update', fd)
}

// --- 接口34：删除采购入库单 ---
export function deletePurchaseInbound(id: string): Promise<ApiResponse<{ purchase_receipt_id: string }>> {
  return post<{ purchase_receipt_id: string }>('/api/v1/tenant-purchase-receipts/delete', toFormData({ purchase_receipt_id: id }))
}

// --- 接口35：新增采购入库单明细行 ---
export function addPurchaseInboundItems(
  purchaseReceiptId: string,
  items: Array<{ purchase_order_item_id: string; in_stock_qty: number | string; remark?: string }>
): Promise<ApiResponse<{ created_count: number; purchase_receipt_item_ids: string[] }>> {
  const payload = { purchase_receipt_id: purchaseReceiptId, items: JSON.stringify(items) }
  return post<{ created_count: number; purchase_receipt_item_ids: string[] }>('/api/v1/tenant-purchase-receipts/items/create', toFormData(payload))
}

// --- 接口36：修改采购入库单明细行 ---
export function updatePurchaseInboundItems(
  purchaseReceiptId: string,
  items: Array<{ item_id: string; qty?: number | string; unit_price?: string; remark?: string }>
): Promise<ApiResponse<{ updated_count: number; purchase_receipt_item_ids: string[] }>> {
  const payload = { purchase_receipt_id: purchaseReceiptId, items: JSON.stringify(items) }
  return post<{ updated_count: number; purchase_receipt_item_ids: string[] }>('/api/v1/tenant-purchase-receipts/items/update', toFormData(payload))
}

// --- 接口37：删除采购入库单明细行（支持批量，item_ids 为 JSON 数组字符串） ---
export function deletePurchaseInboundItems(
  purchaseReceiptId: string,
  itemIds: string[]
): Promise<ApiResponse<{ deleted_count: number }>> {
  const payload = { purchase_receipt_id: purchaseReceiptId, item_ids: JSON.stringify(itemIds) }
  return post<{ deleted_count: number }>('/api/v1/tenant-purchase-receipts/items/delete', toFormData(payload))
}

// --- 接口38：删除采购入库单图片（参数为 image_urls） ---
export function deletePurchaseInboundImages(
  purchaseReceiptId: string,
  imageUrls: string[]
): Promise<ApiResponse<{ deleted_count: number; remaining_image_urls: string[] }>> {
  const payload = { purchase_receipt_id: purchaseReceiptId, image_urls: JSON.stringify(imageUrls) }
  return post<{ deleted_count: number; remaining_image_urls: string[] }>('/api/v1/tenant-purchase-receipts/images/delete', toFormData(payload))
}

// --- 接口39：删除采购入库单附件（参数为 attachment_urls） ---
export function deletePurchaseInboundAttachments(
  purchaseReceiptId: string,
  attachmentUrls: string[]
): Promise<ApiResponse<{ deleted_count: number; remaining_attachment_urls: string[] }>> {
  const payload = { purchase_receipt_id: purchaseReceiptId, attachment_urls: JSON.stringify(attachmentUrls) }
  return post<{ deleted_count: number; remaining_attachment_urls: string[] }>('/api/v1/tenant-purchase-receipts/attachments/delete', toFormData(payload))
}

// --- 接口40：更新采购入库单入库状态（warehouse_status=1 触发库存更新） ---
export function updatePurchaseInboundWarehouseStatus(
  purchaseReceiptId: string,
  warehouseStatus: 1
): Promise<ApiResponse<{ purchase_receipt_id: string; warehouse_status: number }>> {
  const payload = { purchase_receipt_id: purchaseReceiptId, warehouse_status: String(warehouseStatus) }
  return post<{ purchase_receipt_id: string; warehouse_status: number }>('/api/v1/tenant-purchase-receipts/warehouse/status/update', toFormData(payload))
}

// --- 接口41：查询采购入库单列表 ---
export function getPurchaseInboundList(params: PurchaseReceiptQueryParams): Promise<ApiResponse<PurchaseReceiptListResponse>> {
  return get<PurchaseReceiptListResponse>('/api/v1/tenant-purchase-receipts/list', params as unknown as Record<string, unknown>)
}

// --- 接口42：查询采购入库单详情（返回 { purchase_receipt: {...} }） ---
export function getPurchaseInboundDetail(id: string): Promise<ApiResponse<PurchaseReceiptDetailResponse>> {
  return get<PurchaseReceiptDetailResponse>('/api/v1/tenant-purchase-receipts/detail', { purchase_receipt_id: id })
}

// --- 接口43：搜索采购入库单 ---
export function searchPurchaseInbound(params: PurchaseReceiptSearchParams): Promise<ApiResponse<PurchaseReceiptListResponse>> {
  return get<PurchaseReceiptListResponse>('/api/v1/tenant-purchase-receipts/search', params as unknown as Record<string, unknown>)
}

// --- 接口44：查询采购入库单明细行列表 ---
export function getPurchaseInboundItemList(params: {
  purchase_receipt_id?: string
  purchase_order_id?: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<{ total: number; items: PurchaseReceiptLineItem[] }>> {
  return get<{ total: number; items: PurchaseReceiptLineItem[] }>('/api/v1/tenant-purchase-receipts/items/list', params as unknown as Record<string, unknown>)
}

// --- 接口45：搜索采购入库单明细行 ---
export function searchPurchaseInboundItems(params: PurchaseReceiptSearchParams): Promise<ApiResponse<{ total: number; items: PurchaseReceiptLineItem[] }>> {
  return get<{ total: number; items: PurchaseReceiptLineItem[] }>('/api/v1/tenant-purchase-receipts/items/search', params as unknown as Record<string, unknown>)
}

// --- 接口46：查询待收货采购明细列表（创建入库单时选择明细使用） ---
export function getPendingReceiptItemList(params: {
  supplier_id: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<PendingReceiptListResponse>> {
  return get<PendingReceiptListResponse>('/api/v1/tenant-suppliers/purchase-items/pending-receipt/list', params as unknown as Record<string, unknown>)
}

// --- 接口47：搜索待收货采购明细 ---
export function searchPendingReceiptItems(params: {
  supplier_id: string
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<PendingReceiptListResponse>> {
  return get<PendingReceiptListResponse>('/api/v1/tenant-suppliers/purchase-items/pending-receipt/search', params as unknown as Record<string, unknown>)
}

// ==================== 采购退货单（占位，待后续接入） ====================

export function getPurchaseReturnList(params: Record<string, unknown>): Promise<ApiResponse<any>> {
  return get<any>('/api/v1/tenant-purchase-returns/list', params)
}
export function deletePurchaseReturn(id: string): Promise<ApiResponse<null>> {
  return post<null>('/api/v1/tenant-purchase-returns/delete', toFormData({ purchase_return_id: id }))
}
export function getPurchaseReturnDetail(id: string): Promise<ApiResponse<any>> {
  return get<any>('/api/v1/tenant-purchase-returns/detail', { purchase_return_id: id })
}
export function createPurchaseReturn(data: Record<string, unknown>): Promise<ApiResponse<any>> {
  return post<any>('/api/v1/tenant-purchase-returns/create', toFormData(data))
}
export function updatePurchaseReturn(id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> {
  return post<any>('/api/v1/tenant-purchase-returns/update', toFormData({ ...data, purchase_return_id: id }))
}

// 报表占位函数（待后续接入对应接口文档）
export function getPurchaseSuggestionList(params: Record<string, unknown>): Promise<ApiResponse<{ list: any[]; total: number; page: number; pageSize: number }>> {
  return get('/api/v1/tenant-purchase-suggestions/list', params)
}
export function getSalesSummaryList(params: Record<string, unknown>): Promise<ApiResponse<{ list: any[]; total: number; page: number; pageSize: number }>> {
  return get('/api/v1/tenant-sales-summary/list', params)
}
