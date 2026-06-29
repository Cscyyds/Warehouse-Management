/**
 * 模块：仓库管理（租客接口）
 * 源接口：app/api/v1/endpoints/tenant_wms_management.py
 * 功能：仓库 CRUD/查询/搜索/迁移区域，货位 CRUD/查询/搜索，塑料盒 CRUD/查询/搜索/迁移货位
 * 说明：写操作均为 application/x-www-form-urlencoded（toFormData）
 *      列表查询返回树形精简节点，详情返回完整字段
 */
import { get, post, toFormData } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

// ════════════════════════════════════════════════════════════════════════════
// 仓库（Warehouse）
// ════════════════════════════════════════════════════════════════════════════

/** 仓库完整对象（detail/create/update 返回） */
export interface WarehouseItem {
  warehouse_id: string
  warehouse_no: string
  warehouse_name: string
  warehouse_region: string
  warehouse_region_label: string
  area_id: string
  area_name: string
  warehouse_type: string
  warehouse_type_label: string
  warehouse_address: string
  contact_name: string
  contact_phone: string
  status: number
  remark: string | null
  created_at: string
  updated_at: string
  created_by: string
  created_by_name: string
}

/** 仓库树节点（query 返回，精简字段） */
export interface WarehouseTreeNode {
  warehouse_id: string
  warehouse_name: string
  children?: WarehouseLocationTreeNode[]
}

/** 仓库树中的货位子节点 */
export interface WarehouseLocationTreeNode {
  location_id: string
  location_name: string
  children?: WarehouseLocationTreeNode[]
}

/** 仓库搜索树节点（search 返回，统一 id/name/status/type 格式） */
export interface WarehouseSearchNode {
  id: string
  name: string
  status: number
  type: string
  children?: WarehouseSearchNode[]
}

/** 仓库列表/查询响应（query/search） */
export interface WarehouseTreeResponse {
  total: number
  page: number
  page_size: number
  warehouse: WarehouseTreeNode[] | WarehouseSearchNode[]
}

/** 新增仓库入参 */
export interface WarehouseCreatePayload {
  warehouse_region: string
  area_id: string
  warehouse_name: string
  warehouse_no: string
  warehouse_type: string
  warehouse_address: string
  contact_name: string
  contact_phone: string
  status: string
  remark?: string
}

/** 修改仓库入参 */
export interface WarehouseUpdatePayload {
  warehouse_region?: string
  area_id?: string
  warehouse_name?: string
  warehouse_no?: string
  warehouse_type?: string
  warehouse_address?: string
  contact_name?: string
  contact_phone?: string
  status?: string
  remark?: string
}

/** 查询全部仓库及货位联级关系 */
export function getWarehouseTree(params?: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<WarehouseTreeResponse>> {
  return get<WarehouseTreeResponse>('/api/v1/tenant-warehouses/query', params as unknown as Record<string, unknown>)
}

/** 查询指定仓库详情 */
export function getWarehouseDetail(warehouseId: string): Promise<ApiResponse<WarehouseItem>> {
  return get<WarehouseItem>('/api/v1/tenant-warehouses/detail', { warehouse_id: warehouseId })
}

/** 搜索仓库（search_field/search_value 为 JSON 字符串） */
export function searchWarehouses(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<WarehouseTreeResponse>> {
  return get<WarehouseTreeResponse>('/api/v1/tenant-warehouses/search', params as unknown as Record<string, unknown>)
}

/** 新增仓库 */
export function createWarehouse(data: WarehouseCreatePayload): Promise<ApiResponse<WarehouseItem>> {
  return post<WarehouseItem>('/api/v1/tenant-warehouses', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改仓库 */
export function updateWarehouse(warehouseId: string, data: WarehouseUpdatePayload): Promise<ApiResponse<WarehouseItem>> {
  const payload = { ...data, warehouse_id: warehouseId }
  return post<WarehouseItem>('/api/v1/tenant-warehouses/update', toFormData(payload as unknown as Record<string, unknown>))
}

/** 删除仓库 */
export function deleteWarehouse(warehouseId: string): Promise<ApiResponse<{ warehouse_id: string }>> {
  return post<{ warehouse_id: string }>('/api/v1/tenant-warehouses/delete', toFormData({ warehouse_id: warehouseId }))
}

/** 仓库删除影响预览 */
export function previewWarehouseDelete(warehouseId: string): Promise<ApiResponse<Record<string, unknown>>> {
  return get<Record<string, unknown>>('/api/v1/tenant-warehouses/delete/preview', { warehouse_id: warehouseId })
}

/** 仓库一键迁移区域 */
export function migrateWarehouseArea(data: {
  source_area_id: string
  change_message: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return post<Record<string, unknown>>('/api/v1/tenant-warehouses/migrate-area', toFormData(data as unknown as Record<string, unknown>))
}

// ════════════════════════════════════════════════════════════════════════════
// 货位（Location）
// ════════════════════════════════════════════════════════════════════════════

/** 货位完整对象（detail/create/update 返回） */
export interface LocationItem {
  location_id: string
  location_no: string
  location_name: string
  simple_code: string
  location_type: string
  location_type_label: string
  parent_id: string
  parent_type: string
  parent_name: string
  location_desc: string
  sort_no: number
  status: number
  remark: string | null
  created_at: string
  updated_at: string
  created_by: string
  created_by_name: string
}

/** 货位搜索树节点（search 返回） */
export interface LocationSearchNode {
  id: string
  name: string
  status: number
  type: string
  children?: LocationSearchNode[]
}

/** 货位搜索响应 */
export interface LocationSearchResponse {
  total: number
  page: number
  page_size: number
  location: LocationSearchNode[]
}

/** 新增货位入参 */
export interface LocationCreatePayload {
  parent_id: string
  location_no: string
  location_name: string
  simple_code: string
  location_type: string
  location_desc: string
  status: string
  sort_no: string
  remark?: string
}

/** 修改货位入参 */
export interface LocationUpdatePayload {
  parent_id?: string
  location_no?: string
  location_name?: string
  simple_code?: string
  location_type?: string
  location_desc?: string
  status?: string
  sort_no?: string
  remark?: string
}

/** 查询指定货位详情 */
export function getLocationDetail(locationId: string): Promise<ApiResponse<LocationItem>> {
  return get<LocationItem>('/api/v1/tenant-locations/detail', { location_id: locationId })
}

/** 搜索货位（search_field/search_value 为 JSON 字符串） */
export function searchLocations(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<LocationSearchResponse>> {
  return get<LocationSearchResponse>('/api/v1/tenant-locations/search', params as unknown as Record<string, unknown>)
}

/** 新增货位 */
export function createLocation(data: LocationCreatePayload): Promise<ApiResponse<LocationItem>> {
  return post<LocationItem>('/api/v1/tenant-locations', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改货位 */
export function updateLocation(locationId: string, data: LocationUpdatePayload): Promise<ApiResponse<LocationItem>> {
  const payload = { ...data, location_id: locationId }
  return post<LocationItem>('/api/v1/tenant-locations/update', toFormData(payload as unknown as Record<string, unknown>))
}

/** 删除货位 */
export function deleteLocation(locationId: string): Promise<ApiResponse<{ location_id: string }>> {
  return post<{ location_id: string }>('/api/v1/tenant-locations/delete', toFormData({ location_id: locationId }))
}

/** 货位删除影响预览 */
export function previewLocationDelete(locationId: string): Promise<ApiResponse<Record<string, unknown>>> {
  return get<Record<string, unknown>>('/api/v1/tenant-locations/delete/preview', { location_id: locationId })
}

// ════════════════════════════════════════════════════════════════════════════
// 塑料盒（Plastic Box）
// ════════════════════════════════════════════════════════════════════════════

/** 塑料盒完整对象（query/detail/create/update 返回） */
export interface PlasticBoxItem {
  box_id: string
  box_name: string
  box_code: string
  location_id: string
  location_name: string
  floor_no: number
  position_no: number
  remark: string | null
  created_at: string
  updated_at: string
  created_by: string
  created_by_name: string
}

/** 塑料盒列表响应（query/search） */
export interface PlasticBoxListResponse {
  total: number
  page: number
  page_size: number
  items: PlasticBoxItem[]
}

/** 塑料盒查询参数 */
export interface PlasticBoxQueryParams {
  page?: number
  location_id?: string
  sort_by?: string
  sort_order?: string
}

/** 新增塑料盒入参 */
export interface PlasticBoxCreatePayload {
  box_name: string
  box_code: string
  location_id: string
  floor_no: number
  position_no: number
  remark?: string
}

/** 修改塑料盒入参 */
export interface PlasticBoxUpdatePayload {
  box_name?: string
  box_code?: string
  location_id?: string
  floor_no?: number
  position_no?: number
  remark?: string
}

/** 查看塑料盒列表 */
export function getPlasticBoxList(params: PlasticBoxQueryParams): Promise<ApiResponse<PlasticBoxListResponse>> {
  return get<PlasticBoxListResponse>('/api/v1/tenant-plastic-boxes/query', params as unknown as Record<string, unknown>)
}

/** 查看指定塑料盒信息 */
export function getPlasticBoxDetail(boxId: string): Promise<ApiResponse<PlasticBoxItem>> {
  return get<PlasticBoxItem>('/api/v1/tenant-plastic-boxes/detail', { box_id: boxId })
}

/** 搜索塑料盒（search_field/search_value 为 JSON 字符串） */
export function searchPlasticBoxes(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<PlasticBoxListResponse>> {
  return get<PlasticBoxListResponse>('/api/v1/tenant-plastic-boxes/search', params as unknown as Record<string, unknown>)
}

/** 新建塑料盒 */
export function createPlasticBox(data: PlasticBoxCreatePayload): Promise<ApiResponse<PlasticBoxItem>> {
  return post<PlasticBoxItem>('/api/v1/tenant-plastic-boxes', toFormData(data as unknown as Record<string, unknown>))
}

/** 更改塑料盒信息 */
export function updatePlasticBox(boxId: string, data: PlasticBoxUpdatePayload): Promise<ApiResponse<PlasticBoxItem>> {
  const payload = { ...data, box_id: boxId }
  return post<PlasticBoxItem>('/api/v1/tenant-plastic-boxes/update', toFormData(payload as unknown as Record<string, unknown>))
}

/** 删除塑料盒 */
export function deletePlasticBox(boxId: string): Promise<ApiResponse<{ box_id: string }>> {
  return post<{ box_id: string }>('/api/v1/tenant-plastic-boxes/delete', toFormData({ box_id: boxId }))
}

/** 塑料盒一键迁移货位 */
export function migratePlasticBoxLocation(data: {
  box_ids: string
  target_location_id: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return post<Record<string, unknown>>('/api/v1/tenant-plastic-boxes/migrate-location', toFormData(data as unknown as Record<string, unknown>))
}

// ════════════════════════════════════════════════════════════════════════════
// 联级关系查询
// ════════════════════════════════════════════════════════════════════════════

/** 查询仓库或货位下级联级关系 */
export function getWmsAssociation(params: {
  parent_id: string
  status?: number
}): Promise<ApiResponse<Record<string, unknown>>> {
  return get<Record<string, unknown>>('/api/v1/tenant-wms/association/query', params as unknown as Record<string, unknown>)
}

// ════════════════════════════════════════════════════════════════════════════
// 兼容别名（保持 formConfigs.ts 旧导入不断裂）
// ════════════════════════════════════════════════════════════════════════════

/** @deprecated 使用 getLocationDetail */
export const getShelfDetail = getLocationDetail
/** @deprecated 使用 createLocation */
export const createShelf = createLocation
/** @deprecated 使用 updateLocation */
export const updateShelf = updateLocation
