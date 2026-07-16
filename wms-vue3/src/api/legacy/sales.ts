import type { ApiResponse } from '@/utils/request'
import { createSalesOrderV2, getSalesOrderDetailV2, updateSalesOrderV2 } from '../modules/sales'
import type { SalesOrderQueryParams } from '../modules/sales'

export type SalesQueryParams = SalesOrderQueryParams & { [k: string]: unknown }

export interface AfterSaleItem { [k: string]: unknown }
export interface ReconciliationItem { [k: string]: unknown }
export interface SalesReturnItem {
  sales_return_id: string
  return_no: string
  customer_name?: string
  return_amount?: string
  return_date?: string
  [k: string]: unknown
}

const STUB_LIST = { total: 0, page: 1, page_size: 20, list: [] as any[] }

export function getAfterSaleList(_params: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: STUB_LIST } as any)
}

export function getAfterSaleDetail(_id: string): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: {} } as any)
}

export function createAfterSale(_data: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: {} } as any)
}

export function updateAfterSale(_id: string, _data: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: {} } as any)
}

export function deleteAfterSale(_id: string): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function auditAfterSale(_id: string, _s: string, _o: string): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function getSalesReturnDetail(_id: string): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: {} } as any)
}

export function createSalesReturn(_data: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: {} } as any)
}

export function updateSalesReturn(_id: string, _data: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: {} } as any)
}

export function getReconciliationList(_params: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: STUB_LIST } as any)
}

export function getReconciliationDetail(_id: string): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: {} } as any)
}

export function createReconciliation(_data: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: {} } as any)
}

export function updateReconciliation(_id: string, _data: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: {} } as any)
}

export function deleteReconciliation(_id: string): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function confirmReconciliation(_id: string): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function getSalesReport(_params: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function getSalesOrderDetail(id: string) {
  return getSalesOrderDetailV2(id)
}

export function createSalesOrder(data: any) {
  return createSalesOrderV2(data)
}

export function updateSalesOrder(_id: string, data: any) {
  return updateSalesOrderV2(data)
}

export function getSalesReturnList(_params: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: STUB_LIST } as any)
}

export function deleteSalesReturn(_id: string): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function auditSalesReturn(_id: string, _s: string, _o: string): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function sendSalesReturnToWarehouse(_id: string): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function warehouseReturnSalesReturn(_id: string, _reason: string): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function getSalesCustomerReport(_params: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function getSalesOrderReport(_params: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function getSalesProductReport(_params: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function getSalesReconciliationReport(_params: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}

export function getSalesReturnReport(_params: any): Promise<ApiResponse<any>> {
  return Promise.resolve({ code: 200, message: 'stub', data: null } as any)
}
