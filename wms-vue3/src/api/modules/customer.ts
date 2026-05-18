/**
 * 模块：客户管理
 * 表名：客户信息表
 * 功能：客户类型/区域/正式客户/公海客户/新开拓客户、导入导出、状态转换
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface CustomerItem {
  id: string
  code: string
  name: string
  shortName: string
  type: string
  category: string
  areaId: string
  areaName: string
  source: string
  level: string
  industry: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  province: string
  city: string
  district: string
  address: string
  creditCode: string
  taxNo: string
  bankName: string
  bankAccount: string
  openingBank: string
  invoiceTitle: string
  invoicePhone: string
  invoiceAddress: string
  settleType: string
  creditAmount: number
  creditDays: number
  status: string
  isFormal: boolean
  isNewDevelop: boolean
  salesUserId: string
  salesUserName: string
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface CustomerQueryParams {
  page: number
  pageSize: number
  code?: string
  name?: string
  type?: string
  category?: string
  areaId?: string
  source?: string
  level?: string
  status?: string
  isFormal?: boolean
  isNewDevelop?: boolean
  salesUserId?: string
}

export interface CustomerListResponse {
  list: CustomerItem[]
  total: number
  page: number
  pageSize: number
}

export function getCustomerList(params: CustomerQueryParams): Promise<ApiResponse<CustomerListResponse>> {
  return get<CustomerListResponse>('/customer/list', params as unknown as Record<string, unknown>)
}

export function getCustomerDetail(id: string): Promise<ApiResponse<CustomerItem>> {
  return get<CustomerItem>(`/customer/${id}`)
}

export function createCustomer(data: Partial<CustomerItem>): Promise<ApiResponse<CustomerItem>> {
  return post<CustomerItem>('/customer', data)
}

export function updateCustomer(id: string, data: Partial<CustomerItem>): Promise<ApiResponse<CustomerItem>> {
  return put<CustomerItem>(`/customer/${id}`, data)
}

export function updateCustomerStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/customer/${id}/status`, { status })
}

export function deleteCustomer(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/customer/${id}`)
}

export function batchDeleteCustomer(ids: string[]): Promise<ApiResponse<null>> {
  return post<null>('/customer/batch-delete', { ids })
}

export function importCustomer(file: FormData): Promise<ApiResponse<{ success: number; fail: number }>> {
  return post<{ success: number; fail: number }>('/customer/import', file)
}

export function exportCustomer(params: CustomerQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/customer/export', params as unknown as Record<string, unknown>)
}

export function getPublicSeaList(params: CustomerQueryParams): Promise<ApiResponse<CustomerListResponse>> {
  return get<CustomerListResponse>('/customer/public-sea/list', params as unknown as Record<string, unknown>)
}

export function claimCustomer(id: string): Promise<ApiResponse<null>> {
  return post<null>(`/customer/public-sea/claim/${id}`)
}

export function batchClaimCustomer(ids: string[]): Promise<ApiResponse<null>> {
  return post<null>('/customer/public-sea/batch-claim', { ids })
}

export function moveToPublicSea(id: string): Promise<ApiResponse<null>> {
  return post<null>(`/customer/public-sea/move/${id}`)
}

export function batchMoveToPublicSea(ids: string[]): Promise<ApiResponse<null>> {
  return post<null>('/customer/public-sea/batch-move', { ids })
}

export function getNewDevelopList(params: CustomerQueryParams): Promise<ApiResponse<CustomerListResponse>> {
  return get<CustomerListResponse>('/customer/new-develop/list', params as unknown as Record<string, unknown>)
}

export function convertToFormal(id: string): Promise<ApiResponse<null>> {
  return post<null>(`/customer/convert-formal/${id}`)
}

export function getCustomerTypeList(): Promise<ApiResponse<{ label: string; value: string }[]>> {
  return get<{ label: string; value: string }[]>('/customer/type/list')
}

export function getCustomerAreaList(): Promise<ApiResponse<{ label: string; value: string }[]>> {
  return get<{ label: string; value: string }[]>('/customer/area/list')
}
