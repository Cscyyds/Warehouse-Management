/**
 * 集散位管理 API（后端方案：集散位管理与合包出库位码校验补齐_改造方案_20261009.md 第四章 MB-01~06）
 *
 * 集散位：多位多品、只收合包的存储实体，与货位同级、直属仓库（warehouse_id 必填，第八轮）。
 * 六件套接口与临时放货货位（stagingSpot.ts）同构；列表行携带库存聚合三列。
 */
import { get, post, toFormData } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'
import { fetchAllPages } from '@/api/utils/fetchAllPages'

/** 集散位列表行（query 返回，含库存聚合三列） */
export interface ConsolidationSpotItem {
  distribution_spot_id: string
  company_id: string
  warehouse_id: string
  spot_no: string
  spot_name: string
  simple_code: string | null
  status: number
  remark: string | null
  barcode_url: string | null
  printed_qty: number
  print_time: string | null
  created_at: string
  created_by_name?: string | null
  updated_at?: string
  /** 在位产品数（stock 表行数） */
  product_count: number
  /** 该集散位在库数量合计 */
  total_stock_qty: number
  /** 在位 INBOUND 合包数合计 */
  package_count: number
}

/** 集散位列表响应 */
export interface ConsolidationSpotListResponse {
  total: number
  page: number
  page_size: number
  items: ConsolidationSpotItem[]
}

/** 集散位详情-在位合包明细条目 */
export interface ConsolidationSpotPackageItem {
  merge_package_id: string
  barcode_code: string
  merge_qty: number
  warehouse_status: string
  created_at: string | null
}

/** 集散位详情-在位产品条目 */
export interface ConsolidationSpotProductItem {
  product_id: string
  product_code: string
  item_no?: string
  product_name: string
  specification: string
  unit_name: string
  stock_qty: number
  package_count: number
  packages: ConsolidationSpotPackageItem[]
  stock_created_at?: string | null
}

/** 集散位详情响应（档案 + 仓库基本信息 + 在位产品清单） */
export interface ConsolidationSpotDetail extends ConsolidationSpotItem {
  warehouse: {
    warehouse_id: string
    warehouse_no: string
    warehouse_name: string
  }
  products: ConsolidationSpotProductItem[]
}

/** 列表查询参数（spot_no/spot_name 模糊，status/warehouse_id 等值） */
export interface ConsolidationSpotQueryParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
  spot_no?: string
  spot_name?: string
  status?: number
  warehouse_id?: string
}

/** 新增集散位入参（warehouse_id 必填——集散位必须绑定仓库） */
export interface ConsolidationSpotCreatePayload {
  spot_no: string
  spot_name: string
  warehouse_id: string
  simple_code?: string
  status?: string
  remark?: string
}

/** 修改集散位入参（warehouse_id 传入时不可为空——禁止清空归属仓库） */
export interface ConsolidationSpotUpdatePayload {
  spot_no?: string
  spot_name?: string
  warehouse_id?: string
  simple_code?: string
  status?: string
  remark?: string
}

/** 分页查询集散位（支持编号/名称模糊 + 状态/仓库等值过滤） */
export function getConsolidationSpotList(params: ConsolidationSpotQueryParams): Promise<ApiResponse<ConsolidationSpotListResponse>> {
  return get<ConsolidationSpotListResponse>('/api/v1/tenant-distribution-spots/query', params as unknown as Record<string, unknown>)
}

/**
 * 查询全部集散位（按 total 自动翻页取全）。
 * 用于左侧「仓库→集散位」树：集散位按 warehouse_id 挂到对应仓库节点下。
 */
export function getConsolidationSpotAll(params?: {
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<ConsolidationSpotListResponse>> {
  return fetchAllPages<ConsolidationSpotListResponse, ConsolidationSpotItem>({
    fetchPage: ({ page, page_size }) => getConsolidationSpotList({ ...params, page, page_size }),
    pick: data => data.items || [],
    assign: (data, items) => { data.items = items },
  })
}

/** 查询指定集散位详情（含仓库基本信息与在位产品/合包明细） */
export function getConsolidationSpotDetail(distributionSpotId: string): Promise<ApiResponse<ConsolidationSpotDetail>> {
  return get<ConsolidationSpotDetail>('/api/v1/tenant-distribution-spots/detail', { distribution_spot_id: distributionSpotId })
}

/** 新增集散位（后端校验：仓库必填且存在、编号/名称同租户唯一） */
export function createConsolidationSpot(data: ConsolidationSpotCreatePayload): Promise<ApiResponse<ConsolidationSpotItem>> {
  return post<ConsolidationSpotItem>('/api/v1/tenant-distribution-spots', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改集散位（停用时有货守卫由后端拦截，错误经全局拦截器展示） */
export function updateConsolidationSpot(distributionSpotId: string, data: ConsolidationSpotUpdatePayload): Promise<ApiResponse<ConsolidationSpotItem>> {
  const payload = { ...data, distribution_spot_id: distributionSpotId }
  return post<ConsolidationSpotItem>('/api/v1/tenant-distribution-spots/update', toFormData(payload as unknown as Record<string, unknown>))
}

/** 删除集散位（有货守卫由后端拦截：位上存在 INBOUND 合包或库存行时 400） */
export function deleteConsolidationSpot(distributionSpotId: string): Promise<ApiResponse<{ distribution_spot_id: string }>> {
  return post<{ distribution_spot_id: string }>('/api/v1/tenant-distribution-spots/delete', toFormData({ distribution_spot_id: distributionSpotId }))
}
