export type SensitiveModule = 'PRODUCT' | 'PURCHASE' | 'SALES' | 'CRM' | 'INVENTORY'
export interface SensitiveFieldDefinition {
  field_id: string
  module: SensitiveModule
  module_name: string
  field_code: string
  field_label: string
  is_derived: boolean
  derived_from_field_ids: string[]
  derived_from_field_labels: string[]
  description: string | null
  sort_no: number
  status: number
  mapping_count: number
  permission_count: number
  updated_at: string | null
  updated_by_name: string | null
}
export interface SensitiveInterfaceMapping {
  mapping_id: string
  field_id: string
  field_label: string
  module: SensitiveModule
  interface_path: string
  interface_name: string
  io_type: 'OUTPUT' | 'INPUT'
  param_name: string
  sort_no: number
  status: number
  updated_at: string | null
  updated_by_name: string | null
}
export interface SensitiveFieldPage { fields: SensitiveFieldDefinition[]; total: number; page: number; page_size: number }
export interface SensitiveMappingPage { interface_fields: SensitiveInterfaceMapping[]; total: number; page: number; page_size: number }
export interface SensitiveFieldPayload {
  field_id?: string
  module?: SensitiveModule
  field_code?: string
  field_label?: string
  is_derived?: number
  derived_from_field_ids?: string[]
  description?: string
  sort_no?: number
  status?: number
}
export interface SensitiveMappingPayload {
  mapping_id?: string
  field_id?: string
  interface_path?: string
  interface_name?: string
  io_type?: 'OUTPUT' | 'INPUT'
  param_name?: string
  sort_no?: number
  status?: number
}
