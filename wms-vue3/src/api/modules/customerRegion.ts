/**
 * 模块：客户管理
 * 表名：区域管理表
 * 功能：区域管理增删改查
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface CustomerRegionItem {
  id: string
  name: string
  orgId: string
  orgName: string
  status: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface CustomerRegionQueryParams {
  page: number
  pageSize: number
  name?: string
  status?: string
}

export interface CustomerRegionListResponse {
  list: CustomerRegionItem[]
  total: number
  page: number
  pageSize: number
}

export function getCustomerRegionList(params: CustomerRegionQueryParams): Promise<ApiResponse<CustomerRegionListResponse>> {
  return get<CustomerRegionListResponse>('/customer/region/list', params as unknown as Record<string, unknown>)
}

export function getCustomerRegionDetail(id: string): Promise<ApiResponse<CustomerRegionItem>> {
  return get<CustomerRegionItem>(`/customer/region/${id}`)
}

export function createCustomerRegion(data: Partial<CustomerRegionItem>): Promise<ApiResponse<CustomerRegionItem>> {
  return post<CustomerRegionItem>('/customer/region', data)
}

export function updateCustomerRegion(id: string, data: Partial<CustomerRegionItem>): Promise<ApiResponse<CustomerRegionItem>> {
  return put<CustomerRegionItem>(`/customer/region/${id}`, data)
}

export function deleteCustomerRegion(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/customer/region/${id}`)
}

export function updateCustomerRegionStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/customer/region/${id}/status`, { status })
}
