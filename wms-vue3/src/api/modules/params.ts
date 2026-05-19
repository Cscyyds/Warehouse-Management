/**
 * 模块：系统管理-自定义参数
 * 表名：系统自定义参数配置表
 * 功能：自定义参数增删改查、状态管理
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface ParamItem {
  id: string
  paramKey: string
  paramValue: string
  paramName: string
  groupName: string
  isSystem: boolean
  sort: number
  status: string
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface ParamQueryParams {
  page: number
  pageSize: number
  paramKey?: string
  paramName?: string
  groupName?: string
  status?: string
}

export interface ParamListResponse {
  list: ParamItem[]
  total: number
  page: number
  pageSize: number
}

export function getParamList(params: ParamQueryParams): Promise<ApiResponse<ParamListResponse>> {
  return get<ParamListResponse>('/system/param/list', params as unknown as Record<string, unknown>)
}

export function getParamDetail(id: string): Promise<ApiResponse<ParamItem>> {
  return get<ParamItem>(`/system/param/${id}`)
}

export function createParam(data: Partial<ParamItem>): Promise<ApiResponse<ParamItem>> {
  return post<ParamItem>('/system/param', data)
}

export function updateParam(id: string, data: Partial<ParamItem>): Promise<ApiResponse<ParamItem>> {
  return put<ParamItem>(`/system/param/${id}`, data)
}

export function updateParamStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/system/param/${id}/status`, { status })
}

export function deleteParam(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/system/param/${id}`)
}

export function clearParamCache(): Promise<ApiResponse<null>> {
  return post<null>('/system/param/clear-cache', {})
}
