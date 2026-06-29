/**
 * 模块：客户关系-客户类型管理（租客接口 tenant-customer-types）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：客户类型创建、修改、查询列表、查询详情、搜索、删除、迁移
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post, toFormData } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 客户类型项（query/search/detail/create/update 返回） */
export interface CustomerTypeItem {
  id?: number
  customer_type_id: string
  company_id?: string
  company_name?: string
  customer_type_name?: string
  type_name: string
  status: number
  deleted_flag?: number
  created_by?: string | null
  created_by_name?: string | null
  updated_by?: string | null
  updated_by_name?: string | null
  created_at?: string
  updated_at?: string
}

/** 客户类型列表响应（query/search 返回） */
export interface CustomerTypeListResponse {
  total: number
  page?: number
  page_size?: number
  customer_type: CustomerTypeItem[]
}

/** 创建客户类型入参 */
export interface CustomerTypeCreatePayload {
  type_name: string
}

/** 修改客户类型入参 */
export interface CustomerTypeUpdatePayload {
  customer_type_id: string
  type_name?: string
  status?: number
}

/** 客户类型迁移入参 */
export interface CustomerTypeMigratePayload {
  source_customer_type_id: string
  target_customer_type_id: string
}

/** 查询客户类型列表 */
export function getCustomerTypeList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<CustomerTypeListResponse>> {
  return get<CustomerTypeListResponse>('/api/v1/tenant-customer-types/query', params as unknown as Record<string, unknown>)
}

/** 查询客户类型详情 */
export function getCustomerTypeDetail(customerTypeId: string): Promise<ApiResponse<CustomerTypeItem>> {
  return get<CustomerTypeItem>('/api/v1/tenant-customer-types/detail', { customer_type_id: customerTypeId })
}

/** 搜索客户类型（search_field/search_value 为 JSON 字符串） */
export function searchCustomerTypes(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<CustomerTypeListResponse>> {
  return get<CustomerTypeListResponse>('/api/v1/tenant-customer-types/search', params as unknown as Record<string, unknown>)
}

/** 创建客户类型 */
export function createCustomerType(data: CustomerTypeCreatePayload): Promise<ApiResponse<CustomerTypeItem>> {
  return post<CustomerTypeItem>('/api/v1/tenant-customer-types', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改客户类型 */
export function updateCustomerType(customerTypeId: string, data: CustomerTypeUpdatePayload): Promise<ApiResponse<CustomerTypeItem>> {
  const payload = { ...data, customer_type_id: customerTypeId }
  return post<CustomerTypeItem>('/api/v1/tenant-customer-types/update', toFormData(payload as unknown as Record<string, unknown>))
}

/** 删除客户类型 */
export function deleteCustomerType(customerTypeId: string): Promise<ApiResponse<{ customer_type_id: string }>> {
  return post<{ customer_type_id: string }>('/api/v1/tenant-customer-types/delete', toFormData({ customer_type_id: customerTypeId }))
}

/** 客户类型迁移 */
export function migrateCustomerType(data: CustomerTypeMigratePayload): Promise<ApiResponse<{ source_customer_type_id: string; target_customer_type_id: string }>> {
  return post<{ source_customer_type_id: string; target_customer_type_id: string }>('/api/v1/tenant-customer-types/migrate', toFormData(data as unknown as Record<string, unknown>))
}
