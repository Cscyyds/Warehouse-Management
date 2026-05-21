/**
 * 模块：销售管理
 * 表名：客户订货单/销售订单/售后/退货/对账单
 * 功能：客户订货单、销售订单、售后、退货、对账单、冻结解冻、审核、10+种报表
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface SalesOrderItem {
  id: string
  orderNo: string
  customerId: string
  customerName: string
  orderType: string
  orderDate: string
  deliveryDate: string
  warehouseId: string
  warehouseName: string
  salesUserId: string
  salesUserName: string
  productAmount: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
  status: string
  auditStatus: string
  auditOpinion: string
  isFrozen: boolean
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface SalesOrderDetail {
  id: string
  productId: string
  productCode: string
  productName: string
  spec: string
  unit: string
  quantity: number
  deliveredQuantity: number
  unitPrice: number
  totalPrice: number
  remark: string
}

export interface CustomerOrderItem {
  id: string
  orderNo: string
  customerId: string
  customerName: string
  orderDate: string
  deliveryDate: string
  totalAmount: number
  status: string
  auditStatus: string
  remark: string
  createTime: string
  updateTime: string
}

export interface AfterSaleItem {
  id: string
  serviceNo: string
  orderId: string
  orderNo: string
  customerId: string
  customerName: string
  serviceType: string
  serviceContent: string
  status: string
  auditStatus: string
  handler: string
  handlerPhone: string
  handleResult: string
  handleTime: string
  remark: string
  createTime: string
  updateTime: string
}

export interface SalesReturnItem {
  id: string
  returnNo: string
  orderId: string
  orderNo: string
  customerId: string
  customerName: string
  warehouseId: string
  warehouseName: string
  returnDate: string
  returnReason: string
  totalAmount: number
  status: string
  auditStatus: string
  remark: string
  createTime: string
  updateTime: string
}

export interface ReconciliationItem {
  id: string
  reconciliationNo: string
  customerId: string
  customerName: string
  periodStart: string
  periodEnd: string
  beginAmount: number
  invoiceAmount: number
  paymentAmount: number
  endAmount: number
  status: string
  confirmStatus: string
  remark: string
  createTime: string
  updateTime: string
}

export interface SalesQueryParams {
  page: number
  pageSize: number
  orderNo?: string
  customerId?: string
  customerName?: string
  warehouseId?: string
  salesUserId?: string
  orderType?: string
  status?: string
  auditStatus?: string
  isFrozen?: boolean
  startDate?: string
  endDate?: string
}

export interface SalesOrderListResponse {
  list: SalesOrderItem[]
  total: number
  page: number
  pageSize: number
}

export interface CustomerOrderListResponse {
  list: CustomerOrderItem[]
  total: number
  page: number
  pageSize: number
}

export interface AfterSaleListResponse {
  list: AfterSaleItem[]
  total: number
  page: number
  pageSize: number
}

export interface SalesReturnListResponse {
  list: SalesReturnItem[]
  total: number
  page: number
  pageSize: number
}

export interface ReconciliationListResponse {
  list: ReconciliationItem[]
  total: number
  page: number
  pageSize: number
}

export function getSalesOrderList(params: SalesQueryParams): Promise<ApiResponse<SalesOrderListResponse>> {
  return get<SalesOrderListResponse>('/sales/order/list', params as unknown as Record<string, unknown>)
}

export function getSalesOrderDetail(id: string): Promise<ApiResponse<SalesOrderItem & { details: SalesOrderDetail[] }>> {
  return get<SalesOrderItem & { details: SalesOrderDetail[] }>(`/sales/order/${id}`)
}

export function createSalesOrder(data: Partial<SalesOrderItem> & { details: Partial<SalesOrderDetail>[] }): Promise<ApiResponse<SalesOrderItem>> {
  return post<SalesOrderItem>('/sales/order', data)
}

export function updateSalesOrder(id: string, data: Partial<SalesOrderItem> & { details: Partial<SalesOrderDetail>[] }): Promise<ApiResponse<SalesOrderItem>> {
  return put<SalesOrderItem>(`/sales/order/${id}`, data)
}

export function deleteSalesOrder(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/sales/order/${id}`)
}

export function auditSalesOrder(id: string, auditStatus: string, auditOpinion: string): Promise<ApiResponse<null>> {
  return post<null>(`/sales/order/${id}/audit`, { auditStatus, auditOpinion })
}

export function freezeSalesOrder(id: string): Promise<ApiResponse<null>> {
  return post<null>(`/sales/order/${id}/freeze`)
}

export function unfreezeSalesOrder(id: string): Promise<ApiResponse<null>> {
  return post<null>(`/sales/order/${id}/unfreeze`)
}

export function sendSalesOrderToWarehouse(id: string): Promise<ApiResponse<null>> {
  return post<null>(`/sales/order/${id}/send-warehouse`)
}

export function warehouseReturnSalesOrder(id: string, reason: string): Promise<ApiResponse<null>> {
  return post<null>(`/sales/order/${id}/warehouse-return`, { reason })
}

export function getCustomerOrderList(params: SalesQueryParams): Promise<ApiResponse<CustomerOrderListResponse>> {
  return get<CustomerOrderListResponse>('/sales/customer-order/list', params as unknown as Record<string, unknown>)
}

export function getCustomerOrderDetail(id: string): Promise<ApiResponse<CustomerOrderItem>> {
  return get<CustomerOrderItem>(`/sales/customer-order/${id}`)
}

export function createCustomerOrder(data: Partial<CustomerOrderItem>): Promise<ApiResponse<CustomerOrderItem>> {
  return post<CustomerOrderItem>('/sales/customer-order', data)
}

export function updateCustomerOrder(id: string, data: Partial<CustomerOrderItem>): Promise<ApiResponse<CustomerOrderItem>> {
  return put<CustomerOrderItem>(`/sales/customer-order/${id}`, data)
}

export function deleteCustomerOrder(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/sales/customer-order/${id}`)
}

export function auditCustomerOrder(id: string, auditStatus: string, auditOpinion: string): Promise<ApiResponse<null>> {
  return post<null>(`/sales/customer-order/${id}/audit`, { auditStatus, auditOpinion })
}

export function getAfterSaleList(params: SalesQueryParams): Promise<ApiResponse<AfterSaleListResponse>> {
  return get<AfterSaleListResponse>('/sales/after-sale/list', params as unknown as Record<string, unknown>)
}

export function getAfterSaleDetail(id: string): Promise<ApiResponse<AfterSaleItem>> {
  return get<AfterSaleItem>(`/sales/after-sale/${id}`)
}

export function createAfterSale(data: Partial<AfterSaleItem>): Promise<ApiResponse<AfterSaleItem>> {
  return post<AfterSaleItem>('/sales/after-sale', data)
}

export function updateAfterSale(id: string, data: Partial<AfterSaleItem>): Promise<ApiResponse<AfterSaleItem>> {
  return put<AfterSaleItem>(`/sales/after-sale/${id}`, data)
}

export function deleteAfterSale(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/sales/after-sale/${id}`)
}

export function auditAfterSale(id: string, auditStatus: string, auditOpinion: string): Promise<ApiResponse<null>> {
  return post<null>(`/sales/after-sale/${id}/audit`, { auditStatus, auditOpinion })
}

export function getSalesReturnList(params: SalesQueryParams): Promise<ApiResponse<SalesReturnListResponse>> {
  return get<SalesReturnListResponse>('/sales/return/list', params as unknown as Record<string, unknown>)
}

export function getSalesReturnDetail(id: string): Promise<ApiResponse<SalesReturnItem>> {
  return get<SalesReturnItem>(`/sales/return/${id}`)
}

export function createSalesReturn(data: Partial<SalesReturnItem>): Promise<ApiResponse<SalesReturnItem>> {
  return post<SalesReturnItem>('/sales/return', data)
}

export function updateSalesReturn(id: string, data: Partial<SalesReturnItem>): Promise<ApiResponse<SalesReturnItem>> {
  return put<SalesReturnItem>(`/sales/return/${id}`, data)
}

export function deleteSalesReturn(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/sales/return/${id}`)
}

export function auditSalesReturn(id: string, auditStatus: string, auditOpinion: string): Promise<ApiResponse<null>> {
  return post<null>(`/sales/return/${id}/audit`, { auditStatus, auditOpinion })
}

export function sendSalesReturnToWarehouse(id: string): Promise<ApiResponse<null>> {
  return post<null>(`/sales/return/${id}/send-warehouse`)
}

export function warehouseReturnSalesReturn(id: string, reason: string): Promise<ApiResponse<null>> {
  return post<null>(`/sales/return/${id}/warehouse-return`, { reason })
}

export function getReconciliationList(params: SalesQueryParams): Promise<ApiResponse<ReconciliationListResponse>> {
  return get<ReconciliationListResponse>('/sales/reconciliation/list', params as unknown as Record<string, unknown>)
}

export function getReconciliationDetail(id: string): Promise<ApiResponse<ReconciliationItem>> {
  return get<ReconciliationItem>(`/sales/reconciliation/${id}`)
}

export function createReconciliation(data: Partial<ReconciliationItem>): Promise<ApiResponse<ReconciliationItem>> {
  return post<ReconciliationItem>('/sales/reconciliation', data)
}

export function updateReconciliation(id: string, data: Partial<ReconciliationItem>): Promise<ApiResponse<ReconciliationItem>> {
  return put<ReconciliationItem>(`/sales/reconciliation/${id}`, data)
}

export function deleteReconciliation(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/sales/reconciliation/${id}`)
}

export function confirmReconciliation(id: string): Promise<ApiResponse<null>> {
  return post<null>(`/sales/reconciliation/${id}/confirm`)
}

export function getSalesReport(params: SalesQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/sales/report', params as unknown as Record<string, unknown>)
}

export function getSalesOrderReport(params: SalesQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/sales/report/order', params as unknown as Record<string, unknown>)
}

export function getSalesCustomerReport(params: SalesQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/sales/report/customer', params as unknown as Record<string, unknown>)
}

export function getSalesProductReport(params: SalesQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/sales/report/product', params as unknown as Record<string, unknown>)
}

export function getSalesPersonReport(params: SalesQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/sales/report/sales-person', params as unknown as Record<string, unknown>)
}

export function getSalesReturnReport(params: SalesQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/sales/report/return', params as unknown as Record<string, unknown>)
}

export function getSalesReconciliationReport(params: SalesQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/sales/report/reconciliation', params as unknown as Record<string, unknown>)
}

export function getSalesMonthlyReport(params: SalesQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/sales/report/monthly', params as unknown as Record<string, unknown>)
}

export function getSalesDailyReport(params: SalesQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/sales/report/daily', params as unknown as Record<string, unknown>)
}

export function getSalesProfitReport(params: SalesQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/sales/report/profit', params as unknown as Record<string, unknown>)
}

export function getSalesInvoiceReport(params: SalesQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/sales/report/invoice', params as unknown as Record<string, unknown>)
}
