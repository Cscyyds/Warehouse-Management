import { getData, postForm } from './http'

/** 打印机型号（printer_model 表全字段） */
export interface PrinterModelRow {
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
  /** 仅列表接口返回：该型号下未删除的标签规格数量 */
  label_spec_count?: number
}

/** 标签规格（width_mm / height_mm 后端序列化为两位小数字符串） */
export interface PrinterLabelSpecRow {
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

export interface PagedResult<T> {
  total: number
  page: number
  page_size: number
  list: T[]
}

export interface PagedQueryParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}

export interface SearchParams extends PagedQueryParams {
  search_field: string[]
  search_value: Record<string, string>
}

/** 型号新增 / 编辑入参（后端编辑接口要求全量字段） */
export interface PrinterModelPayload {
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
  remark?: string
}

/** 标签规格新增入参 */
export interface PrinterLabelSpecPayload {
  spec_name: string
  width_mm: number | string
  height_mm: number | string
  is_default: number
  status: number
}

// 数组字段交给 toUrlEncoded 统一 JSON 序列化，此处只补齐 remark 空值
function toModelForm(payload: PrinterModelPayload) {
  return { ...payload, remark: payload.remark ?? '' }
}

function toSearchQuery(params: SearchParams) {
  const { search_field, search_value, ...rest } = params
  return { ...rest, search_field: JSON.stringify(search_field), search_value: JSON.stringify(search_value) }
}

/* —— 打印机型号 —— */

export const queryPrinterModels = (params: PagedQueryParams = {}) =>
  getData<PagedResult<PrinterModelRow>>('/platform-printer-models/query', { page: 1, page_size: 20, ...params })

export const getPrinterModel = (modelCode: string) =>
  getData<PrinterModelRow>('/platform-printer-models/detail', { model_code: modelCode })

/** 搜索型号，可用字段：model_name、brand */
export const searchPrinterModels = (params: SearchParams) =>
  getData<PagedResult<PrinterModelRow>>('/platform-printer-models/search', { page: 1, page_size: 20, ...toSearchQuery(params) })

export const createPrinterModel = (payload: PrinterModelPayload) =>
  postForm<PrinterModelRow>('/platform-printer-models', toModelForm(payload))

export const updatePrinterModel = (modelCode: string, payload: PrinterModelPayload) =>
  postForm<PrinterModelRow>('/platform-printer-models/update', { ...toModelForm(payload), model_code: modelCode })

/** 删除型号会级联软删除其下全部标签规格 */
export const deletePrinterModel = (modelCode: string) =>
  postForm<{ model_code: string; deleted_label_specs_count: number }>('/platform-printer-models/delete', { model_code: modelCode })

/* —— 标签规格 —— */

export const queryPrinterLabelSpecs = (modelCode: string, params: PagedQueryParams = {}) =>
  getData<PagedResult<PrinterLabelSpecRow>>('/platform-printer-label-specs/query', {
    model_code: modelCode, page: 1, page_size: 20, sort_by: 'is_default', sort_order: 'DESC', ...params,
  })

export const getPrinterLabelSpec = (specId: string) =>
  getData<PrinterLabelSpecRow>('/platform-printer-label-specs/detail', { spec_id: specId })

/** 搜索标签规格，可用字段：spec_name、width_mm、height_mm、is_default */
export const searchPrinterLabelSpecs = (modelCode: string, params: SearchParams) =>
  getData<PagedResult<PrinterLabelSpecRow>>('/platform-printer-label-specs/search', {
    model_code: modelCode, page: 1, page_size: 20, ...toSearchQuery(params),
  })

export const createPrinterLabelSpec = (modelCode: string, payload: PrinterLabelSpecPayload) =>
  postForm<PrinterLabelSpecRow>('/platform-printer-label-specs', { ...payload, model_code: modelCode })

export const updatePrinterLabelSpec = (specId: string, payload: PrinterLabelSpecPayload) =>
  postForm<PrinterLabelSpecRow>('/platform-printer-label-specs/update', { ...payload, spec_id: specId })

/** 删除默认规格时后端自动将默认标记迁移到最早创建的其他有效规格 */
export const deletePrinterLabelSpec = (specId: string) =>
  postForm<{ spec_id: string; new_default_spec_id: string | null }>('/platform-printer-label-specs/delete', { spec_id: specId })
