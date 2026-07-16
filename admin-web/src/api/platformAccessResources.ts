import { postForm } from './http'
import type { ApiResourceInfo, ButtonInfo, MenuInfo, PermissionInfo, RoleInfo } from '@/types/platform'

export interface CreateMenuPayload { menu_name: string; menu_status: number }
export interface CreateButtonPayload { button_name: string; button_status: number; menu_id: string; parent_id?: string }
export interface CreateApiPayload { api_name: string; api_path: string; api_function?: string; http_method: string; button_id: string; api_status: number }
export interface CreatePermissionPayload { perm_name: string; perm_type: string; function_id?: string; sort_no: number }
export interface CreateRolePayload { tenant_id: string; role_name: string; role_type: string; sort_no: number; remark?: string; permission_id?: string[] }

export const createMenu = (payload: CreateMenuPayload) => postForm<MenuInfo>('/platform-menus', payload)
export const createButton = (payload: CreateButtonPayload) => postForm<ButtonInfo>('/platform-buttons', payload)
export const createApiResource = (payload: CreateApiPayload) => postForm<ApiResourceInfo>('/platform-apis', payload)
export const createPermission = (payload: CreatePermissionPayload) => postForm<PermissionInfo>('/platform-permissions', payload)
export const createRole = (payload: CreateRolePayload) => postForm<RoleInfo>('/platform-roles', payload)
