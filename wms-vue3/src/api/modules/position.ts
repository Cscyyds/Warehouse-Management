/**
 * 模块：系统管理-岗位管理
 * 表名：组织下的岗位表
 * 功能：岗位信息增删改查、按组织查询、状态管理
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface PositionItem {
  id: string
  code: string
  name: string
  category: string
  orgId: string
  orgName?: string
  sort: number
  remark: string
  status: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface PositionQueryParams {
  page: number
  pageSize: number
  code?: string
  name?: string
  category?: string
  orgId?: string
  status?: string
}

export interface PositionListResponse {
  list: PositionItem[]
  total: number
  page: number
  pageSize: number
}

export function getPositionList(params: PositionQueryParams): Promise<ApiResponse<PositionListResponse>> {
  return get<PositionListResponse>('/system/position/list', params as unknown as Record<string, unknown>)
}

export function getPositionDetail(id: string): Promise<ApiResponse<PositionItem>> {
  return get<PositionItem>(`/system/position/${id}`)
}

export function createPosition(data: Partial<PositionItem>): Promise<ApiResponse<PositionItem>> {
  return post<PositionItem>('/system/position', data)
}

export function updatePosition(id: string, data: Partial<PositionItem>): Promise<ApiResponse<PositionItem>> {
  return put<PositionItem>(`/system/position/${id}`, data)
}

export function updatePositionStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/system/position/${id}/status`, { status })
}

export function deletePosition(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/system/position/${id}`)
}

export function getPositionByOrg(orgId: string): Promise<ApiResponse<PositionItem[]>> {
  return get<PositionItem[]>('/system/position/by-org', { orgId })
}
