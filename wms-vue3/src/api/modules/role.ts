/**
 * 模块：系统管理-角色管理
 * 表名：系统角色及其权限预设表
 * 功能：角色信息增删改查、状态管理、全部角色查询（用于下拉选择）
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface RoleItem {
  id: string
  code: string
  name: string
  sort: number
  isSystem: boolean
  userType: string
  dataScope: string
  businessScope: string
  status: string
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface RoleQueryParams {
  page: number
  pageSize: number
  code?: string
  name?: string
  status?: string
}

export interface RoleListResponse {
  list: RoleItem[]
  total: number
  page: number
  pageSize: number
}

export function getRoleList(params: RoleQueryParams): Promise<ApiResponse<RoleListResponse>> {
  return get<RoleListResponse>('/system/role/list', params as unknown as Record<string, unknown>)
}

export function getRoleDetail(id: string): Promise<ApiResponse<RoleItem>> {
  return get<RoleItem>(`/system/role/${id}`)
}

export function createRole(data: Partial<RoleItem>): Promise<ApiResponse<RoleItem>> {
  return post<RoleItem>('/system/role', data)
}

export function updateRole(id: string, data: Partial<RoleItem>): Promise<ApiResponse<RoleItem>> {
  return put<RoleItem>(`/system/role/${id}`, data)
}

export function updateRoleStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/system/role/${id}/status`, { status })
}

export function deleteRole(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/system/role/${id}`)
}

export function getRoleAll(): Promise<ApiResponse<RoleItem[]>> {
  return get<RoleItem[]>('/system/role/all')
}
