import { safeErrorText, sanitizeDiagnosticPayload } from '@/utils/serverErrorDisplay'
import { showErrorDialog } from '@/utils/errorFeedback'
/**
 * 模块：合包条码查询（扫码枪后端 nuomi_wms_barcode_scanner）
 *
 * 源接口：scanner 端 app/api/v1/endpoints/wms_merge_package/merge_package_query.py
 *         （GET query / detail / search；打印走 scannerPrint.ts 的 printMergePackage）
 * 说明：与 printTask.ts 同构的轻量 axios 实例（token 透传 + ApiResponse 解包 +
 *       错误提示），不修改 scannerPrint.ts（零改动约束）。
 * 数据口径：列表/详情统一返回入库来源单号及 inbound_traces，
 *       详情独有 current_position_info（货位-层-位-塑料盒位置链）；
 *       详情提供出库追溯，列表行补充打印统计并兼容旧版详情。
 */
import axios, { type AxiosInstance } from 'axios'
import { SCANNER_API_BASE_URL } from './scannerPrint'

/* —— 轻量 axios 实例（与 printTask.ts 同构） —— */

interface ApiResponse<T = unknown> {
  success?: boolean
  code?: number
  message: string
  data: T | null
}

const http: AxiosInstance = axios.create({
  baseURL: SCANNER_API_BASE_URL,
  timeout: 30000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => {
    response.data = sanitizeDiagnosticPayload(response.data, response.status)
    const res = response.data as ApiResponse
    if (res.success === false || (res.code !== undefined && res.code !== 200)) {
      const errMsg = typeof res.data === 'string' && res.data ? res.data : res.message
      if (!(response.config as { silent?: boolean }).silent) showErrorDialog(errMsg || '合包查询请求失败')
      return Promise.reject(Object.assign(new Error(errMsg || '合包请求失败'), { response }))
    }
    return response.data
  },
  (error) => {
    if (error.response) error.response.data = sanitizeDiagnosticPayload(error.response.data, error.response.status)
    error.message = safeErrorText(error.message || '网络错误', error.response?.status)
    const resData = error.response?.data as ApiResponse | undefined
    const detail = error.response?.data?.detail
    const errMsg = (typeof resData?.data === 'string' && resData.data) || resData?.message || (typeof detail === 'string' ? detail : detail?.message) || error.message || '网络错误'
    if (!error.config?.silent) showErrorDialog(errMsg)
    return Promise.reject(Object.assign(new Error(errMsg), { response: error.response, code: error.code }))
  },
)

async function getQuery<T>(url: string, params: Record<string, unknown>): Promise<T> {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
  const res = (await http.get(url, { params: cleaned })) as unknown as ApiResponse<T>
  return res.data as T
}

/* —— 数据模型（对应 scanner 端 merge_package_query_schema.py） —— */

export interface GeneratedMergePackage {
  merge_package_id: string
  barcode_code: string
  merge_qty: number
  merge_length?: number
  merge_length_text?: string | null
}

export interface GenerateMergePackageResult {
  new_merge_packages: GeneratedMergePackage[]
  print_hint?: { need_print: boolean; print_type: string; barcode_ids: string[]; print_endpoint: string } | null
}

/** 只生成新合包，不打印、不扣库存；接口无幂等参数，不能自动重试。 */
export async function generateMergePackages(payload: { product_id: string; merge_qty: string; package_count: string; merge_length?: string }): Promise<GenerateMergePackageResult> {
  const form = new FormData()
  form.append('product_id', payload.product_id)
  form.append('merge_qty', payload.merge_qty)
  form.append('package_count', payload.package_count)
  if (payload.merge_length) form.append('merge_length', payload.merge_length)
  const config = { timeout: 60000, silent: true }
  const response = await http.post('/api/v1/tenant-wms/merge-packages/generate-from-product', form, config) as unknown as ApiResponse<GenerateMergePackageResult>
  if (!Array.isArray(response.data?.new_merge_packages) || !response.data.new_merge_packages.length || response.data.new_merge_packages.some(row => !row.merge_package_id || !row.barcode_code)) throw new Error('生成响应未返回完整新条码，请先在列表核对结果')
  return response.data
}

/** 仓库状态：UNOPERATED=未操作，INBOUND=已入库，OUTBOUND=已出库 */
export type MergeWarehouseStatus = 'UNOPERATED' | 'INBOUND' | 'OUTBOUND'

/** 条码有效性：VALID=有效，INVALID=已失效 */
export type MergeBarcodeStatus = 'VALID' | 'INVALID'

/** 来源类型：LOCATION=货位取货，PLASTIC_BOX=塑料盒取货，PRINT=打印创建，MERGE=合包整合，SPLIT=合包拆包 */
export type MergeSourceType = 'LOCATION' | 'PLASTIC_BOX' | 'PRINT' | 'MERGE' | 'SPLIT'

export interface MergePackageInboundTrace {
  inbound_type: string
  inbound_biz_item_id: string
  inbound_doc_id?: string | null
  inbound_doc_no?: string | null
  inbound_item_no?: string | null
  inbound_order_no?: string | null
  inbound_partner_id?: string | null
  inbound_partner_name?: string | null
}

/** 列表/搜索单条记录（MergePackageListItem，列表与搜索共用） */
export interface MergePackageListItem {
  last_inbound_time?: string | null
  merge_package_id: string
  barcode_code: string
  product_id: string
  product_code: string
  product_name: string
  product_item_no: string | null
  product_specification: string | null
  product_color: string | null
  unit_id: string | null
  unit_name: string | null
  merge_qty: number
  warehouse_status: MergeWarehouseStatus | null
  warehouse_status_desc: string | null
  barcode_status: MergeBarcodeStatus | null
  invalid_reason: string | null
  source_type: MergeSourceType | string | null
  source_id: string | null
  source_name: string | null
  position_id: string | null
  position_code: string | null
  location_id: string | null
  location_no: string | null
  location_name: string | null
  bound_plastic_box_id: string | null
  bound_plastic_box_code: string | null
  bound_plastic_box_name: string | null
  inbound_biz_item_id: string | null
  inbound_type: string | null
  inbound_doc_id: string | null
  inbound_doc_no: string | null
  inbound_item_no: string | null
  inbound_order_no: string | null
  inbound_partner_id: string | null
  inbound_partner_name: string | null
  inbound_traces?: MergePackageInboundTrace[]
  outbound_type: string | null
  biz_item_id: string | null
  outbound_doc_id: string | null
  outbound_doc_no: string | null
  outbound_item_no: string | null
  outbound_partner_id: string | null
  outbound_partner_name: string | null
  printed_qty: number
  print_time: string | null
  created_at: string | null
  created_by_name: string | null
}

/** 列表/搜索分页响应（MergePackageListResponseData） */
export interface MergePackageListResponse {
  total: number
  page: number
  page_size: number
  list: MergePackageListItem[]
}

/** 详情当前位置的塑料盒绑定信息（BoundPlasticBoxInfo） */
export interface MergePackageBoundPlasticBoxInfo {
  box_id: string
  box_code: string
  box_name: string
  box_stock_qty: number
}

/** 详情当前位置信息（MergePackageCurrentPositionInfo，未入库未绑定时为 null） */
export interface MergePackageCurrentPositionInfo {
  position_id: string
  position_code: string
  location_id: string
  location_no: string
  location_name: string
  floor_no: number
  position_no: number
  is_bound_plastic_box: boolean
  bound_plastic_box_info: MergePackageBoundPlasticBoxInfo | null
}

/** 详情响应：包含出入库追溯和位置链；打印统计由列表提供。 */
export interface MergePackageDetailResponse {
  biz_item_id?: string | null
  outbound_type?: string | null
  outbound_doc_id?: string | null
  outbound_doc_no?: string | null
  outbound_item_no?: string | null
  last_inbound_time?: string | null
  merge_package_id: string
  barcode_code: string
  barcode_status: MergeBarcodeStatus
  invalid_reason: string
  product_id: string
  product_code: string
  product_name: string
  product_item_no: string | null
  item_no: string | null
  color: string | null
  unit_name: string | null
  specification: string | null
  merge_qty: number
  warehouse_status: MergeWarehouseStatus
  warehouse_status_desc: string
  source_type: MergeSourceType | string | null
  source_id: string | null
  source_name: string | null
  current_position_info: MergePackageCurrentPositionInfo | null
  inbound_biz_item_id: string | null
  inbound_type: string | null
  inbound_doc_id?: string | null
  inbound_doc_no?: string | null
  inbound_item_no?: string | null
  inbound_order_no?: string | null
  inbound_partner_id?: string | null
  inbound_partner_name?: string | null
  inbound_traces?: MergePackageInboundTrace[]
  created_at: string | null
  created_by_name: string | null
}

/* —— 查询封装 —— */

/** 列表查询参数（排序白名单仅 created_at，均为可选） */
export interface MergePackageListQuery {
  page?: number
  page_size?: number
  sort_by?: 'created_at'
  sort_order?: 'asc' | 'desc'
  /**
   * 当前位置维度（2026-11-25 后端新增，query 与 search 均支持）：
   * 模糊匹配「合包现在放在哪」——current_location 匹配货位名称/编号或集散位名称/编号，
   * current_box 匹配塑料盒名称/编码。两者内部按 OR 匹配（名称或编码命中任一即可），
   * 与 keyword 里的「来源货位/来源塑料盒」是两个独立维度，组间取 AND。
   * 不传即不过滤（空串会被请求层清掉）。
   */
  current_location_keyword?: string
  current_box_keyword?: string
  /**
   * 结构化筛选为后端升级预留：当前 query 接口尚未支持这些参数（会被忽略），
   * 后端补齐后前端只需在筛选区放开控件即可，本层不用改。
   */
  warehouse_status?: MergeWarehouseStatus
  date_from?: string
  date_to?: string
}

/** 查看合包列表（默认创建时间倒序；订阅过期时 page_size 被后端压为 10） */
export function queryMergePackages(query: MergePackageListQuery = {}): Promise<MergePackageListResponse> {
  return getQuery<MergePackageListResponse>('/api/v1/tenant-wms/merge-packages/query', { ...query })
}

/**
 * 搜索合包条码：keyword 模糊匹配合包编号/业务ID/产品编码·名称·规格·品号/来源货位·来源塑料盒名/创建人。
 *
 * keyword 可省略——后端自 2026-11-25 起允许「只按当前位置查」：keyword、inbound_doc_no、
 * current_location_keyword、current_box_keyword 四项提供任一即可，全空才 400。
 * 故此处把 keyword 放宽为可选，只填当前位置搜索框时不传 keyword。
 */
export function searchMergePackages(keyword: string | null | undefined, query: MergePackageListQuery = {}): Promise<MergePackageListResponse> {
  return getQuery<MergePackageListResponse>('/api/v1/tenant-wms/merge-packages/search', { keyword, ...query })
}

/** 查看合包详情（merge_package_id 为 mpb_ 前缀） */
export function getMergePackageDetail(mergePackageId: string): Promise<MergePackageDetailResponse> {
  return getQuery<MergePackageDetailResponse>('/api/v1/tenant-wms/merge-packages/detail', {
    merge_package_id: mergePackageId,
  })
}

/* —— 展示辅助：枚举中文映射（后端已给 *_desc 的直接用，其余在前端兜底） —— */

export const MERGE_WAREHOUSE_STATUS_TEXT: Record<string, string> = {
  UNOPERATED: '未操作',
  INBOUND: '已入库',
  OUTBOUND: '已出库',
}

export const MERGE_SOURCE_TYPE_TEXT: Record<string, string> = {
  LOCATION: '货位取货',
  PLASTIC_BOX: '塑料盒取货',
  PRINT: '打印创建',
  MERGE: '合包整合',
  SPLIT: '合包拆包',
}

/**
 * 入库类型中文映射。
 *
 * 取值全集以 scanner 端 `_INBOUND_TYPE_NAME_MAP`
 * （app/services/wms_inbound/inbound_common_service.py）为准：
 * 早期只登记了 PURCHASE_IN / SALES_RETURN 两项，生产入库六类与借出借入、其他入库
 * 落地后未同步补齐，导致详情页「入库追溯-入库类型」直接回退显示英文枚举值。
 * 新增入库类型时两边需一起加，避免再次漏映射。
 */
export const MERGE_INBOUND_TYPE_TEXT: Record<string, string> = {
  PURCHASE_IN: '采购入库',
  SALES_RETURN: '销售退回',
  BORROW_IN: '借入入库',
  LEND_RETURN: '借出还入',
  OTHER_IN: '其他入库',
  PROD_RETURN: '生产退料',
  NP_RETURN: '非生产退料',
  FG_STOCKIN: '成品缴库',
  SUB_RECEIPT: '托外加工缴回',
  SUB_RETURN: '托工退料',
  CUTTING: '物料切割入库',
}

/** 出库类型中文映射（取值全集见 merge_package_query_schema.py 的 outbound_type 说明） */
export const MERGE_OUTBOUND_TYPE_TEXT: Record<string, string> = {
  PURCHASE_RETURN: '采购退回',
  SALES_OUT: '销售出库',
  BORROW_RETURN_OUT: '借入还出出库',
  LEND_OUT: '借出出库',
  PRODUCTION_OUT: '天心生产出库',
  NATIVE_PROD_OUT: '原生生产出库',
}
