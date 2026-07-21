export type SubscriptionState = 'NONE' | 'NOT_STARTED' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'DISABLED'

export interface TenantCurrentSubscription {
  id: number
  subscription_id: string
  start_at?: string | null
  end_at?: string | null
  max_user_count: number
  max_warehouse_count: number
  storage_quota_gb: number
  status: number
  subscription_state: SubscriptionState
  created_at?: string | null
  updated_at?: string | null
}

export interface TenantOverviewStatistics {
  employee_total_count: number
  active_employee_count: number
  warehouse_total_count: number
  active_warehouse_count: number
  organization_count: number
  post_count: number
  role_count: number
  assigned_permission_count: number
}

export interface TenantOverviewRow {
  id: number
  tenant_code: string
  tenant_name: string
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  created_by_platform_admin_id?: string | null
  status: number
  created_at?: string | null
  updated_at?: string | null
  current_subscription?: TenantCurrentSubscription | null
  statistics: TenantOverviewStatistics
}

export interface TenantOverviewQueryParams {
  keyword?: string
  tenant_status?: number
  subscription_state?: SubscriptionState
  page: number
  page_size: number
  sort_by?: 'tenant_name' | 'created_at' | 'end_at' | 'active_employee_count' | 'active_warehouse_count'
  sort_order?: 'ASC' | 'DESC'
}

export interface TenantOverviewQueryData {
  total: number
  page: number
  page_size: number
  tenant: TenantOverviewRow[]
}

export interface TenantRelatedQueryParams {
  tenant_id: string
  keyword?: string
  status?: number
  page: number
  page_size: number
  sort_by?: string
  sort_order?: 'ASC' | 'DESC'
}

export interface TenantEmployeeRow {
  user_id: string
  user_name: string
  login_name: string
  mobile?: string | null
  email?: string | null
  org_id?: string | null
  org_name?: string | null
  post_id?: string | null
  post_name?: string | null
  role_id?: string | null
  role_name?: string | null
  role_type?: string | null
  user_type?: string | null
  user_type_label?: string | null
  status: number
  last_login_ip?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface TenantOrganizationRow {
  org_code: string
  org_name: string
  org_full_name?: string | null
  org_type?: string | null
  org_type_label?: string | null
  parent_id?: string | null
  parent_org_name?: string | null
  leader_name?: string | null
  contact_address?: string | null
  email?: string | null
  employee_count: number
  status: number
  sort_no: number
  remark?: string | null
}

export interface TenantPostRow {
  post_code: string
  post_name: string
  post_category?: string | null
  post_category_label?: string | null
  employee_count: number
  status: number
  sort_no: number
  remark?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface TenantPermissionRef {
  perm_code: string
  perm_name: string
  perm_type?: string | null
  function_id?: string | string[] | null
}

export interface TenantRolePermissionRow {
  role_code: string
  role_name: string
  role_type: string
  role_type_label?: string | null
  is_system: number
  user_count: number
  permission_count: number
  permissions: TenantPermissionRef[]
  status: number
  sort_no: number
  remark?: string | null
}

export interface TenantWarehouseRow {
  warehouse_id: string
  warehouse_no: string
  warehouse_name: string
  warehouse_region?: string | null
  warehouse_region_label?: string | null
  warehouse_type?: string | null
  warehouse_type_label?: string | null
  area_id?: string | null
  area_name?: string | null
  warehouse_address?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  location_count: number
  status: number
  created_at?: string | null
  updated_at?: string | null
}

export interface TenantRelatedQueryData<T, K extends string> {
  total: number
  page: number
  page_size: number
  data: Record<K, T[]>
}
