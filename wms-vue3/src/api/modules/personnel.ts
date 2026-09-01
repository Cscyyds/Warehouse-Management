/**
 * 模块：系统管理-人事资料管理（租客员工接口 tenant-users）
 * 源接口：app/api/v1/endpoints/tenant_employee_management.py
 * 功能：员工创建、修改基本信息、删除、列表查询、详情、搜索
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse, RequestConfig } from '@/utils/request'
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
  avatar_url?: string | null
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

/** 管理端修改员工基本信息入参（联系方式不属于人事编辑权限） */
export interface ManagedUserUpdatePayload {
  target_user_id: string
  user_name?: string
  org_id?: string
  post_id?: string
  role_id?: string
  user_type?: string
  sort_no?: number
  status?: number
}

/** 本人修改个人基础资料入参（联系方式仅用于首次绑定） */
export interface SelfProfileUpdatePayload {
  target_user_id: string
  user_name?: string
  email?: string
  mobile?: string
}

/** @deprecated 请根据调用场景使用 ManagedUserUpdatePayload 或 SelfProfileUpdatePayload */
export type UserUpdatePayload = ManagedUserUpdatePayload | SelfProfileUpdatePayload

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

/** 查询员工详情（编辑回显用，返回含 email/mobile 的完整字段） */
export function getUserDetail(params: {
  org_id: string
  user_id: string
}): Promise<ApiResponse<{ total: number; org_code: string; name: string; user: UserItem[] }>> {
  return get<{ total: number; org_code: string; name: string; user: UserItem[] }>(
    '/api/v1/tenant-users/detail',
    params as unknown as Record<string, unknown>,
  )
}

/** 查询员工列表 */
export function getUserList(params: {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
  org_id?: string
}, config?: RequestConfig): Promise<ApiResponse<UserListResponse>> {
  return get<UserListResponse>('/api/v1/tenant-users/query', params as unknown as Record<string, unknown>, config)
}


/** 搜索员工（search_field/search_value 为 JSON 字符串） */
export function searchUsers(params: {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
  org_id?: string
}, config?: RequestConfig): Promise<ApiResponse<UserListResponse>> {
  return get<UserListResponse>('/api/v1/tenant-users/search', params as unknown as Record<string, unknown>, config)
}

/**
 * 获取当前登录员工自身信息（GET /tenant-users/me）。
 * 仅校验登录身份与租户状态，无需员工管理接口权限——个人中心等"自身数据"场景
 * 必须用本接口，不能用 tenant-users/search（员工管理权限）读自己的信息。
 * data 为单个员工对象（字段与 /tenant-users/detail 的 user 单条一致）。
 */
export function getMyProfile(): Promise<ApiResponse<UserItem>> {
  return get<UserItem>('/api/v1/tenant-users/me')
}

/** 创建员工 */
export function createUser(data: UserCreatePayload): Promise<ApiResponse<UserItem>> {
  return post<UserItem>('/api/v1/tenant-users', toFormData(data as unknown as Record<string, unknown>))
}

function postUserProfileUpdate(data: UserUpdatePayload): Promise<ApiResponse<UserItem>> {
  return post<UserItem>('/api/v1/tenant-users/profile/update', toFormData(data as unknown as Record<string, unknown>))
}

/** 管理端修改员工基本信息 */
export function updateManagedUser(data: ManagedUserUpdatePayload): Promise<ApiResponse<UserItem>> {
  return postUserProfileUpdate(data)
}

/** 本人修改个人基础资料（邮箱/手机号仅允许首次绑定） */
export function updateMyProfile(data: SelfProfileUpdatePayload): Promise<ApiResponse<UserItem>> {
  return postUserProfileUpdate(data)
}

/** @deprecated 请根据调用场景使用 updateManagedUser 或 updateMyProfile */
export function updateUserProfile(data: UserUpdatePayload): Promise<ApiResponse<UserItem>> {
  return postUserProfileUpdate(data)
}

export function uploadUserAvatar(file: File): Promise<ApiResponse<{ avatar_url: string }>> {
  return post<{ avatar_url: string }>(
    '/api/v1/tenant-users/avatar/upload',
    toMultipart({ avatar: file }),
  )
}

/** 修改员工私密信息（修改密码/手机号/邮箱，需先获取邮箱验证码） */
export function updateUserSecure(data: UserSecureUpdatePayload): Promise<ApiResponse<UserItem>> {
  return post<UserItem>('/api/v1/tenant-users/secure/update', toFormData(data as unknown as Record<string, unknown>))
}

/** 删除员工（软删除） */
export function deleteUser(userId: string): Promise<ApiResponse<{ user_id: string }>> {
  return post<{ user_id: string }>('/api/v1/tenant-users/delete', toFormData({ user_id: userId }))
}

/** 发送邮箱验证码 */
export function sendVerificationCode(params: {
  purpose: string
  captcha_id: string
  captcha_code: string
}): Promise<ApiResponse<{ email: string; purpose: string; expires_in_seconds: number }>> {
  return post('/api/v1/verification-codes/send', toFormData(params as unknown as Record<string, unknown>))
}

/** 获取图形验证码 */
export function getCaptcha(): Promise<ApiResponse<{ captcha_id: string; image_data: string; expires_in_seconds: number }>> {
  return get('/api/v1/captcha')
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
  page_size?: number
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


/** @deprecated 使用 createUser */
export function createPersonnel(data: Record<string, any>): Promise<ApiResponse<UserItem>> {
  return createUser(data as unknown as UserCreatePayload)
}

/** @deprecated 使用 updateManagedUser */
export function updatePersonnel(_id: string, data: Record<string, any>): Promise<ApiResponse<UserItem>> {
  // 兼容旧调用，但仍严格限制为管理端允许修改的字段，避免误传联系方式。
  return updateManagedUser({
    target_user_id: _id,
    user_name: data.user_name,
    org_id: data.org_id,
    post_id: data.post_id,
    role_id: data.role_id,
    user_type: data.user_type,
    sort_no: data.sort_no,
    status: data.status,
  })
}

/** @deprecated 使用 deleteUser */
export function deletePersonnel(id: string): Promise<ApiResponse<null>> {
  return deleteUser(id).then(res => ({ ...res, data: null as unknown as null }))
}

/** @deprecated 使用 updateManagedUser 修改 status */
export function updateUserStatus(id: string, status: string): Promise<ApiResponse<null>> {
  // 旧接口 status 是 "正常"/"停用" 字符串，新接口是 1/0 数字
  const numStatus = status === '正常' ? 1 : 0
  return updateManagedUser({ target_user_id: id, status: numStatus }).then(res => ({ ...res, data: null as unknown as null }))
}
