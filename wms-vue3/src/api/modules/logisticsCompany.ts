/**
 * 模块：客户关系-物流公司管理（租客接口 tenant-logistics-companies）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：物流公司创建、修改、查询列表、查询详情、搜索、删除、迁移
 * 说明：写操作均为 application/x-www-form-urlencoded
 */
import { get, post, toFormData } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 物流公司项（query/search/detail/create/update 返回） */
export interface LogisticsCompanyItem {
  logistics_company_id: string
  company_name: string
  sort_no: number
  status: number
  remark: string | null
  created_at?: string
  updated_at?: string
}

/** 物流公司列表响应（query/search 返回） */
export interface LogisticsCompanyListResponse {
  total: number
  page: number
  page_size: number
  logistics_company: LogisticsCompanyItem[]
}

/** 创建物流公司入参 */
export interface LogisticsCompanyCreatePayload {
  company_name: string
  sort_no: number
  remark?: string
}

/** 修改物流公司入参 */
export interface LogisticsCompanyUpdatePayload {
  logistics_company_id: string
  company_name?: string
  sort_no?: number
  remark?: string
  status?: number
}

/** 物流公司迁移入参 */
export interface LogisticsCompanyMigratePayload {
  source_logistics_company_id: string
  target_logistics_company_id: string
}

/** 查询物流公司列表 */
export function getLogisticsCompanyList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<LogisticsCompanyListResponse>> {
  return get<LogisticsCompanyListResponse>('/api/v1/tenant-logistics-companies/query', params as unknown as Record<string, unknown>)
}

/** 查询物流公司详情 */
export function getLogisticsCompanyDetail(logisticsCompanyId: string): Promise<ApiResponse<LogisticsCompanyItem>> {
  return get<LogisticsCompanyItem>('/api/v1/tenant-logistics-companies/detail', { logistics_company_id: logisticsCompanyId })
}

/** 搜索物流公司（search_field/search_value 为 JSON 字符串） */
export function searchLogisticsCompanies(params: {
  search_field: string
  search_value: string
  page?: number
}): Promise<ApiResponse<LogisticsCompanyListResponse>> {
  return get<LogisticsCompanyListResponse>('/api/v1/tenant-logistics-companies/search', params as unknown as Record<string, unknown>)
}

/** 创建物流公司 */
export function createLogisticsCompany(data: LogisticsCompanyCreatePayload): Promise<ApiResponse<LogisticsCompanyItem>> {
  return post<LogisticsCompanyItem>('/api/v1/tenant-logistics-companies', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改物流公司 */
export function updateLogisticsCompany(logisticsCompanyId: string, data: LogisticsCompanyUpdatePayload): Promise<ApiResponse<LogisticsCompanyItem>> {
  const payload = { ...data, logistics_company_id: logisticsCompanyId }
  return post<LogisticsCompanyItem>('/api/v1/tenant-logistics-companies/update', toFormData(payload as unknown as Record<string, unknown>))
}

/** 删除物流公司 */
export function deleteLogisticsCompany(logisticsCompanyId: string): Promise<ApiResponse<{ logistics_company_id: string }>> {
  return post<{ logistics_company_id: string }>('/api/v1/tenant-logistics-companies/delete', toFormData({ logistics_company_id: logisticsCompanyId }))
}

/** 物流公司迁移 */
export function migrateLogisticsCompany(data: LogisticsCompanyMigratePayload): Promise<ApiResponse<{ source_logistics_company_id: string; target_logistics_company_id: string }>> {
  return post<{ source_logistics_company_id: string; target_logistics_company_id: string }>('/api/v1/tenant-logistics-companies/migrate', toFormData(data as unknown as Record<string, unknown>))
}
