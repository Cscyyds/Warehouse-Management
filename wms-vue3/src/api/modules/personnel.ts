/**
 * 模块：系统管理-人事资料管理（租客员工接口 tenant-users）
 * 源接口：app/api/v1/endpoints/tenant_employee_management.py
 * 功能：员工创建、修改基本信息、删除、列表查询、详情、搜索
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'
import { getTenantEnumMappings } from './organization'

/** 员工列表项（query/search 接口返回） */
export interface UserItem {
  user_id: string
  user_name: string
  login_name: string
  company_id: string
  company_name: string
  org_id: string
  org_name: string
  post_id: string
  post_name: string
  role_id: string
  role_name: string
  role_type: string
  is_system_role: number
  user_type: string
  user_type_label: string
  status: number
  post_category: string
  created_at: string
  /** 详情接口额外返回 */
  mobile?: string
  email?: string
  sort_no?: number
}

/** 员工列表响应 */
export interface UserListResponse {
  total: number
  user: UserItem[]
}

/** 创建员工入参 */
export interface UserCreatePayload {
  org_id: string
  post_id: string
  user_name: string
  password: string
  role_id: string
  mobile?: string
  email?: string
  sort_no: number
  user_type?: string
  status: number
}

/** 修改员工基本信息入参 */
export interface UserUpdatePayload {
  target_user_id: string
  user_name?: string
  org_id?: string
  post_id?: string
  role_id?: string
  user_type?: string
  sort_no?: number
  status?: number
}

/** 修改员工私密信息入参（修改密码/手机号/邮箱，需邮箱验证码） */
export interface UserSecureUpdatePayload {
  /** 修改对象名称：password / iphone / email */
  field_name: string
  /** 新值 */
  value: string
  /** 邮箱验证码 */
  verification_code: string
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

/** 查询员工列表 */
export function getUserList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
  org_id?: string
}): Promise<ApiResponse<UserListResponse>> {
  return get<UserListResponse>('/api/v1/tenant-users/query', params as unknown as Record<string, unknown>)
}

/** 查询员工详情 */
export function getUserDetail(userId: string): Promise<ApiResponse<UserItem>> {
  return get<UserItem>('/api/v1/tenant-users/detail', { user_id: userId })
}

/** 搜索员工（search_field/search_value 为 JSON 字符串） */
export function searchUsers(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
  org_id?: string
}): Promise<ApiResponse<UserListResponse>> {
  return get<UserListResponse>('/api/v1/tenant-users/search', params as unknown as Record<string, unknown>)
}

/** 创建员工 */
export function createUser(data: UserCreatePayload): Promise<ApiResponse<UserItem>> {
  return post<UserItem>('/api/v1/tenant-users', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改员工基本信息 */
export function updateUserProfile(data: UserUpdatePayload): Promise<ApiResponse<UserItem>> {
  return post<UserItem>('/api/v1/tenant-users/profile/update', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改员工私密信息（修改密码/手机号/邮箱，需先获取邮箱验证码） */
export function updateUserSecure(data: UserSecureUpdatePayload): Promise<ApiResponse<UserItem>> {
  return post<UserItem>('/api/v1/tenant-users/secure/update', toFormData(data as unknown as Record<string, unknown>))
}

/** 删除员工（软删除） */
export function deleteUser(userId: string): Promise<ApiResponse<{ user_id: string }>> {
  return post<{ user_id: string }>('/api/v1/tenant-users/delete', toFormData({ user_id: userId }))
}

/** 获取用户类型下拉选项（USER_TYPE_MAPPING，value 用 standard_value 以保证新建/编辑/搜索回显一致） */
export async function getUserTypeOptions(): Promise<{ label: string; value: string }[]> {
  const res = await getTenantEnumMappings('USER_TYPE_MAPPING')
  const items = res.data.items || []
  const map = new Map<string, { label: string; value: string }>()
  // 按 sort_no 排序，以 standard_value 去重，优先取 is_canonical=1 的展示名
  const sorted = [...items].sort((a, b) => a.sort_no - b.sort_no)
  for (const i of sorted) {
    const key = i.standard_value
    if (!key) continue
    if (!map.has(key) || i.is_canonical === 1) {
      map.set(key, { label: i.display_label, value: i.standard_value })
    }
  }
  return Array.from(map.values())
}

/* ---- 向后兼容别名（供 AdminSelectDialog 等旧组件使用） ---- */

/** @deprecated 使用 getUserList */
export async function getPersonnelList(params: {
  page?: number
  pageSize?: number
  account?: string
  name?: string
  phone?: string
  status?: string
  orgId?: string
  roleId?: string
  positionId?: string
}): Promise<ApiResponse<{ list: UserItem[]; total: number; page: number; pageSize: number }>> {
  // 旧调用方传 account/name/phone 等，映射到 search 接口
  const searchFields: string[] = []
  const searchValue: Record<string, string> = {}
  if (params.account) { searchFields.push('login_name'); searchValue['login_name'] = params.account }
  if (params.name) { searchFields.push('user_name'); searchValue['user_name'] = params.name }
  if (params.phone) { searchFields.push('mobile'); searchValue['mobile'] = params.phone }

  let res: ApiResponse<UserListResponse>
  if (searchFields.length > 0) {
    res = await searchUsers({
      search_field: JSON.stringify(searchFields),
      search_value: JSON.stringify(searchValue),
      page: params.page || 1,
      org_id: params.orgId,
    })
  } else {
    res = await getUserList({
      page: params.page || 1,
      org_id: params.orgId,
    })
  }
  // 将新结构 { total, user } 转为旧结构 { list, total, page, pageSize }
  return {
    ...res,
    data: {
      list: res.data.user || [],
      total: res.data.total,
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    },
  }
}

/** @deprecated 使用 getUserDetail */
export async function getPersonnelDetail(id: string): Promise<ApiResponse<UserItem>> {
  return getUserDetail(id)
}

/** @deprecated 使用 createUser */
export function createPersonnel(data: Record<string, any>): Promise<ApiResponse<UserItem>> {
  return createUser(data as unknown as UserCreatePayload)
}

/** @deprecated 使用 updateUserProfile */
export function updatePersonnel(_id: string, data: Record<string, any>): Promise<ApiResponse<UserItem>> {
  // 旧接口用 id 作为第一参数，新接口用 target_user_id
  return updateUserProfile({ target_user_id: _id, ...(data as object) } as unknown as UserUpdatePayload)
}

/** @deprecated 使用 deleteUser */
export function deletePersonnel(id: string): Promise<ApiResponse<null>> {
  return deleteUser(id).then(res => ({ ...res, data: null as unknown as null }))
}

/** @deprecated 使用 updateUserProfile 修改 status */
export function updateUserStatus(id: string, status: string): Promise<ApiResponse<null>> {
  // 旧接口 status 是 "正常"/"停用" 字符串，新接口是 1/0 数字
  const numStatus = status === '正常' ? 1 : 0
  return updateUserProfile({ target_user_id: id, status: numStatus }).then(res => ({ ...res, data: null as unknown as null }))
}
