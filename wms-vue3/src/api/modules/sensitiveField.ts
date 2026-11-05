import { get, post, toMultipart, type RequestConfig } from '@/utils/request'

export type SensitiveModule = 'PRODUCT' | 'PURCHASE' | 'SALES' | 'CRM' | 'INVENTORY'
export type RestrictionType = 1 | 2
export interface SensitivePermissionImpact {
  perm_code: string | null
  perm_name: string
  api_name: string
  interface_path: string
  interface_name: string
  param_name: string
  unbound: boolean
}
export interface SensitiveImpactGroup {
  owner: string
  owner_name: string
  permissions: SensitivePermissionImpact[]
}
export interface SensitiveFieldNode {
  field_id: string
  field_label: string
  is_derived: boolean
  derived_from_field_labels: string[]
  view_interfaces: SensitiveImpactGroup[]
  update_interfaces: SensitiveImpactGroup[]
}
export interface SensitiveFieldModule {
  module: SensitiveModule
  module_name: string
  fields: SensitiveFieldNode[]
}
export interface RoleSensitivePermission {
  field_id: string
  field_label?: string
  restriction_type: RestrictionType
  restriction_type_label?: string
}
export interface SensitiveFieldRestriction extends RoleSensitivePermission {
  param_name: string
  io_type: 'INPUT' | 'OUTPUT'
}
export interface SensitiveRestrictions {
  interface_url: string
  is_restricted: boolean
  restricted_fields: SensitiveFieldRestriction[]
}
export interface DerivedSensitiveField {
  field_id: string
  field_label: string
  is_derived: boolean
  depend_full_chain: string[]
  bound_view_permissions: SensitiveImpactGroup[]
}

export function getSensitiveFieldTree(module?: SensitiveModule, config?: RequestConfig) {
  return get<{ tree: SensitiveFieldModule[] }>('/api/v1/tenant-sensitive-fields/tree', { module }, config)
}
export function getRoleSensitivePermissions(roleId: string, config?: RequestConfig) {
  return get<{ role_id: string; permissions: RoleSensitivePermission[] }>('/api/v1/tenant-roles/sensitive-permissions', { role_id: roleId }, config)
}
export function saveRoleSensitivePermissions(roleId: string, permissions: RoleSensitivePermission[], config?: RequestConfig) {
  // 全量覆盖；即使清空也明确序列化 []，不以空串或缺字段代替。
  return post<unknown>('/api/v1/tenant-roles/sensitive-permissions', toMultipart({ role_id: roleId,
    permissions: JSON.stringify(permissions.map(({ field_id, restriction_type }) => ({ field_id, restriction_type }))),
  }), config)
}
export function getDerivedSensitiveFields(fieldId: string, config?: RequestConfig) {
  return get<{ field_id: string; field_label: string; derived_fields: DerivedSensitiveField[] }>('/api/v1/tenant-sensitive-fields/derived', { field_id: fieldId }, config)
}
export function getSensitiveRestrictions(interfaceUrl: string, config?: RequestConfig) {
  // 仅去除协议约定的前缀，不对相似路径猜测或改写。
  const path = interfaceUrl.replace(/^\/api\/v1(?=\/)/, '')
  return get<SensitiveRestrictions>('/api/v1/tenant-sensitive-fields/restrictions', { interface_url: path }, config)
}
