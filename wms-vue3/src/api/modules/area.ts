/**
 * 模块：系统管理-区域预设
 * 表名：区域预设表
 * 功能：区域预设增删改查、树形结构查询、状态管理
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface AreaItem {
  id: string
  code: string
  name: string
  parentId: string
  type: string
  sort: number
  status: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
  children?: AreaItem[]
}

export interface AreaQueryParams {
  page: number
  pageSize: number
  code?: string
  name?: string
  type?: string
  status?: string
  parentId?: string
}

export interface AreaListResponse {
  list: AreaItem[]
  total: number
  page: number
  pageSize: number
}

export interface AreaTreeResponse {
  tree: AreaItem[]
}

export function getAreaList(params: AreaQueryParams): Promise<ApiResponse<AreaListResponse>> {
  return get<AreaListResponse>('/system/area/list', params as unknown as Record<string, unknown>)
}

export function getAreaTree(): Promise<ApiResponse<AreaTreeResponse>> {
  return get<AreaTreeResponse>('/system/area/tree')
}

export function getAreaDetail(id: string): Promise<ApiResponse<AreaItem>> {
  return get<AreaItem>(`/system/area/${id}`)
}

export function createArea(data: Partial<AreaItem>): Promise<ApiResponse<AreaItem>> {
  return post<AreaItem>('/system/area', data)
}

export function updateArea(id: string, data: Partial<AreaItem>): Promise<ApiResponse<AreaItem>> {
  return put<AreaItem>(`/system/area/${id}`, data)
}

export function updateAreaStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/system/area/${id}/status`, { status })
}

export function deleteArea(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/system/area/${id}`)
}
