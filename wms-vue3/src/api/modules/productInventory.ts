/**
 * 模块：产品库存（租客接口）
 * 源接口：app/api/v1/endpoints/tenant_wms_management.py
 * 功能：产品库存列表 / 详情 / 搜索（接口34-36）
 * 认证：Bearer Token（租户员工）
 * 说明：三个接口均为 GET，入参走 query string，无需表单编码
 */
import { get } from '@/utils/request'
import type { ApiResponse, RequestConfig } from '@/utils/request'

/** 产品库存列表 / 搜索条目（接口34、36 共用） */
export interface ProductInventoryItem {
  product_id: string
  product_code: string
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
  /** available_stock / warehouse_stock / stock_amount / product_code */
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
  /** available_stock / warehouse_stock / stock_amount / product_code */
  sort_by?: string
  /** ASC/升序 或 DESC/降序，默认降序 */
  sort_order?: string
}

/** 详情 - 货位位置 */
export interface ProductInventoryBarcodePosition {
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

/** 详情 - 条码分组 */
export interface ProductInventoryBarcode {
  barcode_type: 'PRODUCT' | 'INBOUND' | 'PLASTIC_BOX' | 'MERGE_PACKAGE' | string
  barcode_type_label: string
  barcode_id: string
  barcode_code: string
  product_id: string
  product_code: string
  product_name: string
  /** 仅 PLASTIC_BOX（塑料盒）类型携带 */
  barcode_name?: string
  positions: ProductInventoryBarcodePosition[]
}

/** 详情响应（接口35） */
export interface ProductInventoryDetail {
  product_id: string
  product_code: string
  product_name: string
  /** 散件合计 */
  loose_total_qty: string
  /** 塑料盒合计 */
  plastic_box_total_qty: string
  /** 合包合计 */
  merge_package_total_qty: string
  barcodes: ProductInventoryBarcode[]
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
