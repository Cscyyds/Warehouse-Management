/**
 * 模块：仓库管理
 * 表名：仓库/库位/货架信息表
 * 功能：库位、货位、塑料盒、货架绑定、批量打印
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface WarehouseItem {
  id: string
  code: string
  name: string
  type: string
  address: string
  contactPerson: string
  contactPhone: string
  areaSize: number
  sort: number
  status: string
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface LocationItem {
  id: string
  code: string
  name: string
  warehouseId: string
  warehouseName: string
  areaId: string
  areaName: string
  type: string
  shelfCount: number
  sort: number
  status: string
  remark: string
  createTime: string
  updateTime: string
}

export interface ShelfItem {
  id: string
  code: string
  name: string
  locationId: string
  locationName: string
  warehouseId: string
  warehouseName: string
  layer: number
  column: number
  maxCapacity: number
  usedCapacity: number
  sort: number
  status: string
  createTime: string
  updateTime: string
}

export interface PlasticBoxItem {
  id: string
  code: string
  rfid: string
  type: string
  spec: string
  warehouseId: string
  warehouseName: string
  locationId: string
  locationName: string
  shelfId: string
  shelfName: string
  status: string
  createTime: string
  updateTime: string
}

export interface WarehouseQueryParams {
  page: number
  pageSize: number
  code?: string
  name?: string
  type?: string
  status?: string
}

export interface LocationQueryParams {
  page: number
  pageSize: number
  warehouseId?: string
  code?: string
  name?: string
  type?: string
  status?: string
}

export interface ShelfQueryParams {
  page: number
  pageSize: number
  warehouseId?: string
  locationId?: string
  code?: string
  name?: string
  status?: string
}

export interface PlasticBoxQueryParams {
  page: number
  pageSize: number
  warehouseId?: string
  locationId?: string
  shelfId?: string
  code?: string
  rfid?: string
  type?: string
  status?: string
}

export interface WarehouseListResponse {
  list: WarehouseItem[]
  total: number
  page: number
  pageSize: number
}

export interface LocationListResponse {
  list: LocationItem[]
  total: number
  page: number
  pageSize: number
}

export interface ShelfListResponse {
  list: ShelfItem[]
  total: number
  page: number
  pageSize: number
}

export interface PlasticBoxListResponse {
  list: PlasticBoxItem[]
  total: number
  page: number
  pageSize: number
}

export function getWarehouseList(params: WarehouseQueryParams): Promise<ApiResponse<WarehouseListResponse>> {
  return get<WarehouseListResponse>('/warehouse/list', params as unknown as Record<string, unknown>)
}

export function getWarehouseDetail(id: string): Promise<ApiResponse<WarehouseItem>> {
  return get<WarehouseItem>(`/warehouse/${id}`)
}

export function createWarehouse(data: Partial<WarehouseItem>): Promise<ApiResponse<WarehouseItem>> {
  return post<WarehouseItem>('/warehouse', data)
}

export function updateWarehouse(id: string, data: Partial<WarehouseItem>): Promise<ApiResponse<WarehouseItem>> {
  return put<WarehouseItem>(`/warehouse/${id}`, data)
}

export function updateWarehouseStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/warehouse/${id}/status`, { status })
}

export function deleteWarehouse(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/warehouse/${id}`)
}

export function getLocationList(params: LocationQueryParams): Promise<ApiResponse<LocationListResponse>> {
  return get<LocationListResponse>('/warehouse/location/list', params as unknown as Record<string, unknown>)
}

export function getLocationDetail(id: string): Promise<ApiResponse<LocationItem>> {
  return get<LocationItem>(`/warehouse/location/${id}`)
}

export function createLocation(data: Partial<LocationItem>): Promise<ApiResponse<LocationItem>> {
  return post<LocationItem>('/warehouse/location', data)
}

export function updateLocation(id: string, data: Partial<LocationItem>): Promise<ApiResponse<LocationItem>> {
  return put<LocationItem>(`/warehouse/location/${id}`, data)
}

export function deleteLocation(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/warehouse/location/${id}`)
}

export function getShelfList(params: ShelfQueryParams): Promise<ApiResponse<ShelfListResponse>> {
  return get<ShelfListResponse>('/warehouse/shelf/list', params as unknown as Record<string, unknown>)
}

export function getShelfDetail(id: string): Promise<ApiResponse<ShelfItem>> {
  return get<ShelfItem>(`/warehouse/shelf/${id}`)
}

export function createShelf(data: Partial<ShelfItem>): Promise<ApiResponse<ShelfItem>> {
  return post<ShelfItem>('/warehouse/shelf', data)
}

export function updateShelf(id: string, data: Partial<ShelfItem>): Promise<ApiResponse<ShelfItem>> {
  return put<ShelfItem>(`/warehouse/shelf/${id}`, data)
}

export function deleteShelf(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/warehouse/shelf/${id}`)
}

export function getPlasticBoxList(params: PlasticBoxQueryParams): Promise<ApiResponse<PlasticBoxListResponse>> {
  return get<PlasticBoxListResponse>('/warehouse/plastic-box/list', params as unknown as Record<string, unknown>)
}

export function getPlasticBoxDetail(id: string): Promise<ApiResponse<PlasticBoxItem>> {
  return get<PlasticBoxItem>(`/warehouse/plastic-box/${id}`)
}

export function createPlasticBox(data: Partial<PlasticBoxItem>): Promise<ApiResponse<PlasticBoxItem>> {
  return post<PlasticBoxItem>('/warehouse/plastic-box', data)
}

export function updatePlasticBox(id: string, data: Partial<PlasticBoxItem>): Promise<ApiResponse<PlasticBoxItem>> {
  return put<PlasticBoxItem>(`/warehouse/plastic-box/${id}`, data)
}

export function deletePlasticBox(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/warehouse/plastic-box/${id}`)
}

export function bindShelfToBox(boxId: string, shelfId: string): Promise<ApiResponse<null>> {
  return post<null>('/warehouse/plastic-box/bind-shelf', { boxId, shelfId })
}

export function batchPrintShelfLabel(ids: string[]): Promise<ApiResponse<Blob>> {
  return post<Blob>('/warehouse/shelf/batch-print', { ids })
}

export function batchPrintBoxLabel(ids: string[]): Promise<ApiResponse<Blob>> {
  return post<Blob>('/warehouse/plastic-box/batch-print', { ids })
}
