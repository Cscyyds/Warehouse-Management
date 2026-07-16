/**
 * 模块：配送管理-物流记录管理（租客接口 tenant-delivery-logistics）
 * 源接口：app/api/v1/endpoints/tenant_delivery_management.py
 * 功能：物流记录查询、详情、绑定/调整承运方、取消
 * 说明：物流记录由 PDA 首次扫码自动生成，不提供手工新增；写操作均为 multipart/form-data
 */
import { get, post, toMultipart, toFormData } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 物流记录项 */
export interface LogisticsRecordItem {
  logistics_barcode_id: string
  company_id: string
  logistics_no: string
  sales_order_id: string | null
  sales_order_no: string | null
  source_type: string
  carrier_type: string
  driver_id: string | null
  driver_type: string | null
  driver_name: string | null
  driver_phone: string | null
  logistics_company_id: string | null
  logistics_company_name: string | null
  carrier_waybill_no: string | null
  status: string
  version_no: number
  deleted_flag: number
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
}

/** 物流记录列表响应 */
export interface LogisticsRecordListResponse {
  total: number
  page: number
  page_size: number
  delivery_logistics: LogisticsRecordItem[]
}

/** 绑定/调整承运方入参 */
export interface BindCarrierPayload {
  logistics_barcode_id: string
  carrier_type: string
  driver_id?: string
  logistics_company_id?: string
  carrier_waybill_no?: string
  version_no: number
  remark?: string
}

/** 取消物流记录入参 */
export interface CancelLogisticsPayload {
  logistics_barcode_id: string
  version_no: number
  cancel_reason?: string
}

/** 查询物流记录列表 */
export function getLogisticsRecordList(params: {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<LogisticsRecordListResponse>> {
  return get<LogisticsRecordListResponse>('/api/v1/tenant-delivery-logistics/query', params as unknown as Record<string, unknown>)
}

/** 搜索物流记录 */
export function searchLogisticsRecords(params: {
  page?: number
  page_size?: number
  sales_order_no?: string
  logistics_no?: string
  carrier_waybill_no?: string
  customer_name?: string
  carrier_type?: string
  driver_id?: string
  logistics_company_id?: string
  status?: string
  created_at_start?: string
  created_at_end?: string
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<LogisticsRecordListResponse>> {
  return get<LogisticsRecordListResponse>('/api/v1/tenant-delivery-logistics/search', params as unknown as Record<string, unknown>)
}

/** 查询物流记录详情 */
export function getLogisticsRecordDetail(logisticsBarcodeId: string): Promise<ApiResponse<LogisticsRecordItem>> {
  return get<LogisticsRecordItem>('/api/v1/tenant-delivery-logistics/detail', { logistics_barcode_id: logisticsBarcodeId })
}

/** 绑定或调整承运方（PENDING_BIND / ACTIVE 状态可操作） */
export function bindCarrier(data: BindCarrierPayload): Promise<ApiResponse<LogisticsRecordItem>> {
  return post<LogisticsRecordItem>('/api/v1/tenant-delivery-logistics/bind-carrier', toMultipart(data as unknown as Record<string, unknown>))
}

/** 取消物流记录（PENDING_BIND / MIGRATION_PENDING 或未被任务占用的 ACTIVE 可取消） */
export function cancelLogisticsRecord(data: CancelLogisticsPayload): Promise<ApiResponse<{ logistics_barcode_id: string }>> {
  return post<{ logistics_barcode_id: string }>('/api/v1/tenant-delivery-logistics/cancel', toFormData(data as unknown as Record<string, unknown>))
}
