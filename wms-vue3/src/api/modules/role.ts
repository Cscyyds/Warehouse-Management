/**
 * 模块：系统管理-角色管理（租客员工接口 tenant-roles）
 * 源接口：app/api/v1/endpoints/tenant_employee_management.py
 * 功能：角色创建、修改、查询列表、查询详情、搜索、删除、迁移
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/**
 * 权限树节点。type 标记层级用途：
 *   menu   菜单（模块级，label=menu_name）—— 一级/二级导航可视化
 *   button 按钮（label=button_name）—— 三级操作按钮可视化（v-perm）
 *   perm   权限（id=perm_code）—— 角色绑定/按钮码集合
 */
export interface PermissionTreeNode {
  id: string
  label: string
  type?: 'menu' | 'button' | 'perm'
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

/**
 * 权限归属查询参数：wms-vue3 为 WMS 平台租客前端，默认查 WMS_PLATFORM 归属；
 * 两个接口均支持传 WMS_PLATFORM / WMS_SCANNER。
 */
const DEFAULT_PERMISSION_OWNER = 'WMS_PLATFORM'

/** 菜单节点：buttons 递归归一化（保留子按钮层级，权限叶子与子按钮并列） */
function normalizeMenuNode(menu: any): PermissionTreeNode {
  return {
    id: String(menu?.menu_id ?? menu?.id ?? ''),
    label: String(menu?.menu_name ?? menu?.name ?? menu?.label ?? ''),
    type: 'menu',
    children: (menu?.buttons || []).map(normalizeButtonNode),
  }
}

function normalizeButtonNode(button: any): PermissionTreeNode {
  // 按 perm_code 去重：后端 build_permission_tree 对「一条权限的 function_id 含多个同按钮 API」
  // 的数据会按 API 重复追加同一权限（扫码枪权限多为 API 数组，重复最明显），此处防御性过滤
  const permissionNodes: PermissionTreeNode[] = []
  const seenPermCodes = new Set<string>()
  for (const permission of (button?.permissions || button?.permission_list || button?.permission || [])) {
    const code = String(permission?.perm_code ?? permission?.permission_id ?? permission?.id ?? '')
    if (!code || seenPermCodes.has(code)) continue
    seenPermCodes.add(code)
    permissionNodes.push({
      id: code,
      label: String(permission?.perm_name ?? permission?.permission_name ?? permission?.name ?? permission?.label ?? ''),
      type: 'perm',
    })
  }
  const childButtons: PermissionTreeNode[] = (Array.isArray(button?.children) ? button.children : []).map(normalizeButtonNode)
  const children = [...permissionNodes, ...childButtons]
  return {
    id: String(button?.button_id ?? button?.id ?? ''),
    label: String(button?.button_name ?? button?.name ?? button?.label ?? ''),
    type: 'button',
    ...(children.length ? { children } : {}),
  }
}

/** 旧版平铺结构兜底归一化（现行后端已统一返回 menus 联级树，仅作容错） */
function normalizeLegacyNodes(items: any[]): PermissionTreeNode[] {
  if (!Array.isArray(items)) return []
  return items.map((item: any): PermissionTreeNode => {
    const id = item?.id ?? item?.permission_id ?? item?.value ?? item?.code
    const label = item?.label ?? item?.name ?? item?.permission_name ?? item?.title ?? String(id ?? '')
    const children = Array.isArray(item?.children) ? normalizeLegacyNodes(item.children) : undefined
    return children?.length ? { ...item, id: String(id), label: String(label), children } : { ...item, id: String(id), label: String(label) }
  })
}

/** 将后端「菜单 -> 按钮 -> 权限」联级结构（{total, menus}）归一化为前端树节点 */
function normalizePermissionResponse(res: ApiResponse<unknown>): ApiResponse<PermissionTreeNode[]> {
  const raw = res.data as any
  const menus = raw?.menus || raw?.data?.menus
  const source = Array.isArray(menus)
    ? menus.map(normalizeMenuNode)
    : normalizeLegacyNodes(Array.isArray(raw) ? raw : (raw?.permissions || raw?.permission || raw?.list || raw?.data || []))
  return { ...res, data: source }
}

/**
 * 获取当前租户可见权限全集（租客级，与登录人角色无关）。
 * 用于角色管理表单的权限绑定树：管理员需看到租客下全部可分配权限。
 */
export async function getVisiblePermissions(permissionOwner: string = DEFAULT_PERMISSION_OWNER): Promise<ApiResponse<PermissionTreeNode[]>> {
  const res = await get<unknown>('/api/v1/tenant-employees/visible-permissions', { permission_owner: permissionOwner })
  return normalizePermissionResponse(res)
}

/**
 * 获取当前登录员工个人可见权限（新接口）。
 * 管理员角色返回租客全部可见权限；普通角色仅返回其角色绑定的权限。
 * 用于登录后的页面级权限过滤（守卫/菜单可视化），实现"有权限的页面才允许进入"。
 */
export async function getMyPermissions(permissionOwner: string = DEFAULT_PERMISSION_OWNER): Promise<ApiResponse<PermissionTreeNode[]>> {
  const res = await get<unknown>('/api/v1/tenant-employees/my-permissions', { permission_owner: permissionOwner })
  return normalizePermissionResponse(res)
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
