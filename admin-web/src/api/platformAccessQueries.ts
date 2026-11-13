import { getData, postForm } from './http'
import type {
  ApiResourceDetail,
  ButtonDetail,
  ButtonInfo,
  MenuDetail,
  MenuInfo,
  PermissionDetail,
  PermissionInfo,
  PermissionOwner,
  PermissionStatus,
} from '@/types/platform'

/** 各资源 search 接口通用的分页排序参数 */
export interface ResourceSearchParams {
  search_field: string[]
  search_value: Record<string, string>
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
  permission_owner?: PermissionOwner
}

function toSearchQuery<T extends ResourceSearchParams>(params: T) {
  const { search_field, search_value, ...rest } = params
  return { ...rest, search_field: JSON.stringify(search_field), search_value: JSON.stringify(search_value) }
}

/* —— 菜单 detail / search（文档接口2、3） —— */

export const getPlatformMenu = (menuId: string, permissionOwner: PermissionOwner = 'WMS_PLATFORM') =>
  getData<MenuDetail>('/platform-menus/detail', { menu_id: menuId, permission_owner: permissionOwner })

/** 搜索菜单，可用字段：menu_id、menu_name */
export const searchPlatformMenus = (params: ResourceSearchParams) =>
  getData<{ total: number; menu: MenuInfo[] }>('/platform-menus/search', { page: 1, page_size: 20, ...toSearchQuery(params) })

/* —— 按钮 detail / search（文档接口5、6） —— */

export const getPlatformButton = (buttonId: string, permissionOwner: PermissionOwner = 'WMS_PLATFORM') =>
  getData<ButtonDetail>('/platform-buttons/detail', { button_id: buttonId, permission_owner: permissionOwner })

/** 搜索按钮，可用字段：button_id、button_name、menu_id、parent_id */
export const searchPlatformButtons = (params: ResourceSearchParams & { menu_id?: string }) =>
  getData<{ total: number; button: ButtonInfo[] }>('/platform-buttons/search', { page: 1, page_size: 20, ...toSearchQuery(params) })

/* —— 接口资源 detail / search（文档接口8、9） —— */

export const getPlatformApi = (apiId: string, permissionOwner: PermissionOwner = 'WMS_PLATFORM') =>
  getData<ApiResourceDetail>('/platform-apis/detail', { api_id: apiId, permission_owner: permissionOwner })

export interface ApiResourceInfoRow {
  api_id: string
  api_name: string
  api_path: string
  button_id: string
  permission_owner: string
}

/** 搜索接口资源，可用字段：api_id、api_name、api_path、button_id */
export const searchPlatformApis = (params: ResourceSearchParams & { button_id?: string }) =>
  getData<{ total: number; api: ApiResourceInfoRow[] }>('/platform-apis/search', { page: 1, page_size: 20, ...toSearchQuery(params) })

/* —— 权限 detail / search / update / delete（文档接口11、12 与写接口） —— */

export const getPlatformPermission = (permCode: string, permissionOwner: PermissionOwner = 'WMS_PLATFORM') =>
  getData<PermissionDetail>('/platform-permissions/detail', { perm_code: permCode, permission_owner: permissionOwner })

/**
 * 搜索权限（平铺列表，不分页）。
 * 可用字段：perm_code、perm_name、perm_type、function_id、sort_no、status、tenant_ids、permission_owner
 */
export const searchPlatformPermissions = (params: {
  search_field: string[]
  search_value: Record<string, string>
  permission_owner?: PermissionOwner
  status?: PermissionStatus
}) =>
  getData<{ total: number; permission: PermissionDetail[] }>('/platform-permissions/search', {
    permission_owner: params.permission_owner,
    status: params.status,
    search_field: JSON.stringify(params.search_field),
    search_value: JSON.stringify(params.search_value),
  })

export interface UpdatePermissionPayload {
  perm_name?: string
  perm_type?: string
  function_id?: string
  sort_no?: number
  /** 1-公开（有效），2-未公开（未开放）；后端不接受 0 */
  status?: PermissionStatus
  /** JSON 数组字符串；传空表示不限租户，此时可见性由 status 决定 */
  tenant_ids?: string
  permission_owner?: PermissionOwner
}

export const updatePermission = (permCode: string, payload: UpdatePermissionPayload) =>
  postForm<PermissionInfo>('/platform-permissions/update', { ...payload, perm_code: permCode })

/** 软删除权限（status 置 0），删除后所有租户均不可见 */
export const deletePermission = (permCode: string) =>
  postForm<PermissionInfo>('/platform-permissions/delete', { perm_code: permCode })
