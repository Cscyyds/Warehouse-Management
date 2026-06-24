/**
 * 模块：系统管理-角色管理（租客员工接口 tenant-roles）
 * 源接口：app/api/v1/endpoints/tenant_employee_management.py
 * 功能：角色创建、修改、查询列表、查询详情、搜索、删除、迁移
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 角色列表项（query/search/detail 接口返回） */
export interface RoleItem {
  id: number
  company_id: string
  role_code: string
  role_name: string
  role_type: string
  role_type_label: string
  is_system: number
  sort_no: number
  remark: string | null
  status: number
  permission_id: string | string[] | null
  permission_name: string | string[] | null
}

export interface RoleListResponse {
  total: number
  role: RoleItem[]
}

export interface RoleDetailResponse {
  total: number
  role: RoleItem[]
}

/** 创建角色入参 */
export interface RoleCreatePayload {
  role_name: string
  role_type: string
  sort_no: number
  status?: number
  remark?: string
  permission_id?: string
}

/** 修改角色入参 */
export interface RoleUpdatePayload {
  role_id: string
  role_name: string
  role_type: string
  permission_id: string
  sort_no?: number
  status: number
  remark?: string
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

/** 查询角色列表 */
export function getRoleList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<RoleListResponse>> {
  return get<RoleListResponse>('/api/v1/tenant-roles/query', params as unknown as Record<string, unknown>)
}

/** 查询角色详情 */
export function getRoleDetail(roleId: string): Promise<ApiResponse<RoleDetailResponse>> {
  return get<RoleDetailResponse>('/api/v1/tenant-roles/detail', { role_id: roleId })
}

/** 搜索角色（search_field/search_value 为 JSON 字符串） */
export function searchRoles(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<RoleListResponse>> {
  return get<RoleListResponse>('/api/v1/tenant-roles/search', params as unknown as Record<string, unknown>)
}

/** 创建角色（permission_id 为 JSON 数组字符串） */
export function createRole(data: RoleCreatePayload): Promise<ApiResponse<RoleItem>> {
  return post<RoleItem>('/api/v1/tenant-roles', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改角色 */
export function updateRole(roleId: string, data: RoleUpdatePayload): Promise<ApiResponse<RoleItem>> {
  const payload = { ...data, role_id: roleId }
  return post<RoleItem>('/api/v1/tenant-roles/update', toFormData(payload as unknown as Record<string, unknown>))
}

/** 删除角色 */
export function deleteRole(roleId: string): Promise<ApiResponse<{ role_id: string }>> {
  return post<{ role_id: string }>('/api/v1/tenant-roles/delete', toFormData({ role_id: roleId }))
}

/** 角色迁移（change_message 为 JSON 数组字符串） */
export function migrateRole(data: {
  source_role_id: string
  change_message: string
}): Promise<ApiResponse<null>> {
  return post<null>('/api/v1/tenant-roles/migrate', toFormData(data as unknown as Record<string, unknown>))
}

/**
 * 修改角色状态（先查详情再全量更新，保留旧签名兼容）
 */
export async function updateRoleStatus(roleId: string, status: number): Promise<ApiResponse<RoleItem>> {
  const detailRes = await getRoleDetail(roleId)
  const role = detailRes.data.role[0]
  if (!role) throw new Error('角色不存在')
  const permId = Array.isArray(role.permission_id) ? JSON.stringify(role.permission_id) : (role.permission_id || '')
  return updateRole(roleId, {
    role_id: roleId,
    role_name: role.role_name,
    role_type: role.role_type,
    permission_id: permId,
    sort_no: role.sort_no,
    status,
    remark: role.remark || undefined,
  })
}

/**
 * 获取全部角色（用于下拉选择）
 * 旧签名返回 RoleItem[]，供 personnel 表单等旧组件兼容使用。
 * 内部调用 getRoleList 并映射为 { id, name } 结构。
 */
export async function getRoleAll(): Promise<ApiResponse<{ id: string; name: string }[]>> {
  const res = await getRoleList({ page: 1, sort_order: 'ASC' })
  const items = (res.data.role || []).map(r => ({ id: r.role_code, name: r.role_name }))
  return { ...res, data: items }
}
