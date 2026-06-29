/**
 * 模块：打印机管理（租客接口）
 * 源接口：app/api/v1/endpoints/tenant_wms_management.py
 * 功能：打印机 CRUD/查询/搜索
 * 说明：写操作均为 application/x-www-form-urlencoded（toFormData）
 *       列表查询返回完整字段，无需批量调详情
 */
import { get, post, toFormData } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 打印机完整对象 */
export interface PrinterItem {
  printer_id: string
  printer_name: string
  ip_address: string
  port: number
  remark: string | null
  created_at: string
  created_by: string
  created_by_name: string
}

/** 列表/搜索响应 */
export interface PrinterListResponse {
  total: number
  page: number
  page_size: number
  items: PrinterItem[]
}

/** 查询参数 */
export interface PrinterQueryParams {
  page?: number
  sort_by?: string
  sort_order?: string
}

/** 新增入参 */
export interface PrinterCreatePayload {
  printer_name: string
  ip_address: string
  port: number
  remark?: string
}

/** 修改入参 */
export interface PrinterUpdatePayload {
  printer_name?: string
  ip_address?: string
  port?: number
  remark?: string
}

/** 查看打印机列表（接口32） */
export function getPrinterList(params: PrinterQueryParams): Promise<ApiResponse<PrinterListResponse>> {
  return get<PrinterListResponse>('/api/v1/tenant-printers/query', params as unknown as Record<string, unknown>)
}

/** 查看指定打印机（接口33） */
export function getPrinterDetail(printerId: string): Promise<ApiResponse<PrinterItem>> {
  return get<PrinterItem>('/api/v1/tenant-printers/detail', { printer_id: printerId })
}

/** 搜索打印机（接口34） */
export function searchPrinters(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<PrinterListResponse>> {
  return get<PrinterListResponse>('/api/v1/tenant-printers/search', params as unknown as Record<string, unknown>)
}

/** 新建打印机（接口29） */
export function createPrinter(data: PrinterCreatePayload): Promise<ApiResponse<PrinterItem>> {
  return post<PrinterItem>('/api/v1/tenant-printers', toFormData(data as unknown as Record<string, unknown>))
}

/** 更改打印机信息（接口30） */
export function updatePrinter(printerId: string, data: PrinterUpdatePayload): Promise<ApiResponse<PrinterItem>> {
  const payload = { ...data, printer_id: printerId }
  return post<PrinterItem>('/api/v1/tenant-printers/update', toFormData(payload as unknown as Record<string, unknown>))
}

/** 删除打印机（接口31） */
export function deletePrinter(printerId: string): Promise<ApiResponse<{ printer_id: string }>> {
  return post<{ printer_id: string }>('/api/v1/tenant-printers/delete', toFormData({ printer_id: printerId }))
}
