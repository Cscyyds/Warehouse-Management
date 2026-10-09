/**
 * 模块：合包条码查询（扫码枪后端 nuomi_wms_barcode_scanner）
 *
 * 源接口：scanner 端 app/api/v1/endpoints/wms_merge_package/merge_package_query.py
 *         （GET query / detail / search；打印走 scannerPrint.ts 的 printMergePackage）
 * 说明：与 printTask.ts 同构的轻量 axios 实例（token 透传 + ApiResponse 解包 +
 *       错误提示），不修改 scannerPrint.ts（零改动约束）。
 * 数据口径：列表/搜索项字段比详情丰富（含打印次数与出入库单据追溯），
 *       详情独有 current_position_info（货位-层-位-塑料盒位置链）；
 *       合包管理详情页由两者拼合展示（后端后续若补齐详情字段可简化）。
 */
import axios, { type AxiosInstance } from 'axios'
import { ElMessage } from 'element-plus'
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
    const res = response.data as ApiResponse
    if (res.success === false || (res.code !== undefined && res.code !== 200)) {
      const errMsg = typeof res.data === 'string' && res.data ? res.data : res.message
      ElMessage.error(errMsg || '合包查询请求失败')
      return Promise.reject(new Error(errMsg || '合包查询请求失败'))
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

async function getQuery<T>(url: string, params: Record<string, unknown>): Promise<T> {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
  const res = (await http.get(url, { params: cleaned })) as unknown as ApiResponse<T>
  return res.data as T
}

/* —— 数据模型（对应 scanner 端 merge_package_query_schema.py） —— */

/** 仓库状态：UNOPERATED=未操作，INBOUND=已入库，OUTBOUND=已出库 */
export type MergeWarehouseStatus = 'UNOPERATED' | 'INBOUND' | 'OUTBOUND'

/** 条码有效性：VALID=有效，INVALID=已失效 */
export type MergeBarcodeStatus = 'VALID' | 'INVALID'

/** 来源类型：LOCATION=货位取货，PLASTIC_BOX=塑料盒取货，PRINT=打印创建，MERGE=合包整合，SPLIT=合包拆包 */
export type MergeSourceType = 'LOCATION' | 'PLASTIC_BOX' | 'PRINT' | 'MERGE' | 'SPLIT'

/** 列表/搜索单条记录（MergePackageListItem，列表与搜索共用） */
export interface MergePackageListItem {
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

/** 详情响应（MergePackageDetailResponseData）。
 *  注意：比列表少 printed_qty/print_time 与出入库单据追溯字段，比列表多位置链。 */
export interface MergePackageDetailResponse {
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

/** 搜索合包条码：keyword 模糊匹配合包编号/业务ID/产品编码·名称·规格·品号/来源货位·塑料盒名/创建人 */
export function searchMergePackages(keyword: string, query: MergePackageListQuery = {}): Promise<MergePackageListResponse> {
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

export const MERGE_INBOUND_TYPE_TEXT: Record<string, string> = {
  PURCHASE_IN: '采购入库',
  SALES_RETURN: '销售退回',
}

export const MERGE_OUTBOUND_TYPE_TEXT: Record<string, string> = {
  PURCHASE_RETURN: '采购退回',
  SALES_OUT: '销售出库',
}
