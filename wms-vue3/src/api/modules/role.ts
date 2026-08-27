/**
 * 模块：系统管理-角色管理（租客员工接口 tenant-roles）
 * 源接口：app/api/v1/endpoints/tenant_employee_management.py
 * 功能：角色创建、修改、查询列表、查询详情、搜索、删除、迁移
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface PermissionTreeNode {
  id: string
  label: string
  children?: PermissionTreeNode[]
  [key: string]: unknown
}

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

/** 获取当前租户可见权限，后端返回父子权限树。 */
export async function getVisiblePermissions(): Promise<ApiResponse<PermissionTreeNode[]>> {
  const res = await get<unknown>('/api/v1/tenant-employees/visible-permissions')
  const raw = res.data as any
  const menus = raw?.menus || raw?.data?.menus
  const source = Array.isArray(menus)
    ? menus.map((menu: any) => ({
        id: menu.menu_id ?? menu.id,
        label: menu.menu_name ?? menu.name ?? menu.label,
        children: (menu.buttons || []).map((button: any) => ({
          id: button.button_id ?? button.id,
          label: button.button_name ?? button.name ?? button.label,
          children: (button.permissions || button.permission_list || button.permission || []).map((permission: any) => ({
            id: permission.perm_code ?? permission.permission_id ?? permission.id,
            label: permission.perm_name ?? permission.permission_name ?? permission.name ?? permission.label,
          })),
        })),
      }))
    : Array.isArray(raw)
    ? raw
    : (raw?.permissions || raw?.permission || raw?.list || raw?.data || [])
  const normalize = (item: any): PermissionTreeNode => {
    const id = item?.id ?? item?.permission_id ?? item?.value ?? item?.code
    const label = item?.label ?? item?.name ?? item?.permission_name ?? item?.title ?? String(id ?? '')
    const children = Array.isArray(item?.children) ? item.children.map(normalize) : undefined
    return children?.length ? { ...item, id: String(id), label: String(label), children } : { ...item, id: String(id), label: String(label) }
  }
  return { ...res, data: Array.isArray(source) ? source.map(normalize) : [] }
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
  page_size?: number
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
  page_size?: number
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
