import { getData } from './http'
import type { EnumMapping, PermissionOwner, PermissionTreeButton, PermissionTreeMenu } from '@/types/platform'

export interface QueryPageParams {
  page?: number
  page_size?: number
  keyword?: string
}

/** 按权限归属过滤的查询参数（WMS_PLATFORM/WMS_SCANNER，后端默认 WMS_PLATFORM） */
export interface OwnerScopedParams { permission_owner?: PermissionOwner }

export interface TenantOptionRow { tenant_code: string; tenant_name: string }
export interface MenuOptionRow { menu_id: string; menu_name: string; permission_owner: string }
export interface ButtonOptionRow { button_id: string; button_name: string; menu_id: string; parent_id?: string | null; permission_owner: string }
export interface ApiOptionRow { api_id: string; api_name: string; api_path: string; button_id: string; permission_owner: string }
/** 权限可选项；/platform-permissions/query 已改为「菜单-按钮-权限」联级结构，需拍平使用 */
export interface PermissionOptionRow { perm_code: string; perm_name: string }
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

export const queryPlatformMenus = (params: QueryPageParams & OwnerScopedParams = {}) =>
  getData<{ total: number; menu: MenuOptionRow[] }>('/platform-menus/query', { page: 1, page_size: 100, ...params })

export const queryPlatformButtons = (params: QueryPageParams & OwnerScopedParams & { menu_id?: string } = {}) =>
  getData<{ total: number; button: ButtonOptionRow[] }>('/platform-buttons/query', { page: 1, page_size: 100, ...params })

export const queryPlatformApis = (params: QueryPageParams & OwnerScopedParams & { button_id?: string } = {}) =>
  getData<{ total: number; api: ApiOptionRow[] }>('/platform-apis/query', { page: 1, page_size: 100, ...params })

export interface PermissionTreeQueryData { total: number; menus: PermissionTreeMenu[] }

/** 查询指定归属的可用权限（菜单 -> 按钮 -> 权限联级，非分页全量返回） */
export const queryPlatformPermissions = (params: OwnerScopedParams = {}) =>
  getData<PermissionTreeQueryData>('/platform-permissions/query', { ...params })

/** 将联级权限树拍平为权限选项列表；同一权限可挂多个功能，按 perm_code 去重 */
export function flattenPermissionMenus(menus: PermissionTreeMenu[]): PermissionOptionRow[] {
  const seen = new Set<string>()
  const result: PermissionOptionRow[] = []
  const walkButtons = (buttons: PermissionTreeButton[]) => {
    for (const button of buttons) {
      for (const permission of button.permissions || []) {
        if (!seen.has(permission.perm_code)) {
          seen.add(permission.perm_code)
          result.push({ perm_code: permission.perm_code, perm_name: permission.perm_name })
        }
      }
      walkButtons(button.children || [])
    }
  }
  menus.forEach((menu) => walkButtons(menu.buttons || []))
  return result
}

export const queryTenantRoles = (tenant_id: string) =>
  getData<{ total: number; role: RoleOptionRow[] }>('/tenant-roles/query', { tenant_id, page: 1, page_size: 100, sort_by: 'sort_no', sort_order: 'ASC' })

export const queryTenantOrganizations = (tenant_id: string) =>
  getData<{ total: number; org: OrganizationOptionRow[] }>('/tenant-orgs/query', { tenant_id, page: 1, page_size: 100, sort_by: 'sort_no', sort_order: 'ASC' })

export const queryTenantPosts = (tenant_id: string) =>
  getData<{ total: number; post: PostOptionRow[] }>('/tenant-posts/query', { tenant_id, page: 1, page_size: 100, sort_by: 'sort_no', sort_order: 'ASC' })

export const queryTenantEnumMappings = (tenant_id: string, mapping_group: string) =>
  getData<{ total: number; items: EnumMapping[] }>('/tenant-enum-mappings', { tenant_id, mapping_group })
