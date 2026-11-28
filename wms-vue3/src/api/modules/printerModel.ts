/**
 * 模块：打印机型号查看（租客员工只读）
 * 源接口：app/api/v1/endpoints/tenant_printer_management.py（文档13 接口25-30）
 * 功能：查询平台下发的启用打印机型号及其可用标签规格
 * 说明：型号与标签规格由平台管理员在 admin-web 维护，租客端仅查看，无写操作
 */
import { get } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 标签规格（width_mm / height_mm 后端序列化为两位小数字符串） */
export interface PrinterLabelSpecItem {
  spec_id: string
  printer_model_code: string
  spec_name: string
  width_mm: string
  height_mm: string
  is_default: number
  status: number
  deleted_flag: number
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
}

/** 打印机型号 */
export interface PrinterModelItem {
  model_code: string
  model_name: string
  brand: string
  supported_print_modes: string[]
  density_min: number
  density_max: number
  density_default: number
  supported_label_types: string[]
  connection_types: string[]
  dpi: number
  has_preview_capability: number
  status: number
  remark: string | null
  deleted_flag: number
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
  /** 仅列表接口返回：该型号下启用的标签规格数量 */
  label_spec_count?: number
  /** 仅详情接口返回：该型号下启用的标签规格明细 */
  label_specs?: PrinterLabelSpecItem[]
}

export interface VisiblePrinterModelListResponse {
  total: number
  page: number
  page_size: number
  list: PrinterModelItem[]
}

export interface VisibleLabelSpecListResponse {
  total: number
  page: number
  page_size: number
  list: PrinterLabelSpecItem[]
}

export interface PageParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}

/** 客户员工查询可见打印机型号列表（接口25，分页） */
export function getVisiblePrinterList(params?: PageParams): Promise<ApiResponse<VisiblePrinterModelListResponse>> {
  return get<VisiblePrinterModelListResponse>('/api/v1/tenant-printer-models/query', params as unknown as Record<string, unknown>)
}

/** 客户员工查询可见打印机型号详情（接口26，含启用标签规格） */
export function getVisiblePrinterDetail(modelCode: string): Promise<ApiResponse<PrinterModelItem>> {
  return get<PrinterModelItem>('/api/v1/tenant-printer-models/detail', { model_code: modelCode })
}

/** 客户员工搜索可见打印机型号（接口27；支持 model_name、brand） */
export function searchVisiblePrinterModels(params: PageParams & { search_field: string; search_value: string }): Promise<ApiResponse<VisiblePrinterModelListResponse>> {
  return get<VisiblePrinterModelListResponse>('/api/v1/tenant-printer-models/search', params as unknown as Record<string, unknown>)
}

/** 客户员工查询可见标签规格列表（接口28） */
export function getVisibleLabelSpecList(params: PageParams & { model_code: string }): Promise<ApiResponse<VisibleLabelSpecListResponse>> {
  return get<VisibleLabelSpecListResponse>('/api/v1/tenant-printer-label-specs/query', params as unknown as Record<string, unknown>)
}

/** 客户员工查询可见标签规格详情（接口29） */
export function getVisibleLabelSpecDetail(specId: string): Promise<ApiResponse<PrinterLabelSpecItem>> {
  return get<PrinterLabelSpecItem>('/api/v1/tenant-printer-label-specs/detail', { spec_id: specId })
}

/** 客户员工搜索可见标签规格（接口30；支持 spec_name、width_mm、height_mm、is_default） */
export function searchVisibleLabelSpecs(params: PageParams & { model_code: string; search_field: string; search_value: string }): Promise<ApiResponse<VisibleLabelSpecListResponse>> {
  return get<VisibleLabelSpecListResponse>('/api/v1/tenant-printer-label-specs/search', params as unknown as Record<string, unknown>)
}
