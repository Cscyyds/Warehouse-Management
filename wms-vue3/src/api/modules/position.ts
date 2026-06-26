/**
 * 模块：系统管理-岗位管理
 * 平台管理员创建岗位：POST /api/v1/platform-posts（文档 02 §9）
 * 租客员工岗位增删改查：tenant-posts/*（文档 03 §23-29）
 * 源接口：
 *   - app/api/v1/endpoints/platform_management.py（platform-posts）
 *   - app/api/v1/endpoints/tenant_employee_management.py（tenant-posts）
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'
import { getTenantEnumMappings } from './organization'

/** 岗位列表项（query/search/detail 返回） */
export interface PostItem {
  id: number
  company_id: string
  post_code: string
  post_name: string
  /** 岗位分类标准值（如 MIDDLE），由 POST_CATEGORY_MAPPING 映射得到 */
  post_category: string | null
  /** 岗位分类展示名（如 中层） */
  post_category_label: string | null
  sort_no: number
  remark: string | null
  /** 1 启用 / 0 停用 */
  status: number
}

/** 岗位列表/搜索响应（data: { total, post: [] }） */
export interface PostListResponse {
  total: number
  post: PostItem[]
}

/** 岗位详情响应（data: { total, post: [item] }，单条仍包在数组中） */
export interface PostDetailResponse {
  total: number
  post: PostItem[]
}

/** 平台管理员创建岗位入参（文档 02 §9，不含 status，后端默认 1） */
export interface PlatformPostCreatePayload {
  tenant_id: string
  post_name: string
  post_category?: string
  sort_no: number
  remark?: string
}

/** 租客员工创建岗位入参（文档 03 §23，不含 tenant_id（由登录 token 推导），不含 status（后端默认 1）） */
export interface TenantPostCreatePayload {
  post_name: string
  post_category?: string
  sort_no: number
  remark?: string
}

/** 租客员工修改岗位入参（文档 03 §24） */
export interface PostUpdatePayload {
  post_id: string
  post_name?: string
  post_category?: string
  sort_no?: number
  remark?: string
  status?: number
}

/** 岗位迁移入参（文档 03 §29） */
export interface PostMigratePayload {
  /** 将被迁出的源岗位业务ID（post_code） */
  source_post_id: string
  /** 迁移列表，JSON 数组字符串，格式：[{"change_user":["U001"],"new_post":"POST002"}] */
  change_message: string
}

/** 岗位迁移返回详情 */
export interface PostMigrateDetail {
  user_id: string
  user_name: string
  old_post_id: string
  old_post_name: string | null
  new_post_id: string
  new_post_name: string | null
}

/** 岗位迁移返回 */
export interface PostMigrateResponse {
  migrated_count: number
  details: PostMigrateDetail[]
}

/** 查询岗位列表参数 */
export interface PostQueryParams {
  page?: number
  sort_by?: string
  sort_order?: string
}

/** 搜索岗位参数（search_field/search_value 为 JSON 字符串） */
export interface PostSearchParams {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
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

/** 查询岗位列表（tenant-posts/query） */
export function getPostList(params: PostQueryParams): Promise<ApiResponse<PostListResponse>> {
  return get<PostListResponse>('/api/v1/tenant-posts/query', params as unknown as Record<string, unknown>)
}

/** 查询岗位详情（tenant-posts/detail） */
export function getPostDetail(postId: string): Promise<ApiResponse<PostDetailResponse>> {
  return get<PostDetailResponse>('/api/v1/tenant-posts/detail', { post_id: postId })
}

/** 搜索岗位（tenant-posts/search） */
export function searchPosts(params: PostSearchParams): Promise<ApiResponse<PostListResponse>> {
  return get<PostListResponse>('/api/v1/tenant-posts/search', params as unknown as Record<string, unknown>)
}

/** 平台管理员创建岗位（platform-posts，文档 02 §9，需 tenant_id） */
export function createPlatformPost(data: PlatformPostCreatePayload): Promise<ApiResponse<PostItem>> {
  return post<PostItem>('/api/v1/platform-posts', toFormData(data as unknown as Record<string, unknown>))
}

/** 租客员工创建岗位（tenant-posts，文档 03 §23，无需 tenant_id） */
export function createPost(data: TenantPostCreatePayload): Promise<ApiResponse<PostItem>> {
  return post<PostItem>('/api/v1/tenant-posts', toFormData(data as unknown as Record<string, unknown>))
}

/** 租客员工修改岗位（tenant-posts/update）
 *  注意：后端 post_category 为必填（创建时却可选），且无独立改状态接口；
 *  提交时若 post_category 为空则补 'OTHER'(其他)，避免无分类岗位 422。 */
export function updatePost(data: PostUpdatePayload): Promise<ApiResponse<PostItem>> {
  const payload = { ...data }
  if (payload.post_category === undefined || payload.post_category === null || payload.post_category === '') {
    payload.post_category = 'OTHER'
  }
  return post<PostItem>('/api/v1/tenant-posts/update', toFormData(payload as unknown as Record<string, unknown>))
}

/** 租客员工删除岗位（tenant-posts/delete） */
export function deletePost(postId: string): Promise<ApiResponse<null>> {
  return post<null>('/api/v1/tenant-posts/delete', toFormData({ post_id: postId }))
}

/** 岗位迁移（tenant-posts/migrate，将源岗位下的员工批量迁移到目标岗位） */
export function migratePost(data: PostMigratePayload): Promise<ApiResponse<PostMigrateResponse>> {
  return post<PostMigrateResponse>('/api/v1/tenant-posts/migrate', toFormData(data as unknown as Record<string, unknown>))
}

/** 获取岗位分类下拉选项（POST_CATEGORY_MAPPING，value 用 standard_value 以保证新建/编辑/搜索回显一致） */
export async function getPostCategoryOptions(): Promise<{ label: string; value: string }[]> {
  const res = await getTenantEnumMappings('POST_CATEGORY_MAPPING')
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

/* ===================================================================
 * 向后兼容（供 AdminSelectDialog / formConfigs 旧调用方使用）
 * 旧接口字段（id/code/name/category/sort/status 字符串）映射自新结构
 * =================================================================== */

/** 旧岗位项结构（下拉组件等使用，字段为前端旧命名） */
export interface PositionItem {
  id: string
  code: string
  name: string
  category: string
  orgId: string
  orgName?: string
  sort: number
  remark: string
  status: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface PositionQueryParams {
  page?: number
  pageSize?: number
  code?: string
  name?: string
  category?: string
  orgId?: string
  status?: string
}

export interface PositionListResponse {
  list: PositionItem[]
  total: number
  page: number
  pageSize: number
}

/** 新结构 → 旧结构字段映射 */
function mapPostToLegacy(p: PostItem): PositionItem {
  return {
    id: p.post_code,
    code: p.post_code,
    name: p.post_name,
    category: p.post_category_label || p.post_category || '',
    orgId: '',
    sort: p.sort_no,
    remark: p.remark || '',
    status: p.status === 1 ? '正常' : '停用',
    createTime: '',
    updateTime: '',
    createUserId: '',
    createUserName: '',
  }
}

/** @deprecated 使用 getPostList。返回旧结构 { list, total, page, pageSize } */
export async function getPositionList(params: PositionQueryParams = {}): Promise<ApiResponse<PositionListResponse>> {
  const page = params.page || 1
  const hasFilter = !!(params.name || params.code || params.category || params.status)
  let res: ApiResponse<PostListResponse>
  if (hasFilter) {
    const fields: string[] = []
    const values: Record<string, string | number> = {}
    if (params.name) { fields.push('post_name'); values.post_name = params.name }
    if (params.code) { fields.push('post_code'); values.post_code = params.code }
    if (params.category) { fields.push('post_category'); values.post_category = params.category }
    if (params.status) { fields.push('status'); values.status = params.status === '正常' ? 1 : 0 }
    res = await searchPosts({
      search_field: JSON.stringify(fields),
      search_value: JSON.stringify(values),
      page,
    })
  } else {
    res = await getPostList({ page })
  }
  const list = (res.data.post || []).map(mapPostToLegacy)
  return {
    ...res,
    data: { list, total: res.data.total, page, pageSize: params.pageSize || 20 },
  }
}

/** @deprecated 使用 getPostDetail */
export async function getPositionDetail(id: string): Promise<ApiResponse<PositionItem>> {
  const res = await getPostDetail(id)
  const post = res.data.post?.[0]
  return { ...res, data: post ? mapPostToLegacy(post) : ({} as PositionItem) }
}

/** @deprecated 使用 createPlatformPost */
export function createPosition(data: Partial<PositionItem>): Promise<ApiResponse<PostItem>> {
  return createPlatformPost({
    tenant_id: localStorage.getItem('company_id') || '',
    post_name: String(data.name ?? ''),
    post_category: data.category || undefined,
    sort_no: Number(data.sort ?? 0) || 0,
    remark: data.remark || undefined,
  })
}

/** @deprecated 使用 updatePost */
export function updatePosition(id: string, data: Partial<PositionItem>): Promise<ApiResponse<PostItem>> {
  return updatePost({
    post_id: id,
    post_name: data.name || undefined,
    post_category: data.category || undefined,
    sort_no: data.sort === undefined || data.sort === null ? undefined : Number(data.sort),
    remark: data.remark || undefined,
    status: data.status === undefined || data.status === null ? undefined : (data.status === '正常' ? 1 : 0),
  })
}

/** @deprecated 使用 updatePost 修改 status */
export function updatePositionStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return updatePost({ post_id: id, status: status === '正常' ? 1 : 0 }).then(res => ({ ...res, data: null as unknown as null }))
}

/** @deprecated 使用 deletePost */
export function deletePosition(id: string): Promise<ApiResponse<null>> {
  return deletePost(id)
}

/** @deprecated 旧“按组织查询岗位”无对应后端接口，返回当前租客全部岗位 */
export async function getPositionByOrg(_orgId: string): Promise<ApiResponse<PositionItem[]>> {
  const res = await getPostList({ page: 1 })
  const list = (res.data.post || []).map(mapPostToLegacy)
  return { ...res, data: list }
}
