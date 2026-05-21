/**
 * 模块：采购管理
 * 表名：供应商/采购订单/入库单/退货单
 * 功能：供应商类型、供应商、采购订单、入库单、退货单、审核、发送仓库、报表
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface SupplierItem {
  id: string
  code: string
  name: string
  shortName: string
  type: string
  category: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  province: string
  city: string
  district: string
  address: string
  creditCode: string
  taxNo: string
  bankName: string
  bankAccount: string
  settleType: string
  creditAmount: number
  creditDays: number
  status: string
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface SupplierTypeItem {
  id: string
  name: string
  companyId: string
  companyName: string
  createTime: string
  updateTime: string
  remark: string
  status: string
}

export interface PurchaseOrderItem {
  id: string
  orderNo: string
  supplierId: string
  supplierName: string
  warehouseId: string
  warehouseName: string
  orderDate: string
  deliveryDate: string
  totalAmount: number
  discountAmount: number
  actualAmount: number
  paidAmount: number
  unpaidAmount: number
  status: string
  auditStatus: string
  auditOpinion: string
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface PurchaseOrderDetail {
  id: string
  productId: string
  productCode: string
  productName: string
  spec: string
  unit: string
  quantity: number
  receivedQuantity: number
  unitPrice: number
  totalPrice: number
  remark: string
}

export interface PurchaseInboundItem {
  id: string
  inboundNo: string
  orderId: string
  orderNo: string
  supplierId: string
  supplierName: string
  warehouseId: string
  warehouseName: string
  inboundDate: string
  totalAmount: number
  status: string
  auditStatus: string
  remark: string
  createTime: string
  updateTime: string
}

export interface PurchaseReturnItem {
  id: string
  returnNo: string
  orderId: string
  orderNo: string
  supplierId: string
  supplierName: string
  warehouseId: string
  warehouseName: string
  returnDate: string
  totalAmount: number
  returnReason: string
  status: string
  auditStatus: string
  remark: string
  createTime: string
  updateTime: string
}

export interface SupplierQueryParams {
  page: number
  pageSize: number
  code?: string
  name?: string
  type?: string
  category?: string
  status?: string
}

export interface PurchaseQueryParams {
  page: number
  pageSize: number
  orderNo?: string
  supplierId?: string
  supplierName?: string
  warehouseId?: string
  status?: string
  auditStatus?: string
  startDate?: string
  endDate?: string
}

export interface SupplierListResponse {
  list: SupplierItem[]
  total: number
  page: number
  pageSize: number
}

export interface SupplierTypeListResponse {
  list: SupplierTypeItem[]
  total: number
  page: number
  pageSize: number
}

export interface SupplierTypeQueryParams {
  page: number
  pageSize: number
  name?: string
  companyName?: string
  status?: string
}

export function getSupplierTypePage(params: SupplierTypeQueryParams): Promise<ApiResponse<SupplierTypeListResponse>> {
  return get<SupplierTypeListResponse>('/purchase/supplier-type/list', params as unknown as Record<string, unknown>)
}

export function getSupplierTypeDetail(id: string): Promise<ApiResponse<SupplierTypeItem>> {
  return get<SupplierTypeItem>(`/purchase/supplier-type/${id}`)
}

export function createSupplierType(data: Partial<SupplierTypeItem>): Promise<ApiResponse<SupplierTypeItem>> {
  return post<SupplierTypeItem>('/purchase/supplier-type', data)
}

export function updateSupplierType(id: string, data: Partial<SupplierTypeItem>): Promise<ApiResponse<SupplierTypeItem>> {
  return put<SupplierTypeItem>(`/purchase/supplier-type/${id}`, data)
}

export function deleteSupplierType(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/purchase/supplier-type/${id}`)
}

export interface PurchaseOrderListResponse {
  list: PurchaseOrderItem[]
  total: number
  page: number
  pageSize: number
}

export interface PurchaseInboundListResponse {
  list: PurchaseInboundItem[]
  total: number
  page: number
  pageSize: number
}

export interface PurchaseReturnListResponse {
  list: PurchaseReturnItem[]
  total: number
  page: number
  pageSize: number
}

export function getSupplierList(params: SupplierQueryParams): Promise<ApiResponse<SupplierListResponse>> {
  return get<SupplierListResponse>('/purchase/supplier/list', params as unknown as Record<string, unknown>)
}

export function getSupplierDetail(id: string): Promise<ApiResponse<SupplierItem>> {
  return get<SupplierItem>(`/purchase/supplier/${id}`)
}

export function createSupplier(data: Partial<SupplierItem>): Promise<ApiResponse<SupplierItem>> {
  return post<SupplierItem>('/purchase/supplier', data)
}

export function updateSupplier(id: string, data: Partial<SupplierItem>): Promise<ApiResponse<SupplierItem>> {
  return put<SupplierItem>(`/purchase/supplier/${id}`, data)
}

export function updateSupplierStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/purchase/supplier/${id}/status`, { status })
}

export function deleteSupplier(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/purchase/supplier/${id}`)
}

export function getSupplierTypeList(): Promise<ApiResponse<{ label: string; value: string }[]>> {
  return get<{ label: string; value: string }[]>('/purchase/supplier/type/list')
}

export function getPurchaseOrderList(params: PurchaseQueryParams): Promise<ApiResponse<PurchaseOrderListResponse>> {
  return get<PurchaseOrderListResponse>('/purchase/order/list', params as unknown as Record<string, unknown>)
}

export function getPurchaseOrderDetail(id: string): Promise<ApiResponse<PurchaseOrderItem & { details: PurchaseOrderDetail[] }>> {
  return get<PurchaseOrderItem & { details: PurchaseOrderDetail[] }>(`/purchase/order/${id}`)
}

export function createPurchaseOrder(data: Partial<PurchaseOrderItem> & { details: Partial<PurchaseOrderDetail>[] }): Promise<ApiResponse<PurchaseOrderItem>> {
  return post<PurchaseOrderItem>('/purchase/order', data)
}

export function updatePurchaseOrder(id: string, data: Partial<PurchaseOrderItem> & { details: Partial<PurchaseOrderDetail>[] }): Promise<ApiResponse<PurchaseOrderItem>> {
  return put<PurchaseOrderItem>(`/purchase/order/${id}`, data)
}

export function deletePurchaseOrder(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/purchase/order/${id}`)
}

export function auditPurchaseOrder(id: string, auditStatus: string, auditOpinion: string): Promise<ApiResponse<null>> {
  return post<null>(`/purchase/order/${id}/audit`, { auditStatus, auditOpinion })
}

export function sendToWarehouse(id: string): Promise<ApiResponse<null>> {
  return post<null>(`/purchase/order/${id}/send-warehouse`)
}

export function getPurchaseInboundList(params: PurchaseQueryParams): Promise<ApiResponse<PurchaseInboundListResponse>> {
  return get<PurchaseInboundListResponse>('/purchase/inbound/list', params as unknown as Record<string, unknown>)
}

export function getPurchaseInboundDetail(id: string): Promise<ApiResponse<PurchaseInboundItem>> {
  return get<PurchaseInboundItem>(`/purchase/inbound/${id}`)
}

export function createPurchaseInbound(data: Partial<PurchaseInboundItem>): Promise<ApiResponse<PurchaseInboundItem>> {
  return post<PurchaseInboundItem>('/purchase/inbound', data)
}

export function updatePurchaseInbound(id: string, data: Partial<PurchaseInboundItem>): Promise<ApiResponse<PurchaseInboundItem>> {
  return put<PurchaseInboundItem>(`/purchase/inbound/${id}`, data)
}

export function deletePurchaseInbound(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/purchase/inbound/${id}`)
}

export function auditPurchaseInbound(id: string, auditStatus: string, auditOpinion: string): Promise<ApiResponse<null>> {
  return post<null>(`/purchase/inbound/${id}/audit`, { auditStatus, auditOpinion })
}

export function sendPurchaseInboundToWarehouse(id: string): Promise<ApiResponse<null>> {
  return post<null>(`/purchase/inbound/${id}/send-warehouse`)
}

export function warehouseReturnPurchaseInbound(id: string, reason = ''): Promise<ApiResponse<null>> {
  return post<null>(`/purchase/inbound/${id}/warehouse-return`, { reason })
}

export function getPurchaseReturnList(params: PurchaseQueryParams): Promise<ApiResponse<PurchaseReturnListResponse>> {
  return get<PurchaseReturnListResponse>('/purchase/return/list', params as unknown as Record<string, unknown>)
}

export function getPurchaseReturnDetail(id: string): Promise<ApiResponse<PurchaseReturnItem>> {
  return get<PurchaseReturnItem>(`/purchase/return/${id}`)
}

export function createPurchaseReturn(data: Partial<PurchaseReturnItem>): Promise<ApiResponse<PurchaseReturnItem>> {
  return post<PurchaseReturnItem>('/purchase/return', data)
}

export function updatePurchaseReturn(id: string, data: Partial<PurchaseReturnItem>): Promise<ApiResponse<PurchaseReturnItem>> {
  return put<PurchaseReturnItem>(`/purchase/return/${id}`, data)
}

export function deletePurchaseReturn(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/purchase/return/${id}`)
}

export function auditPurchaseReturn(id: string, auditStatus: string, auditOpinion: string): Promise<ApiResponse<null>> {
  return post<null>(`/purchase/return/${id}/audit`, { auditStatus, auditOpinion })
}

export function sendPurchaseReturnToWarehouse(id: string): Promise<ApiResponse<null>> {
  return post<null>(`/purchase/return/${id}/send-warehouse`)
}

export function warehouseReturnPurchaseReturn(id: string, reason = ''): Promise<ApiResponse<null>> {
  return post<null>(`/purchase/return/${id}/warehouse-return`, { reason })
}

export function getPurchaseReport(params: PurchaseQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/purchase/report', params as unknown as Record<string, unknown>)
}

export function getPurchaseOrderReport(params: PurchaseQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/purchase/report/order', params as unknown as Record<string, unknown>)
}

export function getPurchaseInboundReport(params: PurchaseQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/purchase/report/inbound', params as unknown as Record<string, unknown>)
}

export function getPurchaseReturnReport(params: PurchaseQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/purchase/report/return', params as unknown as Record<string, unknown>)
}

export function getPurchaseSupplierReport(params: SupplierQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/purchase/report/supplier', params as unknown as Record<string, unknown>)
}

export function getPurchaseSuggestionList(params: PurchaseQueryParams): Promise<ApiResponse<{ list: any[]; total: number; page: number; pageSize: number }>> {
  return get('/purchase/report/suggestion', params as unknown as Record<string, unknown>)
}

export function getSalesSummaryList(params: PurchaseQueryParams): Promise<ApiResponse<{ list: any[]; total: number; page: number; pageSize: number }>> {
  return get('/purchase/report/sales-summary', params as unknown as Record<string, unknown>)
}
