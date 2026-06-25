/**
 * 模块：产品管理
 * 表名：产品类别表 / 计量单位表 / 产品资料表
 * 功能：产品类别树/计量单位/产品资料、导入导出、打印标签
 * 说明：写操作均为 multipart/form-data（FormData）
 */
import { get, post, put, del, toFormData } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

// ==================== 产品类别 ====================

/** 产品类别树节点（后端 _serialize_category 返回，snake_case） */
export interface ProductCategoryItem {
  id?: number
  category_id: string
  category_code: string
  parent_id: string
  parent_name?: string | null
  company_id?: string
  name: string
  sort_no: number
  status: number
  remark?: string | null
  deleted_flag?: number
  created_by?: string | null
  created_by_name?: string | null
  updated_by?: string | null
  updated_by_name?: string | null
  created_at?: string
  updated_at?: string
  children?: ProductCategoryItem[]
}

/** 产品类别列表响应（树形）
 *  后端返回 key 为 product_category（单数命名，与客户管理模块规律一致）
 */
export interface ProductCategoryListResponse {
  total: number
  product_category: ProductCategoryItem[]
}

/** 产品类别详情响应
 *  后端返回 key 为 product_category（单数命名）
 */
export interface ProductCategoryDetailResponse {
  product_category: ProductCategoryItem
}

/** 查询产品类别列表（树形）
 * URL: GET /api/v1/tenant-product-categories/list
 * 参数: sort_by, sort_order
 */
export function getProductCategoryList(params?: {
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<ProductCategoryListResponse>> {
  return get<ProductCategoryListResponse>('/api/v1/tenant-product-categories/list', params as unknown as Record<string, unknown>)
}

/** 兼容别名：旧代码通过 getProductCategoryTree() 获取树，返回 product_category 数组 */
export async function getProductCategoryTree(): Promise<ApiResponse<ProductCategoryItem[]>> {
  const res = await getProductCategoryList()
  return { ...res, data: res.data.product_category } as ApiResponse<ProductCategoryItem[]>
}

/** 查询产品类别详情
 * URL: GET /api/v1/tenant-product-categories/detail
 */
export function getProductCategoryDetail(category_id: string): Promise<ApiResponse<ProductCategoryDetailResponse>> {
  return get<ProductCategoryDetailResponse>('/api/v1/tenant-product-categories/detail', { category_id })
}

/** 新增产品类别
 * URL: POST /api/v1/tenant-product-categories/create
 */
export function createProductCategory(data: Record<string, unknown>): Promise<ApiResponse<ProductCategoryItem>> {
  return post<ProductCategoryItem>('/api/v1/tenant-product-categories/create', toFormData(data))
}

/** 修改产品类别
 * URL: POST /api/v1/tenant-product-categories/update
 */
export function updateProductCategory(category_id: string, data: Record<string, unknown>): Promise<ApiResponse<ProductCategoryItem>> {
  return post<ProductCategoryItem>('/api/v1/tenant-product-categories/update', toFormData({ category_id, ...data }))
}

/** 删除产品类别
 * URL: POST /api/v1/tenant-product-categories/delete
 */
export function deleteProductCategory(category_id: string): Promise<ApiResponse<{ category_id: string }>> {
  return post<{ category_id: string }>('/api/v1/tenant-product-categories/delete', toFormData({ category_id }))
}

// ==================== 计量单位 ====================
export interface ProductUnitItem {
  id: string
  name: string
  companyId: string
  companyName: string
  status: string
  remark: string
  createTime: string
  updateTime: string
}

export interface ProductUnitQueryParams {
  page: number
  pageSize: number
  name?: string
  status?: string
}

export interface ProductUnitListResponse {
  list: ProductUnitItem[]
  total: number
  page: number
  pageSize: number
}

export function getProductUnitPageList(params: ProductUnitQueryParams): Promise<ApiResponse<ProductUnitListResponse>> {
  return get<ProductUnitListResponse>('/product/unit/page', params as unknown as Record<string, unknown>)
}

export function getProductUnitList(): Promise<ApiResponse<ProductUnitItem[]>> {
  return get<ProductUnitItem[]>('/product/unit/list')
}

export function getProductUnitDetail(id: string): Promise<ApiResponse<ProductUnitItem>> {
  return get<ProductUnitItem>(`/product/unit/${id}`)
}

export function createProductUnit(data: Partial<ProductUnitItem>): Promise<ApiResponse<ProductUnitItem>> {
  return post<ProductUnitItem>('/product/unit', data)
}

export function updateProductUnit(id: string, data: Partial<ProductUnitItem>): Promise<ApiResponse<ProductUnitItem>> {
  return put<ProductUnitItem>(`/product/unit/${id}`, data)
}

export function deleteProductUnit(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/product/unit/${id}`)
}

// ==================== 产品资料 ====================
export interface ProductItem {
  id: string
  code: string
  itemNo: string
  name: string
  productType: string
  categoryId: string
  categoryName: string
  companyId: string
  companyName: string
  supplierId: string
  supplierNameModel: string
  spec: string
  origin: string
  color: string
  unitId: string
  unitName: string
  weight: number
  isWeighed: boolean
  weightError: number
  auxUnitId: string
  auxUnitName: string
  conversionRatio: number
  factoryPrice: number
  packageQty: number
  productionCycle: number
  stockWarning: number
  isFifo: boolean
  avgCostPrice: number
  grossProfitControl: number
  minSalePrice: number
  currentStock: number
  frozenStock: number
  availableStock: number
  scrapStock: number
  status: string
  images: string
  attachments: string
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface ProductQueryParams {
  page: number
  pageSize: number
  code?: string
  name?: string
  categoryId?: string
  unitId?: string
  productType?: string
  status?: string
}

export interface ProductListResponse {
  list: ProductItem[]
  total: number
  page: number
  pageSize: number
}

export function getProductList(params: ProductQueryParams): Promise<ApiResponse<ProductListResponse>> {
  return get<ProductListResponse>('/product/list', params as unknown as Record<string, unknown>)
}

export function getProductDetail(id: string): Promise<ApiResponse<ProductItem>> {
  return get<ProductItem>(`/product/${id}`)
}

export function createProduct(data: Partial<ProductItem>): Promise<ApiResponse<ProductItem>> {
  return post<ProductItem>('/product', data)
}

export function updateProduct(id: string, data: Partial<ProductItem>): Promise<ApiResponse<ProductItem>> {
  return put<ProductItem>(`/product/${id}`, data)
}

export function deleteProduct(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/product/${id}`)
}

export function batchDeleteProduct(ids: string[]): Promise<ApiResponse<null>> {
  return post<null>('/product/batch-delete', { ids })
}

export function importProduct(file: FormData): Promise<ApiResponse<{ success: number; fail: number }>> {
  return post<{ success: number; fail: number }>('/product/import', file)
}

export function exportProduct(params: ProductQueryParams): Promise<ApiResponse<Blob>> {
  return get<Blob>('/product/export', params as unknown as Record<string, unknown>)
}

export function printProductLabel(ids: string[]): Promise<ApiResponse<Blob>> {
  return post<Blob>('/product/print-label', { ids })
}

export function getUnsoldProductList(params: ProductQueryParams): Promise<ApiResponse<{ list: any[]; total: number; page: number; pageSize: number }>> {
  return get('/product/unsold', params as unknown as Record<string, unknown>)
}
