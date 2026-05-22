/**
 * 模块：客户管理
 * 表名：客户类型表
 * 功能：客户类型增删改查
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface CustomerTypeItem {
  id: string
  name: string
  orgId?: string
  orgName?: string
  remark?: string
  status?: string
  createTime?: string
  updateTime?: string
  createUserId?: string
  createUserName?: string
}

export interface CustomerTypeQueryParams {
  page: number
  pageSize: number
  name?: string
  status?: string
}

export interface CustomerTypeListResponse {
  list: CustomerTypeItem[]
  total: number
  page: number
  pageSize: number
}

export function getCustomerTypeItemList(params: CustomerTypeQueryParams): Promise<ApiResponse<CustomerTypeListResponse>> {
  return get<CustomerTypeListResponse>('/customer/type/items', params as unknown as Record<string, unknown>)
}

export function getCustomerTypeItemDetail(id: string): Promise<ApiResponse<CustomerTypeItem>> {
  return get<CustomerTypeItem>(`/customer/type/${id}`)
}

export function createCustomerType(data: Partial<CustomerTypeItem>): Promise<ApiResponse<CustomerTypeItem>> {
  return post<CustomerTypeItem>('/customer/type', data)
}

export function updateCustomerType(id: string, data: Partial<CustomerTypeItem>): Promise<ApiResponse<CustomerTypeItem>> {
  return put<CustomerTypeItem>(`/customer/type/${id}`, data)
}

export function deleteCustomerType(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/customer/type/${id}`)
}

export function updateCustomerTypeStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/customer/type/${id}/status`, { status })
}
