/**
 * 模块：配送管理-PDA扫描装货（租客接口 tenant-delivery-load）
 * 源接口：app/api/v1/endpoints/tenant_delivery_management.py
 * 功能：扫描销售订单、查询待分配明细列表、删除装货明细
 * 说明：写操作均为 multipart/form-data
 */
import { get, post, toFormData, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 扫描结果 */
export interface ScanResult {
  logistics_barcode_id: string
  logistics_no: string
  logistics_status: string
  carrier_type: string
  delivery_load_detail_id: string
  delivery_task_id: string | null
  load_status: string
  sales_order_no: string
  customer_name: string | null
  customer_phone: string | null
  delivery_address: string | null
  detail_address: string | null
  dest_lng: string | null
  dest_lat: string | null
  delivery_quantity: number
  idempotent_replay: boolean
}

/** 待分配装货明细项 */
export interface ScanDetailItem {
  delivery_load_detail_id: string
  company_id: string
  delivery_task_id: string | null
  logistics_barcode_id: string | null
  logistics_no: string | null
  sales_order_id: string | null
  sales_order_no: string
  source_type: string
  carrier_type: string
  driver_id: string | null
  driver_type: string | null
  driver_name: string | null
  driver_phone: string | null
  logistics_company_id: string | null
  logistics_company_name: string | null
  carrier_waybill_no: string | null
  customer_name: string | null
  customer_phone: string | null
  delivery_address: string | null
  detail_address: string | null
  dest_lng: string | null
  dest_lat: string | null
  delivery_quantity: number
  status: string
  created_at: string
}

/** 待分配明细列表响应 */
export interface ScanDetailListResponse {
  total: number
  page: number
  page_size: number
  items: ScanDetailItem[]
}

/** 扫描销售订单
 * @param sales_order_no 销售订单号
 * @param delivery_task_id 可选；传入时进入任务驱动模式，明细直接 LOADED 并绑定到该任务
 */
export function scanSalesOrder(data: {
  sales_order_no: string
  delivery_task_id?: string
}): Promise<ApiResponse<ScanResult>> {
  return post<ScanResult>('/api/v1/tenant-delivery-load/scan', toMultipart(data as unknown as Record<string, unknown>))
}

/** 查询扫描明细列表（待分配） */
export function getScanDetailList(params: {
  page?: number
  carrier_type?: string
  driver_id?: string
  logistics_company_id?: string
  keyword?: string
}): Promise<ApiResponse<ScanDetailListResponse>> {
  return get<ScanDetailListResponse>('/api/v1/tenant-delivery-load/scan-list', params as unknown as Record<string, unknown>)
}

/** 删除装货明细（软删除，仅 PENDING 且未绑定任务的明细可删） */
export function deleteLoadDetail(deliveryLoadDetailId: string): Promise<ApiResponse<null>> {
  return post<null>('/api/v1/tenant-delivery-load/delete', toFormData({ delivery_load_detail_id: deliveryLoadDetailId }))
}
