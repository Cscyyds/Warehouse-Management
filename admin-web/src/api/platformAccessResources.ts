import { postForm } from './http'
import type { ApiResourceInfo, ButtonInfo, MenuInfo, PermissionInfo, PermissionOwner, RoleInfo } from '@/types/platform'

export interface CreateMenuPayload { menu_name: string; menu_status: number; permission_owner: PermissionOwner }
export interface CreateButtonPayload { button_name: string; button_status: number; menu_id: string; parent_id?: string; permission_owner: PermissionOwner }
export interface CreateApiPayload { api_name: string; api_path: string; api_function?: string; http_method: string; button_id: string; api_status: number; permission_owner: PermissionOwner }
export interface CreatePermissionPayload {
  perm_name: string
  perm_type: string
  function_id?: string
  sort_no: number
  /** 1-公开（有效），2-未公开（未开放）；后端不接受 0 */
  status?: 1 | 2
  /** JSON 数组字符串；为空表示不限租户，此时可见性由 status 决定 */
  tenant_ids?: string
  permission_owner: PermissionOwner
}
export interface CreateRolePayload { tenant_id: string; role_name: string; role_type: string; sort_no: number; remark?: string; permission_id?: string[] }

export const createMenu = (payload: CreateMenuPayload) => postForm<MenuInfo>('/platform-menus', payload)
export const createButton = (payload: CreateButtonPayload) => postForm<ButtonInfo>('/platform-buttons', payload)
export const createApiResource = (payload: CreateApiPayload) => postForm<ApiResourceInfo>('/platform-apis', payload)
export const createPermission = (payload: CreatePermissionPayload) => postForm<PermissionInfo>('/platform-permissions', payload)
export const createRole = (payload: CreateRolePayload) => postForm<RoleInfo>('/platform-roles', payload)
