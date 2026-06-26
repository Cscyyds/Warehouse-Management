/**
 * 模块：客户关系管理-新开拓客户（tenant-customer-leads）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：新开拓客户创建、更新、查询列表、查询详情、搜索、删除、转正式客户
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 新开拓客户项（query/search/detail 返回） */
export interface CustomerLeadItem {
  lead_id: string
  lead_name: string
  area_id: string
  area_name?: string
  city?: string
  detail_address: string
  contact_name: string
  contact_phone: string
  customer_type_id: string
  customer_type_name?: string
  region_id: string
  region_name?: string
  customer_scale?: string
  status: number
  remark?: string
  created_by?: string
  created_by_name?: string
  updated_by?: string
  updated_by_name?: string
  created_at?: string
  updated_at?: string
}

/** 新开拓客户列表响应（query/search 返回） */
export interface CustomerLeadListResponse {
  total: number
  page: number
  page_size: number
  customer_lead: CustomerLeadItem[]
}

/** 创建新开拓客户入参 */
export interface CustomerLeadCreatePayload {
  lead_name: string
  area_id: string
  detail_address: string
  contact_name: string
  contact_phone: string
  customer_type_id: string
  region_id: string
  customer_scale?: string
  remark?: string
}

/** 修改新开拓客户入参 */
export interface CustomerLeadUpdatePayload {
  lead_id: string
  lead_name?: string
  area_id?: string
  detail_address?: string
  contact_name?: string
  contact_phone?: string
  customer_type_id?: string
  region_id?: string
  customer_scale?: string
  remark?: string
  status?: number
}

/** 转正式客户入参 */
export interface CustomerLeadConvertPayload {
  lead_id: string
  credit_amount?: string
  is_monthly_settlement: number
  monthly_days: number
  settlement_day: number
}

/** 转正式客户返回 */
export interface ConvertedCustomer {
  customer_id: string
  customer_name: string
  area_id: string
  city: string
  detail_address: string
  customer_type_id: string
  region_id: string
  logistics_company_id: string
  follower_user_id: string
  salesman_user_id: string
  is_monthly_settlement: number
  monthly_days: number
  settlement_day: number
  credit_amount: number
  status: number
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

/** 查询新开拓客户列表 */
export function getCustomerLeadList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<CustomerLeadListResponse>> {
  return get<CustomerLeadListResponse>('/api/v1/tenant-customer-leads/query', params as unknown as Record<string, unknown>)
}

/** 查询新开拓客户详情 */
export function getCustomerLeadDetail(leadId: string): Promise<ApiResponse<CustomerLeadItem>> {
  return get<CustomerLeadItem>('/api/v1/tenant-customer-leads/detail', { lead_id: leadId })
}

/** 搜索新开拓客户（search_field/search_value 为 JSON 字符串） */
export function searchCustomerLeads(params: {
  search_field: string
  search_value: string
  page?: number
}): Promise<ApiResponse<CustomerLeadListResponse>> {
  return get<CustomerLeadListResponse>('/api/v1/tenant-customer-leads/search', params as unknown as Record<string, unknown>)
}

/** 创建新开拓客户 */
export function createCustomerLead(data: CustomerLeadCreatePayload): Promise<ApiResponse<CustomerLeadItem>> {
  return post<CustomerLeadItem>('/api/v1/tenant-customer-leads', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改新开拓客户 */
export function updateCustomerLead(data: CustomerLeadUpdatePayload): Promise<ApiResponse<CustomerLeadItem>> {
  return post<CustomerLeadItem>('/api/v1/tenant-customer-leads/update', toFormData(data as unknown as Record<string, unknown>))
}

/** 删除新开拓客户 */
export function deleteCustomerLead(leadId: string): Promise<ApiResponse<{ lead_id: string }>> {
  return post<{ lead_id: string }>('/api/v1/tenant-customer-leads/delete', toFormData({ lead_id: leadId }))
}

/** 转正式客户 */
export function convertCustomerLeadToCustomer(data: CustomerLeadConvertPayload): Promise<ApiResponse<ConvertedCustomer>> {
  return post<ConvertedCustomer>('/api/v1/tenant-customer-leads/convert-to-customer', toFormData(data as unknown as Record<string, unknown>))
}
