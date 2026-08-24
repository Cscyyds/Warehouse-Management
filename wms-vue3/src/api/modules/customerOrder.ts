import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse, RequestConfig } from '@/utils/request'

export interface CustomerOrderItem {
  customer_order_item_id: string
  customer_order_id: string
  product_id: string
  product_code: string
  product_name: string
  product_type?: string
  specification?: string | null
  color?: string | null
  unit_id?: string
  unit_name?: string | null
  qty: string
  project_name?: string | null
  line_remark?: string | null
  order_no?: string
  customer_name?: string
  audit_status?: number
  created_at?: string
}

export interface CustomerOrderFile { file_ref_id?: string; file_id?: string; file_name: string; file_url: string; file_ext?: string; file_size?: number; sort_no?: number }
export interface CustomerOrder {
  customer_order_id: string
  order_no: string
  customer_id: string
  customer_name: string
  remark?: string | null
  audit_status: 0 | 1 | 2 | 3
  audit_status_name?: string
  audit_by?: string
  audit_by_name?: string
  audit_time?: string
  status: number
  deleted_flag?: number
  created_at?: string
  created_by?: string
  created_by_name?: string
  updated_at?: string
  updated_by?: string
  updated_by_name?: string
  items?: CustomerOrderItem[]
  images?: CustomerOrderFile[]
  attachments?: CustomerOrderFile[]
}
export interface CustomerOrderPage { total: number; page: number; page_size: number; customer_orders: CustomerOrder[] }
export interface CustomerOrderItemPage { total: number; page: number; page_size: number; items: CustomerOrderItem[] }
export interface CustomerOrderCreatePayload { customer_id: string; remark?: string; items: string; images?: File[]; attachments?: File[] }

function form(data: Record<string, unknown>): URLSearchParams {
  const p = new URLSearchParams()
  Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null) p.append(k, String(v)) })
  return p
}

export function createCustomerOrder(data: CustomerOrderCreatePayload): Promise<ApiResponse<CustomerOrder>> {
  const fd = toMultipart({ customer_id: data.customer_id, remark: data.remark, items: data.items })
  data.images?.forEach(f => fd.append('images', f)); data.attachments?.forEach(f => fd.append('attachments', f))
  return post<CustomerOrder>('/api/v1/tenant-customer-orders/create', fd)
}
export function updateCustomerOrder(customer_order_id: string, remark?: string, files?: { images?: File[]; attachments?: File[] }): Promise<ApiResponse<CustomerOrder>> {
  const fd = toMultipart({ customer_order_id, remark })
  files?.images?.forEach(f => fd.append('images', f)); files?.attachments?.forEach(f => fd.append('attachments', f))
  return post<CustomerOrder>('/api/v1/tenant-customer-orders/update', fd)
}
export function deleteCustomerOrder(customer_order_id: string) { return post<{ customer_order_id: string }>('/api/v1/tenant-customer-orders/delete', form({ customer_order_id })) }
export function createCustomerOrderItems(customer_order_id: string, items: unknown[]) { return post<CustomerOrder>('/api/v1/tenant-customer-orders/items/create', form({ customer_order_id, items: JSON.stringify(items) })) }
export function updateCustomerOrderItems(customer_order_id: string, items: unknown[]) { return post<CustomerOrder>('/api/v1/tenant-customer-orders/items/update', form({ customer_order_id, items: JSON.stringify(items) })) }
export function deleteCustomerOrderItem(customer_order_item_id: string) { return post<CustomerOrder>('/api/v1/tenant-customer-orders/items/delete', form({ customer_order_item_id })) }
export function auditCustomerOrder(customer_order_ids: string[], audit_status: number) { return post<CustomerOrder>('/api/v1/tenant-customer-orders/audit', form({ customer_order_id: JSON.stringify(customer_order_ids), audit_status })) }
export function deleteCustomerOrderFiles(customer_order_id: string, file_urls: string[], kind: 'images' | 'attachments') { return post<{ deleted_count: number }>(`/api/v1/tenant-customer-orders/${kind}/delete`, form({ customer_order_id, file_urls: JSON.stringify(file_urls) })) }
export function getCustomerOrderList(params: Record<string, unknown>, config?: RequestConfig) { return get<CustomerOrderPage>('/api/v1/tenant-customer-orders/list', params, config) }
export function searchCustomerOrders(params: Record<string, unknown>, config?: RequestConfig) { return get<CustomerOrderPage>('/api/v1/tenant-customer-orders/search', params, config) }
export function getCustomerOrderDetail(customer_order_id: string) { return get<CustomerOrder>('/api/v1/tenant-customer-orders/detail', { customer_order_id }) }
export function getCustomerOrderItems(params: Record<string, unknown>) { return get<CustomerOrderItemPage>('/api/v1/tenant-customer-orders/items/list', params) }
export function searchCustomerOrderItems(params: Record<string, unknown>) { return get<CustomerOrderItemPage>('/api/v1/tenant-customer-orders/items/search', params) }
