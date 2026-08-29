/**
 * 模块：打印机型号查看（租客员工只读）
 * 源接口：app/api/v1/endpoints/tenant_printer_management.py
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

/** 列表响应（后端一次返回全部启用型号，不分页） */
export interface VisiblePrinterListResponse {
  total: number
  printers: PrinterModelItem[]
}

/** 查询可见打印机型号列表 */
export function getVisiblePrinterList(): Promise<ApiResponse<VisiblePrinterListResponse>> {
  return get<VisiblePrinterListResponse>('/api/v1/tenant-printers/query')
}

/** 查询可见打印机型号详情（含启用标签规格） */
export function getVisiblePrinterDetail(modelCode: string): Promise<ApiResponse<PrinterModelItem>> {
  return get<PrinterModelItem>('/api/v1/tenant-printers/detail', { model_code: modelCode })
}
