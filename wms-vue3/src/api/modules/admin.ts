/**
 * 模块：系统管理-二级管理员（租客员工接口 tenant-admin-users）
 * 源接口：app/api/v1/endpoints/tenant_employee_management.py
 * 功能：二级管理员列表查询、搜索
 * 说明：查询/搜索均为 GET 请求，search_field/search_value 为 JSON 字符串
 *
 * 已移除（2026-09-17）：createAdmin / batchCreateAdmin。
 * 后端仅提供 GET list、GET search 两个端点，新增二级管理员的端点不存在，
 * 前端亦已下线新增入口（Admin.vue 的 :show-add="false"），相关调用链一并清理。
 */
import { get, put } from '@/utils/request'
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
  page_size?: number
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
  page_size?: number
}): Promise<ApiResponse<AdminListResponse>> {
  return get<AdminListResponse>('/api/v1/tenant-admin-users/search', params as unknown as Record<string, unknown>)
}

/* ---- 以下为旧接口，后端尚未提供对应端点，暂保留避免编译错误 ---- */

/** @deprecated 旧接口，后端就绪后替换 */
export function getAdminDetail(id: string): Promise<ApiResponse<UserItem>> {
  return get<UserItem>(`/api/v1/tenant-admin-users/detail`, { user_id: id })
}

/** @deprecated 旧接口，后端就绪后替换 */
export function updateAdmin(id: string, data: Partial<UserItem>): Promise<ApiResponse<UserItem>> {
  return put<UserItem>(`/api/v1/tenant-admin-users/${id}`, data)
}

/*
 * 删除/启停不再走 tenant-admin-users 专有端点（后端不存在 PUT /{id}/status、DELETE /{id}），
 * 统一复用人事资料的员工级接口（对象同为 SysUser）：
 *   - 删除：POST /api/v1/tenant-users/delete        → personnel.ts deleteUser
 *   - 启停：POST /api/v1/tenant-users/profile/update → personnel.ts updateManagedUser（target_user_id + status）
 * 详见 Admin.vue。
 */
