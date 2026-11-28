/**
 * 模块：库存管理
 * 表名：库存信息表
 * 功能：旧库位库存/盘点页面封装；当前服务未提供这些路径。
 * tenant-inventory/products 是按产品聚合的库存口径，不能作为库位行或盘点单的替代。
 */
import { get } from '@/utils/request'
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
  page_size?: number
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
  page_size?: number
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
  page_size?: number
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
  page_size?: number
  pageSize: number
}

export interface InventoryTrackListResponse {
  list: InventoryTrackItem[]
  total: number
  page: number
  page_size?: number
  pageSize: number
}

export interface InventoryCheckListResponse {
  list: InventoryCheckItem[]
  total: number
  page: number
  page_size?: number
  pageSize: number
}

export function getInventoryList(params: InventoryQueryParams): Promise<ApiResponse<InventoryListResponse>> {
  return get<InventoryListResponse>('/inventory/list', params as unknown as Record<string, unknown>)
}

export function getInventoryCheckList(params: InventoryCheckQueryParams): Promise<ApiResponse<InventoryCheckListResponse>> {
  return get<InventoryCheckListResponse>('/inventory/check/list', params as unknown as Record<string, unknown>)
}

export function exportInventory(params: InventoryQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/inventory/export', params as unknown as Record<string, unknown>)
}
