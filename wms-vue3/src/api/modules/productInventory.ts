/**
 * 模块：产品库存（租客接口）
 * 源接口：app/api/v1/endpoints/tenant_wms_management.py
 * 功能：产品库存列表 / 详情 / 搜索（接口34-36）
 * 认证：Bearer Token（租户员工）
 * 说明：三个接口均为 GET，入参走 query string，无需表单编码
 */
import { get } from '@/utils/request'
import type { ApiResponse, RequestConfig } from '@/utils/request'

/** 简易库存余额；主工程按产品/存放对象/毫米长度返回，不是条码库存。 */
export interface SimpleStockEntry {
  balance_id: string
  product_id: string
  place_type: 'POSITION' | 'PLASTIC_BOX' | 'DISTRIBUTION_SPOT' | string
  place_id: string
  /** 一条余额自己的位置视图；数量不与余额重复相加，不包含last_inbound_time。 */
  positions?: SimpleStockPosition[]
  box_id?: string | null
  /** 可读存放资料；缺省时不使用内部ID冒充名称或编号。 */
  position_code?: string | null
  location_no?: string | null
  location_name?: string | null
  floor_no?: number | null
  position_no?: number | null
  box_code?: string | null
  box_name?: string | null
  spot_no?: string | null
  spot_name?: string | null
  length_mm?: string | null
  length_status?: 'KNOWN' | 'NONE' | string
  /** 敏感字段被隐藏时可缺省；不能补零或从其他字段反推。 */
  stock_qty?: string | null
  version: number
  updated_at?: string | null
}

/** 产品库存列表 / 搜索条目（接口34、36 共用） */
export interface ProductInventoryItem {
  product_id: string
  product_code: string
  /**
   * 货号（后端 pms_product.item_no，2026-11-12 起随库存列表/搜索返回）。
   * 少数商品未维护，返回空字符串。
   */
  item_no: string
  product_name: string
  category_id: string
  category_name: string
  specification: string
  color: string
  unit_id: string
  unit_name: string
  /** 平均成本单价（实时计算，不存库） */
  avg_cost_price: string
  /** 库存预警量 */
  stock_warning_qty: string
  /** 可用库存 */
  available_stock: string
  /** 仓库库存 */
  warehouse_stock: string
  /** 库存金额 = warehouse_stock × avg_cost_price（实时计算） */
  stock_amount: string
  simple_stocks?: SimpleStockEntry[]
}

/** 列表响应（接口34） */
export interface ProductInventoryListResponse {
  total: number
  page: number
  page_size: number
  list: ProductInventoryItem[]
}

/** 搜索响应（接口36） */
export interface ProductInventorySearchResponse {
  total: number
  page: number
  page_size: number
  keyword: string
  products: ProductInventoryItem[]
}

/** 列表查询参数（接口34） */
export interface ProductInventoryListParams {
  page?: number
  page_size?: number
  /** available_stock / warehouse_stock / stock_amount / product_code / item_no */
  sort_by?: string
  /** ASC/升序 或 DESC/降序，默认降序 */
  sort_order?: string
}

/** 搜索参数（接口36） */
export interface ProductInventorySearchParams {
  /** 搜索关键词，模糊匹配，必填 */
  keyword: string
  page?: number
  page_size?: number
  /** available_stock / warehouse_stock / stock_amount / product_code / item_no */
  sort_by?: string
  /** ASC/升序 或 DESC/降序，默认降序 */
  sort_order?: string
}

/** 详情 - 货位位置 */
export interface ProductInventoryBarcodePosition {
  last_inbound_time?: string | null
  place_type?: string // 在位通道：POSITION=货位格 DISTRIBUTION_SPOT=集散位（集散位条目 location_no/position_code 均为集散位编号）
  position_id: string
  position_code: string
  floor_no: number
  position_no: number
  stock_qty: string
  location_id: string
  location_no: string
  location_name: string
  warehouse_id: string
  warehouse_no: string
  warehouse_name: string
}

/** 简易位置字段与普通位置同名；异常档案字段可空，数量可能按权限省略。 */
export type SimpleStockPosition = {
  [Key in Exclude<keyof ProductInventoryBarcodePosition, 'last_inbound_time' | 'stock_qty'>]?: ProductInventoryBarcodePosition[Key] | null
} & { stock_qty?: string | null }

/** 详情 - 条码分组 */
export interface ProductInventoryBarcode {
  barcode_type: 'NO_DOC' | 'PRODUCT' | 'INBOUND' | 'PLASTIC_BOX' | 'MERGE_PACKAGE' | 'CUTTING' | string
  barcode_type_label: string
  barcode_id: string
  barcode_code: string
  product_id: string
  product_code: string
  product_name: string
  /** 仅 PLASTIC_BOX（塑料盒）类型携带 */
  barcode_name?: string
  /** 仅 CUTTING（物料切割条码）类型携带：切割明细长度，无长度时为 null；其数量计入散件合计 */
  cut_length?: number | null
  positions: ProductInventoryBarcodePosition[]
}

/** 详情响应（接口35） */
export interface ProductInventoryDetail {
  product_id: string
  product_code: string
  product_name: string
  /** 散件合计（无单据条码 + 入库条码 + 物料切割条码） */
  loose_total_qty: string
  /** 塑料盒合计 */
  plastic_box_total_qty: string
  /** 货位合包合计，集散位合包计入集散位合计 */
  merge_package_total_qty: string
  /** 集散位在库合计（该产品在各集散位的 stock 合计，MB-07） */
  distribution_spot_total_qty?: string | number
  barcodes: ProductInventoryBarcode[]
  simple_stocks?: SimpleStockEntry[]
}

/** 产品库存列表（接口34） */
export function getProductInventoryList(params: ProductInventoryListParams, config?: RequestConfig): Promise<ApiResponse<ProductInventoryListResponse>> {
  return get<ProductInventoryListResponse>('/api/v1/tenant-inventory/products', params as unknown as Record<string, unknown>, config)
}

/** 产品库存详情（接口35） */
export function getProductInventoryDetail(productId: string): Promise<ApiResponse<ProductInventoryDetail>> {
  return get<ProductInventoryDetail>('/api/v1/tenant-inventory/products/detail', { product_id: productId })
}

/** 产品库存搜索（接口36） */
export function searchProductInventory(params: ProductInventorySearchParams, config?: RequestConfig): Promise<ApiResponse<ProductInventorySearchResponse>> {
  return get<ProductInventorySearchResponse>('/api/v1/tenant-inventory/search', params as unknown as Record<string, unknown>, config)
}
