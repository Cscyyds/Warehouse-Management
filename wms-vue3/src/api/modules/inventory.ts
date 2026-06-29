/**
 * 模块：库存管理
 * 表名：库存信息表
 * 功能：库存查看、产品跟踪、库存盘点
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface InventoryItem {
  id: string
  productId: string
  productCode: string
  productName: string
  productSpec: string
  productUnit: string
  categoryId: string
  categoryName: string
  warehouseId: string
  warehouseName: string
  locationId: string
  locationName: string
  shelfId: string
  shelfName: string
  batchNo: string
  quantity: number
  frozenQuantity: number
  availableQuantity: number
  costPrice: number
  totalCost: number
  createTime: string
  updateTime: string
}

export interface InventoryTrackItem {
  id: string
  productId: string
  productCode: string
  productName: string
  batchNo: string
  businessType: string
  businessNo: string
  direction: string
  quantity: number
  beforeQuantity: number
  afterQuantity: number
  warehouseId: string
  warehouseName: string
  locationId: string
  locationName: string
  shelfId: string
  shelfName: string
  operateUserId: string
  operateUserName: string
  operateTime: string
  remark: string
}

export interface InventoryCheckItem {
  id: string
  checkNo: string
  warehouseId: string
  warehouseName: string
  checkDate: string
  checkType: string
  status: string
  auditStatus: string
  totalCheck: number
  matchCount: number
  mismatchCount: number
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface InventoryCheckDetail {
  id: string
  checkId: string
  productId: string
  productCode: string
  productName: string
  spec: string
  unit: string
  batchNo: string
  systemQuantity: number
  actualQuantity: number
  diffQuantity: number
  remark: string
}

export interface InventoryQueryParams {
  page: number
  pageSize: number
  productId?: string
  productCode?: string
  productName?: string
  categoryId?: string
  warehouseId?: string
  locationId?: string
  shelfId?: string
  batchNo?: string
  sort_by?: string
  sort_order?: string
}

export interface InventoryTrackQueryParams {
  page: number
  pageSize: number
  productId?: string
  productCode?: string
  productName?: string
  batchNo?: string
  businessType?: string
  direction?: string
  warehouseId?: string
  startDate?: string
  endDate?: string
}

export interface InventoryCheckQueryParams {
  page: number
  pageSize: number
  checkNo?: string
  warehouseId?: string
  checkType?: string
  status?: string
  auditStatus?: string
  startDate?: string
  endDate?: string
  sort_by?: string
  sort_order?: string
}

export interface InventoryListResponse {
  list: InventoryItem[]
  total: number
  page: number
  pageSize: number
}

export interface InventoryTrackListResponse {
  list: InventoryTrackItem[]
  total: number
  page: number
  pageSize: number
}

export interface InventoryCheckListResponse {
  list: InventoryCheckItem[]
  total: number
  page: number
  pageSize: number
}

export function getInventoryList(params: InventoryQueryParams): Promise<ApiResponse<InventoryListResponse>> {
  return get<InventoryListResponse>('/inventory/list', params as unknown as Record<string, unknown>)
}

export function getInventoryDetail(id: string): Promise<ApiResponse<InventoryItem>> {
  return get<InventoryItem>(`/inventory/${id}`)
}

export function getInventoryTrackList(params: InventoryTrackQueryParams): Promise<ApiResponse<InventoryTrackListResponse>> {
  return get<InventoryTrackListResponse>('/inventory/track/list', params as unknown as Record<string, unknown>)
}

export function getInventoryCheckList(params: InventoryCheckQueryParams): Promise<ApiResponse<InventoryCheckListResponse>> {
  return get<InventoryCheckListResponse>('/inventory/check/list', params as unknown as Record<string, unknown>)
}

export function getInventoryCheckDetail(id: string): Promise<ApiResponse<InventoryCheckItem & { details: InventoryCheckDetail[] }>> {
  return get<InventoryCheckItem & { details: InventoryCheckDetail[] }>(`/inventory/check/${id}`)
}

export function createInventoryCheck(data: Partial<InventoryCheckItem>): Promise<ApiResponse<InventoryCheckItem>> {
  return post<InventoryCheckItem>('/inventory/check', data)
}

export function updateInventoryCheck(id: string, data: Partial<InventoryCheckItem> & { details: Partial<InventoryCheckDetail>[] }): Promise<ApiResponse<InventoryCheckItem>> {
  return put<InventoryCheckItem>(`/inventory/check/${id}`, data)
}

export function auditInventoryCheck(id: string, auditStatus: string, auditOpinion: string): Promise<ApiResponse<null>> {
  return post<null>(`/inventory/check/${id}/audit`, { auditStatus, auditOpinion })
}

export function deleteInventoryCheck(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/inventory/check/${id}`)
}

export function exportInventory(params: InventoryQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/inventory/export', params as unknown as Record<string, unknown>)
}

export function exportInventoryTrack(params: InventoryTrackQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/inventory/track/export', params as unknown as Record<string, unknown>)
}
