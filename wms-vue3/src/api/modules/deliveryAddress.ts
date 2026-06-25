/**
 * 模块：正式客户送货地址（tenant-customer-delivery-addresses）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：送货地址创建、更新、查询列表、删除（软删除）
 * 说明：写操作均为 multipart/form-data；is_default=1 时自动重置同客户其他默认地址
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 送货地址项（query 返回） */
export interface DeliveryAddressItem {
  delivery_address_id: string
  customer_id: string
  address: string
  detail_address: string
  receiver_name: string
  receiver_phone: string
  is_default: number
  status: number
  operation?: string
  created_by?: string
  created_by_name?: string
  created_at?: string
  updated_at?: string
}

/** 送货地址列表响应 */
export interface DeliveryAddressListResponse {
  total: number
  delivery_address: DeliveryAddressItem[]
}

/** 创建送货地址入参 */
export interface DeliveryAddressCreatePayload {
  customer_id: string
  address: string
  detail_address: string
  receiver_name: string
  receiver_phone: string
  is_default: number
  status: number
  operation?: string
}

/** 修改送货地址入参 */
export interface DeliveryAddressUpdatePayload {
  delivery_address_id: string
  address: string
  detail_address: string
  receiver_name: string
  receiver_phone: string
  is_default: number
  status: number
  operation?: string
}

/** 创建送货地址 */
export function createDeliveryAddress(data: DeliveryAddressCreatePayload): Promise<ApiResponse<DeliveryAddressItem>> {
  return post<DeliveryAddressItem>(
    '/api/v1/tenant-customer-delivery-addresses',
    toMultipart(data as unknown as Record<string, unknown>)
  )
}

/** 更新送货地址 */
export function updateDeliveryAddress(data: DeliveryAddressUpdatePayload): Promise<ApiResponse<DeliveryAddressItem>> {
  return post<DeliveryAddressItem>(
    '/api/v1/tenant-customer-delivery-addresses/update',
    toMultipart(data as unknown as Record<string, unknown>)
  )
}

/** 查询送货地址列表 */
export function getDeliveryAddressList(params: {
  customer_id: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<DeliveryAddressListResponse>> {
  return get<DeliveryAddressListResponse>(
    '/api/v1/tenant-customer-delivery-addresses/query',
    params as unknown as Record<string, unknown>
  )
}

/** 删除送货地址（软删除） */
export function deleteDeliveryAddress(
  deliveryAddressId: string
): Promise<ApiResponse<{ delivery_address_id: string }>> {
  return post<{ delivery_address_id: string }>(
    '/api/v1/tenant-customer-delivery-addresses/delete',
    toMultipart({ delivery_address_id: deliveryAddressId })
  )
}
