/**
 * 模块：临时放货货位（租客接口）
 * 源接口：09_租客员工_仓库管理.md 接口23-28
 * 功能：临时放货货位 CRUD/查询/搜索
 * 说明：写操作均为 application/x-www-form-urlencoded（toFormData）
 *       临时放货货位无状态字段（status），仅用 deleted_flag 控制有效性
 *       列表查询返回完整字段，无需批量调详情
 */
import { get, post, toFormData } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 临时放货货位完整对象 */
export interface StagingSpotItem {
  spot_id: string
  spot_name: string
  remark: string | null
  created_at: string
  created_by?: string
  created_by_name?: string
}

/** 列表/搜索响应 */
export interface StagingSpotListResponse {
  total: number
  page: number
  page_size: number
  items: StagingSpotItem[]
}

/** 查询参数 */
export interface StagingSpotQueryParams {
  page?: number
  sort_by?: string
  sort_order?: string
}

/** 新增入参 */
export interface StagingSpotCreatePayload {
  spot_name: string
  remark?: string
}

/** 修改入参 */
export interface StagingSpotUpdatePayload {
  spot_name?: string
  remark?: string
}

/** 查看临时放货货位列表（接口26） */
export function getStagingSpotList(params: StagingSpotQueryParams): Promise<ApiResponse<StagingSpotListResponse>> {
  return get<StagingSpotListResponse>('/api/v1/tenant-staging-spots/query', params as unknown as Record<string, unknown>)
}

/** 查看指定临时放货货位（接口27） */
export function getStagingSpotDetail(spotId: string): Promise<ApiResponse<StagingSpotItem>> {
  return get<StagingSpotItem>('/api/v1/tenant-staging-spots/detail', { spot_id: spotId })
}

/** 搜索临时放货货位（接口28） */
export function searchStagingSpots(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<StagingSpotListResponse>> {
  return get<StagingSpotListResponse>('/api/v1/tenant-staging-spots/search', params as unknown as Record<string, unknown>)
}

/** 新建临时放货货位（接口23） */
export function createStagingSpot(data: StagingSpotCreatePayload): Promise<ApiResponse<StagingSpotItem>> {
  return post<StagingSpotItem>('/api/v1/tenant-staging-spots', toFormData(data as unknown as Record<string, unknown>))
}

/** 更改临时放货货位（接口24） */
export function updateStagingSpot(spotId: string, data: StagingSpotUpdatePayload): Promise<ApiResponse<{ spot_id: string }>> {
  const payload = { ...data, spot_id: spotId }
  return post<{ spot_id: string }>('/api/v1/tenant-staging-spots/update', toFormData(payload as unknown as Record<string, unknown>))
}

/** 删除临时放货货位（接口25） */
export function deleteStagingSpot(spotId: string): Promise<ApiResponse<{ spot_id: string }>> {
  return post<{ spot_id: string }>('/api/v1/tenant-staging-spots/delete', toFormData({ spot_id: spotId }))
}
