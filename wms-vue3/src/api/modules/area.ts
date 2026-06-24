/**
 * 模块：系统设置-行政区划（租客员工接口 tenant-areas）
 * 源接口：app/api/v1/endpoints/tenant_employee_management.py
 * 功能：区划创建、修改、查询列表（树形）、查询详情、搜索、删除预览、删除
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 行政区划节点（query/search/detail 返回，含树形 children） */
export interface AreaItem {
  id: number
  area_id: string
  company_id: string
  area_code: string
  area_name: string
  parent_id: string
  parent_name: string | null
  area_type: string
  area_type_label: string | null
  sort_no: number
  status: number
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string | null
  updated_at: string | null
  deleted_flag: number
  children?: AreaItem[]
}

/** 区划列表响应（query/search 返回树形数组） */
export interface AreaListResponse {
  total: number
  area: AreaItem[]
}

/** 区划详情响应（detail 返回单棵树） */
export interface AreaDetailResponse {
  total: number
  area: AreaItem
}

/** 创建区划入参 */
export interface AreaCreatePayload {
  area_code: string
  area_name: string
  area_type: string
  sort_no?: number
  parent_id?: string
  status?: number
}

/** 修改区划入参 */
export interface AreaUpdatePayload {
  area_id: string
  area_code: string
  area_name: string
  parent_id: string
  area_type: string
  sort_no?: number
  status: number
}

/** 删除预览返回 */
export interface AreaDeletePreview {
  target: { id: string; name: string; type: string }
  cascade_items: { id: string; name: string; type: string }[]
  cascade_count: number
  summary: string
}

/** 将对象转为 x-www-form-urlencoded，过滤 undefined/null/空串 */
function toFormData(data: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value))
    }
  })
  return params
}

/** 查询行政区划列表（树形） */
export function getAreaList(params: {
  sort_by?: string
  sort_order?: string
  page?: number
}): Promise<ApiResponse<AreaListResponse>> {
  return get<AreaListResponse>('/api/v1/tenant-areas/query', params as unknown as Record<string, unknown>)
}

/** 查询行政区划详情 */
export function getAreaDetail(areaId: string): Promise<ApiResponse<AreaDetailResponse>> {
  return get<AreaDetailResponse>('/api/v1/tenant-areas/detail', { area_id: areaId })
}

/** 搜索行政区划（search_field/search_value 为 JSON 字符串） */
export function searchAreas(params: {
  search_field: string
  search_value: string
  sort_by?: string
  sort_order?: string
  page?: number
}): Promise<ApiResponse<AreaListResponse>> {
  return get<AreaListResponse>('/api/v1/tenant-areas/search', params as unknown as Record<string, unknown>)
}

/** 创建行政区划 */
export function createArea(data: AreaCreatePayload): Promise<ApiResponse<AreaItem>> {
  return post<AreaItem>('/api/v1/tenant-areas', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改行政区划 */
export function updateArea(areaId: string, data: AreaUpdatePayload): Promise<ApiResponse<AreaItem>> {
  const payload = { ...data, area_id: areaId }
  return post<AreaItem>('/api/v1/tenant-areas/update', toFormData(payload as unknown as Record<string, unknown>))
}

/** 删除行政区划 */
export function deleteArea(areaId: string): Promise<ApiResponse<{ area_id: string }>> {
  return post<{ area_id: string }>('/api/v1/tenant-areas/delete', toFormData({ area_id: areaId }))
}

/** 删除影响预览 */
export function previewDeleteArea(areaId: string): Promise<ApiResponse<AreaDeletePreview>> {
  return get<AreaDeletePreview>('/api/v1/tenant-areas/delete/preview', { area_id: areaId })
}

/**
 * 修改区划状态（先查详情再全量更新，保留旧签名兼容）
 */
export async function updateAreaStatus(areaId: string, status: number): Promise<ApiResponse<AreaItem>> {
  const detailRes = await getAreaDetail(areaId)
  const area = detailRes.data.area
  if (!area) throw new Error('区划不存在')
  return updateArea(areaId, {
    area_id: areaId,
    area_code: area.area_code,
    area_name: area.area_name,
    parent_id: area.parent_id,
    area_type: area.area_type,
    sort_no: area.sort_no,
    status,
  })
}
