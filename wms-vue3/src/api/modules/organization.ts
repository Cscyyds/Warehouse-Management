/**
 * 模块：系统管理-组织机构（租客员工接口 tenant-orgs）
 * 源接口：app/api/v1/endpoints/tenant_employee_management.py
 * 功能：组织机构树形查询、详情、搜索、创建、修改、删除、删除预览、迁移
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 组织树节点（query/search 接口返回，仅含 org_code/name/children） */
export interface OrgTreeNode {
  org_code: string
  name: string
  children?: OrgTreeNode[]
}

/** 组织完整详情（detail 接口返回，对应 sys_organization 表字段） */
export interface OrgDetail {
  id: number
  company_id: string
  org_code: string
  org_name: string
  org_full_name: string | null
  sort_no: number
  org_type: string
  parent_id: string | null
  leader_name: string | null
  contact_address: string | null
  email: string | null
  post_code: string | null
  remark: string | null
  status: number
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string | null
  updated_at: string | null
  deleted_flag: number
}

export interface OrgTreeResponse {
  total: number
  org: OrgTreeNode[]
  /** 向后兼容字段：节点为 { id: org_code, name, children } 结构，供旧下拉组件使用 */
  tree: OrgLegacyNode[]
}

/** 旧下拉组件使用的节点结构 */
export interface OrgLegacyNode {
  id: string
  name: string
  children?: OrgLegacyNode[]
}

export interface OrgDetailResponse {
  total: number
  org: OrgDetail
}

/** 创建组织入参（租客员工接口 tenant-orgs） */
export interface OrgCreatePayload {
  org_name: string
  sort_no: number
  org_type: string
  status?: number
  org_full_name?: string
  parent_id?: string
  leader_name?: string
  contact_address?: string
  email?: string
  post_code?: string
  remark?: string
}

/** 创建组织入参（平台管理员接口 platform-organizations） */
export interface PlatformOrgCreatePayload {
  tenant_id: string
  org_name: string
  sort_no: number
  org_type: string
  org_full_name?: string
  parent_id?: string
  leader_name?: string
  contact_address?: string
  email?: string
  post_code?: string
  remark?: string
}

/** 修改组织入参 */
export interface OrgUpdatePayload {
  org_id: string
  org_name?: string
  org_full_name?: string
  sort_no?: number
  org_type?: string
  parent_id?: string
  leader_name?: string
  contact_address?: string
  email?: string
  post_code?: string
  remark?: string
  status?: number
}

/** 删除预览返回 */
export interface OrgDeletePreview {
  target: { id: string; name: string; type: string }
  cascade_items: { id: string; name: string; type: string }[]
  cascade_count: number
  summary: string
}

/** 将对象转为 x-www-form-urlencoded，过滤 undefined/null */
function toFormData(data: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value))
    }
  })
  return params
}

/** 将真实树节点映射为旧组件需要的 { id, name, children } 结构 */
function toLegacyNodes(nodes: OrgTreeNode[]): OrgLegacyNode[] {
  return (nodes || []).map(n => ({
    id: n.org_code,
    name: n.name,
    children: n.children ? toLegacyNodes(n.children) : undefined
  }))
}

/** 查询组织列表（树形），不传 org_id 则返回全部顶级树 */
export async function getOrgTree(orgId?: string): Promise<ApiResponse<OrgTreeResponse>> {
  const res = await get<OrgTreeResponse>('/api/v1/tenant-orgs/query', orgId ? { org_id: orgId } : undefined)
  // 补充向后兼容的 tree 字段
  res.data.tree = toLegacyNodes(res.data.org || [])
  return res
}

/** 查询组织详情 */
export function getOrgDetail(orgId: string): Promise<ApiResponse<OrgDetailResponse>> {
  return get<OrgDetailResponse>('/api/v1/tenant-orgs/detail', { org_id: orgId })
}

/** 搜索组织（search_field/search_value 为 JSON 字符串） */
export function searchOrg(params: {
  search_field: string
  search_value: string
  org_id?: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<OrgTreeResponse>> {
  return get<OrgTreeResponse>('/api/v1/tenant-orgs/search', params as unknown as Record<string, unknown>)
}

/** 创建组织（租客员工接口） */
export function createOrg(data: OrgCreatePayload): Promise<ApiResponse<OrgDetail>> {
  return post<OrgDetail>('/api/v1/tenant-orgs', toFormData(data as unknown as Record<string, unknown>))
}

/** 创建组织（平台管理员接口） */
export function createPlatformOrg(data: PlatformOrgCreatePayload): Promise<ApiResponse<OrgDetail>> {
  return post<OrgDetail>('/api/v1/platform-organizations', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改组织 */
export function updateOrg(data: OrgUpdatePayload): Promise<ApiResponse<OrgDetail>> {
  return post<OrgDetail>('/api/v1/tenant-orgs/update', toFormData(data as unknown as Record<string, unknown>))
}

/** 删除组织 */
export function deleteOrg(orgId: string): Promise<ApiResponse<null>> {
  return post<null>('/api/v1/tenant-orgs/delete', toFormData({ org_id: orgId }))
}

/** 删除影响预览 */
export function previewDeleteOrg(orgId: string): Promise<ApiResponse<OrgDeletePreview>> {
  return get<OrgDeletePreview>('/api/v1/tenant-orgs/delete/preview', { org_id: orgId })
}

/** 组织迁移（migrate_type：users 迁移员工 / children 迁移子组织） */
export function migrateOrg(data: {
  source_org_id: string
  target_org_id: string
  migrate_type: 'users' | 'children'
}): Promise<ApiResponse<null>> {
  return post<null>('/api/v1/tenant-orgs/migrate', toFormData(data as unknown as Record<string, unknown>))
}

/** 枚举映射条目 */
export interface EnumMappingItem {
  mapping_id: string
  input_value: string
  standard_value: string
  display_label: string
  is_canonical: number
  sort_no: number
}

/** 查询枚举映射列表（租客侧），用于下拉选项填充 */
export function getTenantEnumMappings(mappingGroup: string): Promise<ApiResponse<{ items: EnumMappingItem[] }>> {
  return get<{ items: EnumMappingItem[] }>('/api/v1/tenant-enum-mappings', { mapping_group: mappingGroup })
}

/** 获取组织类型下拉选项（label 用展示名，value 用 input_value 供提交） */
export async function getOrgTypeOptions(): Promise<{ label: string; value: string }[]> {
  const res = await getTenantEnumMappings('ORG_TYPE_MAPPING')
  const items = res.data.items || []
  // 优先展示官方代表条目，按 sort_no 排序
  return items
    .filter(i => i.is_canonical === 1 || true)
    .sort((a, b) => a.sort_no - b.sort_no)
    .map(i => ({ label: i.display_label, value: i.input_value }))
}
