/**
 * 模块：客户关系管理-公海客户（tenant-open-pool-customers）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：公海客户查询列表、搜索、公海新开拓客户转正式客户、批量绑定跟单员/销售员
 * 说明：写操作均为 multipart/form-data
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 公海客户项（query/search 返回，合并新开拓客户与正式客户） */
export interface OpenPoolCustomerItem {
  customer_id: string
  customer_name: string
  area_id?: string
  area_name?: string
  detail_address?: string
  company_phone?: string
  leader_phone?: string
  company_leader_name?: string
  customer_type_id?: string
  customer_type_name?: string
  customer_tag: string
}

/** 公海客户列表响应（query/search 返回） */
export interface OpenPoolCustomerListResponse {
  total: number
  customers: OpenPoolCustomerItem[]
}

/** 公海新开拓客户转正式客户入参 */
export interface OpenPoolConvertLeadPayload {
  lead_id: string
  customer_name: string
  area_id: string
  detail_address: string
  company_leader_name: string
  leader_phone: string
  customer_type_id: string
  region_id: string
  logistics_company_id: string
  is_monthly_settlement: number
  credit_amount?: number
  monthly_days?: number
  settlement_day?: number
  customer_scale?: string
  follower_user_id?: string
  salesman_user_id?: string
  remark?: string
}

/** 批量绑定跟单员/销售员入参 */
export interface OpenPoolAssignStaffPayload {
  customer_ids: string
  follower_user_id?: string
  salesman_user_id?: string
}

/** 批量绑定跟单员/销售员返回 */
export interface OpenPoolAssignStaffResult {
  success_count: number
  skipped_count: number
  success_list: { customer_id: string; customer_name: string }[]
  skipped_list: { customer_id: string; reason: string }[]
}

/** 查询公海客户列表 */
export function getOpenPoolCustomerList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<OpenPoolCustomerListResponse>> {
  return get<OpenPoolCustomerListResponse>('/api/v1/tenant-open-pool-customers/query', params as unknown as Record<string, unknown>)
}

/** 搜索公海客户（search_field/search_value 为 JSON 字符串） */
export function searchOpenPoolCustomers(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<OpenPoolCustomerListResponse>> {
  return get<OpenPoolCustomerListResponse>('/api/v1/tenant-open-pool-customers/search', params as unknown as Record<string, unknown>)
}

/** 公海新开拓客户转正式客户 */
export function convertOpenPoolLead(data: OpenPoolConvertLeadPayload): Promise<ApiResponse<null>> {
  return post<null>('/api/v1/tenant-open-pool-customers/convert-lead', toMultipart(data as unknown as Record<string, unknown>))
}

/** 批量绑定跟单员/销售员 */
export function assignOpenPoolStaff(data: OpenPoolAssignStaffPayload): Promise<ApiResponse<OpenPoolAssignStaffResult>> {
  return post<OpenPoolAssignStaffResult>('/api/v1/tenant-open-pool-customers/assign-staff', toMultipart(data as unknown as Record<string, unknown>))
}
