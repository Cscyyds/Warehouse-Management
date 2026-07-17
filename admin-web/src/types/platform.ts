export interface LoginData {
  access_token: string
  token_type: string
  operator_type: string
  operator_id: string
  operator_name: string
  login_name: string
  login_time: string
  login_token: string
  expires_at: string
  admin_type: 'SYSTEM' | 'NORMAL' | null
  user_identity: string
}

export interface TenantInfo {
  id: number
  tenant_code: string
  tenant_name: string
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  status: number
}

export interface SubscriptionInfo {
  id: number
  tenant_id: string
  tenant_code?: string | null
  start_at?: string | null
  end_at?: string | null
  max_user_count: number
  max_warehouse_count: number
  storage_quota_gb: number
  status: number
}

export interface MenuInfo { id: number; menu_id: string; menu_name: string; menu_status: number }
export interface ButtonInfo { id: number; button_id: string; button_name: string; button_status: number; menu_id: string; parent_id?: string | null }
export interface ApiResourceInfo { id: number; api_id: string; api_name: string; api_path: string; api_function?: string | null; http_method: string; button_id: string; api_status: number }
export interface PermissionInfo { id: number; perm_code: string; perm_name: string; perm_type: string; function_id?: string | null; sort_no: number; status: number }
export interface RoleInfo { id: number; company_id: string; role_code: string; role_name: string; role_type: string; is_system: number; sort_no: number; remark?: string | null; status: number }
export interface OrganizationInfo { id: number; company_id: string; org_code: string; org_name: string; org_full_name?: string | null; sort_no: number; org_type: string; parent_org_code?: string | null; leader_name?: string | null; status: number }
export interface PostInfo { id: number; company_id: string; post_code: string; post_name: string; post_category?: string | null; sort_no: number; remark?: string | null; status: number }
export interface UserInfo { id: number; user_id: string; company_id: string; org_id: string; post_id?: string | null; user_name: string; login_name: string; mobile?: string | null; email?: string | null; sort_no: number; user_type?: string | null; status: number }

export interface OperationLog {
  id: number
  log_id: string
  log_title: string
  request_path: string
  log_type: string
  operator_user_id?: string | null
  operator_user_name?: string | null
  operator_identity: string
  tenant_id?: string | null
  success: number
  detail?: string | null
  operated_at?: string | null
  client_ip?: string | null
  device_name?: string | null
  browser_name?: string | null
  response_time_ms?: number | null
}

export interface EnumMapping {
  mapping_id: string
  mapping_group: string
  input_value: string
  standard_value: string
  display_label: string
  is_canonical: number
  sort_no: number
  status: number
  company_id: string
  remark?: string | null
  created_by?: string | null
  created_by_name?: string | null
  updated_by?: string | null
  updated_by_name?: string | null
  created_at?: string | null
  updated_at?: string | null
}
