/**
 * 模块：客户关系管理-正式客户（tenant-customers）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：正式客户创建、更新、查询列表、查询详情、搜索、删除（软删除）、跟单员/销售员迁移
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 正式客户项（query/search/detail 返回，含关联字段） */
export interface CustomerItem {
  customer_id: string
  customer_name: string
  area_id: string
  area_name?: string
  city?: string
  detail_address: string
  company_leader_name: string
  leader_phone: string
  customer_type_id: string
  customer_type_name?: string
  region_id: string
  region_name?: string
  logistics_company_id: string
  logistics_company_name?: string
  follower_user_id?: string
  follower_user_name?: string
  salesman_user_id?: string
  salesman_user_name?: string
  is_monthly_settlement: number
  monthly_days: number
  settlement_day: number
  credit_amount: number
  gift_amount?: number
  prepayment_amount?: number
  customer_scale?: string
  status: number
  remark?: string
  created_at?: string
  updated_at?: string
}

/** 正式客户列表响应（query/search 返回） */
export interface CustomerListResponse {
  total: number
  page?: number
  page_size?: number
  customer: CustomerItem[]
}

/** 创建正式客户入参 */
export interface CustomerCreatePayload {
  customer_name: string
  area_id: string
  detail_address: string
  company_leader_name: string
  leader_phone: string
  customer_type_id: string
  region_id: string
  logistics_company_id: string
  follower_user_id?: string
  salesman_user_id?: string
  is_monthly_settlement: number
  monthly_days: number
  settlement_day: number
  credit_amount?: string
  customer_scale?: string
  remark?: string
}

/** 修改正式客户入参 */
export interface CustomerUpdatePayload extends CustomerCreatePayload {
  customer_id: string
  status?: number
}

/** 跟单员/销售员迁移入参 */
export interface CustomerMigrateStaffPayload {
  staff_type: string
  source_user_id: string
  target_user_id: string
}

/** 将对象转为 x-www-form-urlencoded，过滤 undefined/null/空串 */
function toFormData(data: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value))
    }
  })
  return params
}

/** 查询正式客户列表 */
export function getCustomerList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<CustomerListResponse>> {
  return get<CustomerListResponse>('/api/v1/tenant-customers/query', params as unknown as Record<string, unknown>)
}

/** 查询正式客户详情 */
export function getCustomerDetail(customerId: string): Promise<ApiResponse<CustomerItem>> {
  return get<CustomerItem>('/api/v1/tenant-customers/detail', { customer_id: customerId })
}

/** 搜索正式客户（search_field/search_value 为 JSON 字符串） */
export function searchCustomers(params: {
  search_field: string
  search_value: string
  page?: number
}): Promise<ApiResponse<CustomerListResponse>> {
  return get<CustomerListResponse>('/api/v1/tenant-customers/search', params as unknown as Record<string, unknown>)
}

/** 创建正式客户 */
export function createCustomer(data: CustomerCreatePayload): Promise<ApiResponse<CustomerItem>> {
  return post<CustomerItem>('/api/v1/tenant-customers', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改正式客户 */
export function updateCustomer(data: CustomerUpdatePayload): Promise<ApiResponse<CustomerItem>> {
  return post<CustomerItem>('/api/v1/tenant-customers/update', toFormData(data as unknown as Record<string, unknown>))
}

/** 删除正式客户（软删除） */
export function deleteCustomer(customerId: string): Promise<ApiResponse<{ customer_id: string }>> {
  return post<{ customer_id: string }>('/api/v1/tenant-customers/delete', toFormData({ customer_id: customerId }))
}

/** 跟单员/销售员迁移 */
export function migrateCustomerStaff(data: CustomerMigrateStaffPayload): Promise<ApiResponse<null>> {
  return post<null>('/api/v1/tenant-customers/migrate-staff', toFormData(data as unknown as Record<string, unknown>))
}
