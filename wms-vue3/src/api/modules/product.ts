/**
 * 模块：产品管理
 * 表名：产品类别表 / 计量单位表 / 产品资料表
 * 功能：产品类别树/计量单位/产品资料、导入导出、打印标签
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

// ==================== 产品类别 ====================
export interface ProductCategoryItem {
  id: string
  code: string
  name: string
  parentId: string
  parentName: string
  companyId: string
  companyName: string
  sort: number
  status: string
  remark: string
  createTime: string
  updateTime: string
  children?: ProductCategoryItem[]
}

export function getProductCategoryTree(): Promise<ApiResponse<ProductCategoryItem[]>> {
  return get<ProductCategoryItem[]>('/product/category/tree')
}

export function getProductCategoryList(params: Record<string, unknown>): Promise<ApiResponse<{ list: ProductCategoryItem[]; total: number }>> {
  return get<{ list: ProductCategoryItem[]; total: number }>('/product/category/list', params)
}

export function getProductCategoryDetail(id: string): Promise<ApiResponse<ProductCategoryItem>> {
  return get<ProductCategoryItem>(`/product/category/${id}`)
}

export function createProductCategory(data: Partial<ProductCategoryItem>): Promise<ApiResponse<ProductCategoryItem>> {
  return post<ProductCategoryItem>('/product/category', data)
}

export function updateProductCategory(id: string, data: Partial<ProductCategoryItem>): Promise<ApiResponse<ProductCategoryItem>> {
  return put<ProductCategoryItem>(`/product/category/${id}`, data)
}

export function deleteProductCategory(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/product/category/${id}`)
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
