/**
 * 模块：正式客户联系人（tenant-customer-contacts）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：联系人创建、更新、查询列表、删除（软删除，status 置 0）
 * 说明：写操作均为 multipart/form-data；contact_phone 同客户下唯一
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 联系人项（query 返回） */
export interface CustomerContactItem {
  contact_id: string
  customer_id: string
  contact_name: string
  contact_phone: string
  position?: string
  detail_info?: string
  status: number
  operation?: string
  created_by?: string
  created_by_name?: string
  created_at?: string
  updated_at?: string
}

/** 联系人列表响应 */
export interface CustomerContactListResponse {
  total: number
  contact: CustomerContactItem[]
}

/** 创建联系人入参 */
export interface CustomerContactCreatePayload {
  customer_id: string
  contact_name: string
  contact_phone: string
  position?: string
  detail_info?: string
  status: number
  operation?: string
}

/** 修改联系人入参 */
export interface CustomerContactUpdatePayload {
  contact_id: string
  contact_name: string
  contact_phone: string
  position?: string
  detail_info?: string
  status: number
  operation?: string
}

/** 创建联系人 */
export function createCustomerContact(data: CustomerContactCreatePayload): Promise<ApiResponse<CustomerContactItem>> {
  return post<CustomerContactItem>(
    '/api/v1/tenant-customer-contacts',
    toMultipart(data as unknown as Record<string, unknown>)
  )
}

/** 更新联系人 */
export function updateCustomerContact(data: CustomerContactUpdatePayload): Promise<ApiResponse<CustomerContactItem>> {
  return post<CustomerContactItem>(
    '/api/v1/tenant-customer-contacts/update',
    toMultipart(data as unknown as Record<string, unknown>)
  )
}

/** 查询联系人列表 */
export function getCustomerContactList(params: {
  customer_id: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<CustomerContactListResponse>> {
  return get<CustomerContactListResponse>(
    '/api/v1/tenant-customer-contacts/query',
    params as unknown as Record<string, unknown>
  )
}

/** 删除联系人（软删除，status 置 0） */
export function deleteCustomerContact(contactId: string): Promise<ApiResponse<{ contact_id: string }>> {
  return post<{ contact_id: string }>(
    '/api/v1/tenant-customer-contacts/delete',
    toMultipart({ contact_id: contactId })
  )
}
