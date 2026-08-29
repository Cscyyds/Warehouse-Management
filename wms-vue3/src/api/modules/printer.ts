/**
 * 模块：打印机设备管理（租客接口）
 * 源接口：app/api/v1/endpoints/tenant_wms_management.py
 * 功能：打印机设备 CRUD/查询/搜索
 * 说明：写操作均为 application/x-www-form-urlencoded（toFormData）
 *
 * 注意：后端新增的打印机型号模块（tenant_printer_management.py）注册了同名路径
 *   GET /api/v1/tenant-printers/query 与 /detail，且注册顺序更早，
 *   已遮蔽本模块对应的设备列表与详情接口。因此这里的列表/详情统一改走
 *   未被遮蔽的 /tenant-printers/search 接口实现。打印机型号相关能力见 printerModel.ts。
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
  page_size?: number
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

/** 搜索打印机（接口34） */
export function searchPrinters(params: {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<PrinterListResponse>> {
  return get<PrinterListResponse>('/api/v1/tenant-printers/search', params as unknown as Record<string, unknown>)
}

/**
 * 查看打印机列表（接口32）
 * GET /tenant-printers/query 已被打印机型号模块遮蔽，改用 search 接口：
 * printer_name 为 like 匹配，传空串等价于无条件匹配全部设备。
 */
export function getPrinterList(params: PrinterQueryParams): Promise<ApiResponse<PrinterListResponse>> {
  return searchPrinters({
    search_field: JSON.stringify(['printer_name']),
    search_value: JSON.stringify({ printer_name: '' }),
    page: params.page,
    page_size: params.page_size,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

/**
 * 查看指定打印机（接口33）
 * GET /tenant-printers/detail 已被打印机型号模块遮蔽，改用 search 接口按 ID 定位：
 * search 不支持 printer_id 字段，故取全量后在前端匹配。
 */
export async function getPrinterDetail(printerId: string): Promise<ApiResponse<PrinterItem>> {
  const res = await getPrinterList({ page: 1, page_size: 100 })
  const found = res.data.items.find(item => item.printer_id === printerId)
  if (!found) throw new Error('打印机不存在或已删除')
  return { ...res, data: found } as ApiResponse<PrinterItem>
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
