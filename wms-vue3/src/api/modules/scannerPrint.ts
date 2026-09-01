/**
 * 模块：条码打印（扫码枪后端 nuomi_wms_barcode_scanner）
 *
 * 源接口：scanner 端 app/api/v1/endpoints/wms_inbound/inbound_operation.py 等与
 *         docs/打印接口对接说明.md（接口1-16）
 * 鉴权：与主后端共用 JWT（JWT_SECRET_KEY 一致），token 从 localStorage 透传
 * baseURL：scanner 独立服务，通过 VITE_SCANNER_API_BASE_URL 配置；
 *          开发默认 http://127.0.0.1:8010（scanner .env APP_PORT），生产须配置完整地址
 *
 * 说明：打印接口均为 multipart/form-data（URLSearchParams），中文参数
 *       print_mode_hardware（如"热敏"）与 label_type（如"间隙纸"）直传
 */
import axios, { type AxiosInstance } from 'axios'
import { ElMessage } from 'element-plus'

/** scanner 后端独立 baseURL；开发环境默认本机 8010 */
export const SCANNER_API_BASE_URL: string =
  (import.meta.env.VITE_SCANNER_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:8010'

/** scanner 专用 axios 实例：token 复用主站登录态 */
const scannerHttp: AxiosInstance = axios.create({
  baseURL: SCANNER_API_BASE_URL,
  timeout: 30000,
})

scannerHttp.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

scannerHttp.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResponse
    if (res.success === false || (res.code !== undefined && res.code !== 200)) {
      // 失败响应的 data 常为字符串错误详情
      const errMsg = typeof res.data === 'string' && res.data ? res.data : res.message
      ElMessage.error(errMsg || '打印请求失败')
      return Promise.reject(new Error(errMsg || '打印请求失败'))
    }
    return response.data
  },
  (error) => {
    const resData = error.response?.data as ApiResponse | undefined
    const errMsg = (typeof resData?.data === 'string' && resData.data) || resData?.message || error.message || '网络错误'
    ElMessage.error(errMsg)
    return Promise.reject(new Error(errMsg))
  },
)

interface ApiResponse<T = unknown> {
  success?: boolean
  code?: number
  message: string
  data: T | null
}

/** 打印机配置摘要（打印接口返回的 printer_config） */
export interface PrinterConfig {
  model_code: string
  model_name: string
  density_default: number
  density_min: number
  density_max: number
  supported_label_types: string[]
}

/** 本次生效的标签规格 */
export interface LabelSpecInfo {
  spec_id: string
  spec_name: string
  width_mm: number
  height_mm: number
}

/** 精臣 SDK 打印数据（前端原样透传给本地 SDK） */
export interface PrintData {
  InitDrawingBoardParam: {
    width: number
    height: number
    rotate: number
    dpi?: number
    printMode?: string
    density?: number
    [key: string]: unknown
  }
  elements: Array<{ type: string; json: Record<string, unknown> }>
}

/** 单条码打印接口的统一响应（文档接口3-8 响应公共字段） */
export interface BarcodePrintResult {
  printer_has_preview_capability: boolean
  print_mode: 'PREVIEW' | 'PRINT'
  selected_print_mode_hardware: string
  selected_label_type: string
  sdk_type: 'JC' | null
  print_data: PrintData | null
  printer_config: PrinterConfig | null
  label_spec: LabelSpecInfo
  pdf_url: string | null
  expire_seconds: number | null
  [key: string]: unknown
}

/** 打印公共参数（文档「公共请求参数」） */
export interface PrintCommonParams {
  printer_model_code: string
  label_spec_id: string
  print_mode: 'PREVIEW' | 'PRINT'
  /** 硬件打印模式中文值，须在型号 supported_print_modes 内 */
  print_mode_hardware: string
  /** 纸张类型中文值，须在型号 supported_label_types 内 */
  label_type: string
  print_qty: number
  density?: number
}

function toForm(data: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value))
    }
  })
  return params
}

async function postForm<T>(url: string, data: Record<string, unknown>): Promise<T> {
  // 响应拦截器已将 axios response 解包为 ApiResponse（{success, message, data}），此处取 .data 即业务数据
  const res = (await scannerHttp.post(url, toForm(data), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })) as unknown as ApiResponse<T>
  return res.data as T
}

/* —— 纯打印接口（文档接口3-8） —— */

/** 打印塑料盒条码（接口3，box_id 为 pbox_ 前缀） */
export function printPlasticBox(boxId: string, params: PrintCommonParams): Promise<BarcodePrintResult> {
  return postForm<BarcodePrintResult>('/api/v1/tenant-wms/plastic-boxes/print', {
    ...params, box_id: boxId,
  })
}

/** 打印产品条码（接口4，product_id 为 prd_ 前缀） */
export function printProductBarcode(productId: string, params: PrintCommonParams): Promise<BarcodePrintResult> {
  return postForm<BarcodePrintResult>('/api/v1/tenant-wms/product-barcodes/print', {
    ...params, product_id: productId,
  })
}

/** 打印货位条码（接口5，location_id 为 loc_ 前缀） */
export function printLocationBarcode(locationId: string, params: PrintCommonParams): Promise<BarcodePrintResult> {
  return postForm<BarcodePrintResult>('/api/v1/tenant-wms/locations/print', {
    ...params, location_id: locationId,
  })
}

/** 打印位置条码（接口6，position_id 为 pos_ 前缀） */
export function printPositionBarcode(positionId: string, params: PrintCommonParams): Promise<BarcodePrintResult> {
  return postForm<BarcodePrintResult>('/api/v1/tenant-wms/product-positions/print', {
    ...params, position_id: positionId,
  })
}

/** 打印塑料盒出库条码（接口7，plastic_box_outbound_barcode_id 为 pbob_ 前缀） */
export function printPlasticBoxOutbound(outboundBarcodeId: string, params: PrintCommonParams): Promise<BarcodePrintResult> {
  return postForm<BarcodePrintResult>('/api/v1/tenant-wms/plastic-box-outbound/print', {
    ...params, plastic_box_outbound_barcode_id: outboundBarcodeId,
  })
}

/** 打印合包条码-补打（接口8，merge_package_id 为 mpb_ 前缀） */
export function printMergePackage(mergePackageId: string, params: PrintCommonParams): Promise<BarcodePrintResult> {
  return postForm<BarcodePrintResult>('/api/v1/tenant-wms/merge-packages/print', {
    ...params, merge_package_id: mergePackageId,
  })
}

/** 批量打印 items 结构（接口1/2 的 items 元素） */
export interface BarcodePrintItem {
  type: 'SINGLE' | 'MERGE'
  print_qty: number
  /** MERGE 时必填：合包数量 */
  merge_qty?: number
}

/** 打印入库条码-采购入库（接口1，散件+大包混合） */
export function printPurchaseInBarcodes(purchaseReceiptItemId: string, items: BarcodePrintItem[], params: Omit<PrintCommonParams, 'print_qty'>): Promise<{ items: Array<Record<string, unknown>> } & Record<string, unknown>> {
  return postForm('/api/v1/tenant-wms/inbound-barcodes/print/purchase-in', {
    ...params,
    purchase_receipt_item_id: purchaseReceiptItemId,
    items: JSON.stringify(items),
  })
}

/** 打印入库条码-销售退回（接口2，结构同接口1） */
export function printSalesReturnBarcodes(salesReturnItemId: string, items: BarcodePrintItem[], params: Omit<PrintCommonParams, 'print_qty'>): Promise<{ items: Array<Record<string, unknown>> } & Record<string, unknown>> {
  return postForm('/api/v1/tenant-wms/inbound-barcodes/print/sales-return', {
    ...params,
    sales_return_item_id: salesReturnItemId,
    items: JSON.stringify(items),
  })
}

/** 主动删除临时 PDF（接口16；情况B的 pdf_url 用完即清，过期机制兜底） */
export function deletePrintTempFiles(fileUrls: string[]): Promise<{ deleted_count: number; failed_urls: string[] }> {
  return postForm('/api/v1/tenant-wms/print-temp-files/delete', { file_urls: JSON.stringify(fileUrls) })
}
