/**
 * 模块：系统管理-二级管理员（租客员工接口 tenant-admin-users）
 * 源接口：app/api/v1/endpoints/tenant_employee_management.py
 * 功能：二级管理员列表查询、搜索
 * 说明：查询/搜索均为 GET 请求，search_field/search_value 为 JSON 字符串
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'
import type { UserItem } from './personnel'

/** 二级管理员列表响应 */
export interface AdminListResponse {
  total: number
  user: UserItem[]
}

/** 向后兼容类型别名 */
export type AdminItem = UserItem

/** 查询二级管理员列表 */
export function getAdminList(params: {
  sort_by?: string
  sort_order?: string
  page?: number
}): Promise<ApiResponse<AdminListResponse>> {
  return get<AdminListResponse>('/api/v1/tenant-admin-users', params as unknown as Record<string, unknown>)
}

/** 搜索二级管理员（search_field/search_value 为 JSON 字符串） */
export function searchAdmins(params: {
  search_field: string
  search_value: string
  sort_by?: string
  sort_order?: string
  page?: number
}): Promise<ApiResponse<AdminListResponse>> {
  return get<AdminListResponse>('/api/v1/tenant-admin-users/search', params as unknown as Record<string, unknown>)
}

/* ---- 以下为旧接口，后端尚未提供对应端点，暂保留避免编译错误 ---- */

/** @deprecated 旧接口，后端就绪后替换 */
export function getAdminDetail(id: string): Promise<ApiResponse<UserItem>> {
  return get<UserItem>(`/api/v1/tenant-admin-users/detail`, { user_id: id })
}

/** @deprecated 旧接口，后端就绪后替换 */
export function createAdmin(data: Partial<UserItem>): Promise<ApiResponse<UserItem>> {
  return post<UserItem>('/api/v1/tenant-admin-users', data)
}

/** @deprecated 旧接口，后端就绪后替换 */
export function updateAdmin(id: string, data: Partial<UserItem>): Promise<ApiResponse<UserItem>> {
  return put<UserItem>(`/api/v1/tenant-admin-users/${id}`, data)
}

/** @deprecated 旧接口，后端就绪后替换 */
export function updateAdminStatus(id: string, status: number): Promise<ApiResponse<null>> {
  return put<null>(`/api/v1/tenant-admin-users/${id}/status`, { status })
}

/** @deprecated 旧接口，后端就绪后替换 */
export function deleteAdmin(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/api/v1/tenant-admin-users/${id}`)
}

/** @deprecated 旧接口，后端就绪后替换 */
export function batchCreateAdmin(data: Partial<UserItem>[]): Promise<ApiResponse<null>> {
  return post<null>('/api/v1/tenant-admin-users/batch', data)
}
