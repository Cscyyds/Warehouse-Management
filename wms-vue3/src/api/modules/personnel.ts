/**
 * 模块：系统管理-人员管理
 * 表名：组织下的员工信息表
 * 功能：员工信息增删改查、状态管理、批量操作（导入/导出/启停/删除）
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface UserItem {
  id: string
  account: string
  password?: string
  nickname: string
  name: string
  orgId: string
  orgName: string
  companyId: string
  companyName: string
  positionId: string
  positionName?: string
  roleId: string
  roleName?: string
  email: string
  phone: string
  officePhone: string
  sort: number
  status: string
  lastLoginIp: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
  remark?: string
}

export interface PersonnelQueryParams {
  page: number
  pageSize: number
  account?: string
  nickname?: string
  name?: string
  phone?: string
  status?: string
  orgId?: string
  roleId?: string
  positionId?: string
}

export interface PersonnelListResponse {
  list: UserItem[]
  total: number
  page: number
  pageSize: number
}

export function getPersonnelList(params: PersonnelQueryParams): Promise<ApiResponse<PersonnelListResponse>> {
  return get<PersonnelListResponse>('/system/personnel/list', params as unknown as Record<string, unknown>)
}

export function getPersonnelDetail(id: string): Promise<ApiResponse<UserItem>> {
  return get<UserItem>(`/system/personnel/${id}`)
}

export function createPersonnel(data: Partial<UserItem>): Promise<ApiResponse<UserItem>> {
  return post<UserItem>('/system/personnel', data)
}

export function updatePersonnel(id: string, data: Partial<UserItem>): Promise<ApiResponse<UserItem>> {
  return put<UserItem>(`/system/personnel/${id}`, data)
}

export function updateUserStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/system/personnel/${id}/status`, { status })
}

export function deletePersonnel(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/system/personnel/${id}`)
}

export function batchDeletePersonnel(ids: string[]): Promise<ApiResponse<null>> {
  return post<null>('/system/personnel/batch-delete', { ids })
}

export function batchUpdateStatus(ids: string[], status: string): Promise<ApiResponse<null>> {
  return put<null>('/system/personnel/batch-status', { ids, status })
}

export function importPersonnel(file: FormData): Promise<ApiResponse<{ success: number; fail: number }>> {
  return post<{ success: number; fail: number }>('/system/personnel/import', file)
}

export function exportPersonnel(params: PersonnelQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/system/personnel/export', params as unknown as Record<string, unknown>)
}
