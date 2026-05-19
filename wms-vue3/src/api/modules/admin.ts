import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface AdminItem {
  id: string
  account: string
  nickname: string
  email: string
  phone: string
  officePhone: string
  status: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface AdminQueryParams {
  page: number
  pageSize: number
  account?: string
  nickname?: string
  status?: string
}

export interface AdminListResponse {
  list: AdminItem[]
  total: number
  page: number
  pageSize: number
}

export function getAdminList(params: AdminQueryParams): Promise<ApiResponse<AdminListResponse>> {
  return get<AdminListResponse>('/system/admin/list', params as unknown as Record<string, unknown>)
}

export function getAdminDetail(id: string): Promise<ApiResponse<AdminItem>> {
  return get<AdminItem>(`/system/admin/${id}`)
}

export function createAdmin(data: Partial<AdminItem>): Promise<ApiResponse<AdminItem>> {
  return post<AdminItem>('/system/admin', data)
}

export function updateAdmin(id: string, data: Partial<AdminItem>): Promise<ApiResponse<AdminItem>> {
  return put<AdminItem>(`/system/admin/${id}`, data)
}

export function updateAdminStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/system/admin/${id}/status`, { status })
}

export function deleteAdmin(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/system/admin/${id}`)
}
