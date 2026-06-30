/**
 * 模块：客户关系-区域管理（租客接口 tenant-regions）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：区域创建、修改、查询列表、查询详情、搜索、删除、迁移
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post, toFormData } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 区域项（query/search/detail/create/update 返回） */
export interface CustomerRegionItem {
  region_id: string
  region_name: string
  status: number
  remark: string | null
  created_by?: string | null
  created_by_name?: string | null
  updated_by?: string | null
  updated_by_name?: string | null
  created_at?: string
  updated_at?: string
}

/** 区域列表响应（query/search 返回） */
export interface CustomerRegionListResponse {
  total: number
  page: number
  page_size: number
  region: CustomerRegionItem[]
}

/** 创建区域入参 */
export interface CustomerRegionCreatePayload {
  region_name: string
  remark?: string
}

/** 修改区域入参 */
export interface CustomerRegionUpdatePayload {
  region_id: string
  region_name?: string
  remark?: string
  status?: number
}

/** 区域迁移入参 */
export interface CustomerRegionMigratePayload {
  source_region_id: string
  target_region_id: string
}

/** 查询区域列表 */
export function getCustomerRegionList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<CustomerRegionListResponse>> {
  return get<CustomerRegionListResponse>('/api/v1/tenant-regions/query', params as unknown as Record<string, unknown>)
}

/** 查询区域详情 */
export function getCustomerRegionDetail(regionId: string): Promise<ApiResponse<CustomerRegionItem>> {
  return get<CustomerRegionItem>('/api/v1/tenant-regions/detail', { region_id: regionId })
}

/** 搜索区域（search_field/search_value 为 JSON 字符串） */
export function searchCustomerRegions(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<CustomerRegionListResponse>> {
  return get<CustomerRegionListResponse>('/api/v1/tenant-regions/search', params as unknown as Record<string, unknown>)
}

/** 创建区域 */
export function createCustomerRegion(data: CustomerRegionCreatePayload): Promise<ApiResponse<CustomerRegionItem>> {
  return post<CustomerRegionItem>('/api/v1/tenant-regions', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改区域 */
export function updateCustomerRegion(regionId: string, data: CustomerRegionUpdatePayload): Promise<ApiResponse<CustomerRegionItem>> {
  const payload = { ...data, region_id: regionId }
  return post<CustomerRegionItem>('/api/v1/tenant-regions/update', toFormData(payload as unknown as Record<string, unknown>))
}

/** 删除区域 */
export function deleteCustomerRegion(regionId: string): Promise<ApiResponse<{ region_id: string }>> {
  return post<{ region_id: string }>('/api/v1/tenant-regions/delete', toFormData({ region_id: regionId }))
}

/** 区域迁移 */
export function migrateCustomerRegion(data: CustomerRegionMigratePayload): Promise<ApiResponse<{ source_region_id: string; target_region_id: string }>> {
  return post<{ source_region_id: string; target_region_id: string }>('/api/v1/tenant-regions/migrate', toFormData(data as unknown as Record<string, unknown>))
}
