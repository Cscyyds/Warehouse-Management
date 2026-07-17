import { getData } from './http'
import type { EnumMapping } from '@/types/platform'

export interface QueryPageParams {
  page?: number
  page_size?: number
  keyword?: string
}

export interface TenantOptionRow { tenant_code: string; tenant_name: string }
export interface MenuOptionRow { menu_id: string; menu_name: string }
export interface ButtonOptionRow { button_id: string; button_name: string; menu_id: string; parent_id?: string | null }
export interface ApiOptionRow { api_id: string; api_name: string; api_path: string; button_id: string }
export interface PermissionOptionRow { perm_code: string; perm_name: string; perm_type: string; function_id?: string | null }
export interface RoleOptionRow { role_code: string; role_name: string; company_id: string; status: number }
export interface PostOptionRow { post_code: string; post_name: string; company_id: string; status: number }
export interface OrganizationOptionRow {
  org_code: string
  org_name: string
  company_id: string
  status: number
  children?: OrganizationOptionRow[]
}

export const queryPlatformTenants = (params: QueryPageParams = {}) =>
  getData<{ total: number; tenant: TenantOptionRow[] }>('/platform-tenants/query', { page: 1, page_size: 100, ...params })

export const queryPlatformMenus = (params: QueryPageParams = {}) =>
  getData<{ total: number; menu: MenuOptionRow[] }>('/platform-menus/query', { page: 1, page_size: 100, ...params })

export const queryPlatformButtons = (params: QueryPageParams & { menu_id?: string } = {}) =>
  getData<{ total: number; button: ButtonOptionRow[] }>('/platform-buttons/query', { page: 1, page_size: 100, ...params })

export const queryPlatformApis = (params: QueryPageParams & { button_id?: string } = {}) =>
  getData<{ total: number; api: ApiOptionRow[] }>('/platform-apis/query', { page: 1, page_size: 100, ...params })

export const queryPlatformPermissions = (params: QueryPageParams & { perm_type?: string } = {}) =>
  getData<{ total: number; permission: PermissionOptionRow[] }>('/platform-permissions/query', { page: 1, page_size: 100, ...params })

export const queryTenantRoles = (tenant_id: string) =>
  getData<{ total: number; role: RoleOptionRow[] }>('/tenant-roles/query', { tenant_id, page: 1, page_size: 100, sort_by: 'sort_no', sort_order: 'ASC' })

export const queryTenantOrganizations = (tenant_id: string) =>
  getData<{ total: number; org: OrganizationOptionRow[] }>('/tenant-orgs/query', { tenant_id, page: 1, page_size: 100, sort_by: 'sort_no', sort_order: 'ASC' })

export const queryTenantPosts = (tenant_id: string) =>
  getData<{ total: number; post: PostOptionRow[] }>('/tenant-posts/query', { tenant_id, page: 1, page_size: 100, sort_by: 'sort_no', sort_order: 'ASC' })

export const queryTenantEnumMappings = (tenant_id: string, mapping_group: string) =>
  getData<{ total: number; items: EnumMapping[] }>('/tenant-enum-mappings', { tenant_id, mapping_group })
