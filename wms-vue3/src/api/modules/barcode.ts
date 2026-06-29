/**
 * 模块：条码管理
 * 表名：条码信息表
 * 功能：入库/出库/物流条码、批量打印
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface BarcodeItem {
  id: string
  barcode: string
  type: string
  businessType: string
  businessNo: string
  productId: string
  productCode: string
  productName: string
  batchNo: string
  spec: string
  quantity: number
  unit: string
  warehouseId: string
  warehouseName: string
  locationId: string
  locationName: string
  shelfId: string
  shelfName: string
  status: string
  printCount: number
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface BarcodeQueryParams {
  page: number
  pageSize: number
  barcode?: string
  type?: string
  businessType?: string
  businessNo?: string
  productId?: string
  productCode?: string
  productName?: string
  batchNo?: string
  warehouseId?: string
  status?: string
  sort_by?: string
  sort_order?: string
}

export interface BarcodeListResponse {
  list: BarcodeItem[]
  total: number
  page: number
  pageSize: number
}

export function getBarcodeList(params: BarcodeQueryParams): Promise<ApiResponse<BarcodeListResponse>> {
  return get<BarcodeListResponse>('/barcode/list', params as unknown as Record<string, unknown>)
}

export function getBarcodeDetail(id: string): Promise<ApiResponse<BarcodeItem>> {
  return get<BarcodeItem>(`/barcode/${id}`)
}

export function createBarcode(data: Partial<BarcodeItem>): Promise<ApiResponse<BarcodeItem>> {
  return post<BarcodeItem>('/barcode', data)
}

export function updateBarcode(id: string, data: Partial<BarcodeItem>): Promise<ApiResponse<BarcodeItem>> {
  return put<BarcodeItem>(`/barcode/${id}`, data)
}

export function deleteBarcode(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/barcode/${id}`)
}

export function batchDeleteBarcode(ids: string[]): Promise<ApiResponse<null>> {
  return post<null>('/barcode/batch-delete', { ids })
}

export function batchPrintBarcode(ids: string[]): Promise<ApiResponse<Blob>> {
  return post<Blob>('/barcode/batch-print', { ids })
}

export function getInboundBarcodeList(params: BarcodeQueryParams): Promise<ApiResponse<BarcodeListResponse>> {
  return get<BarcodeListResponse>('/barcode/inbound/list', params as unknown as Record<string, unknown>)
}

export function getOutboundBarcodeList(params: BarcodeQueryParams): Promise<ApiResponse<BarcodeListResponse>> {
  return get<BarcodeListResponse>('/barcode/outbound/list', params as unknown as Record<string, unknown>)
}

export function getLogisticsBarcodeList(params: BarcodeQueryParams): Promise<ApiResponse<BarcodeListResponse>> {
  return get<BarcodeListResponse>('/barcode/logistics/list', params as unknown as Record<string, unknown>)
}

export function generateInboundBarcode(data: Partial<BarcodeItem>): Promise<ApiResponse<BarcodeItem[]>> {
  return post<BarcodeItem[]>('/barcode/inbound/generate', data)
}

export function generateOutboundBarcode(data: Partial<BarcodeItem>): Promise<ApiResponse<BarcodeItem[]>> {
  return post<BarcodeItem[]>('/barcode/outbound/generate', data)
}

export function generateLogisticsBarcode(data: Partial<BarcodeItem>): Promise<ApiResponse<BarcodeItem[]>> {
  return post<BarcodeItem[]>('/barcode/logistics/generate', data)
}
