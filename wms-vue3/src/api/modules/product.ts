/**
 * 模块：产品管理
 * 表名：产品信息表
 * 功能：产品类别树/计量单位/产品资料、导入导出、打印标签
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface ProductItem {
  id: string
  code: string
  name: string
  shortName: string
  categoryId: string
  categoryName: string
  unitId: string
  unitName: string
  spec: string
  model: string
  brand: string
  origin: string
  barcode: string
  purchasePrice: number
  salePrice: number
  wholesalePrice: number
  costPrice: number
  minStock: number
  maxStock: number
  status: string
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface ProductCategoryItem {
  id: string
  code: string
  name: string
  parentId: string
  sort: number
  status: string
  children?: ProductCategoryItem[]
}

export interface ProductUnitItem {
  id: string
  code: string
  name: string
  category: string
  sort: number
  status: string
}

export interface ProductQueryParams {
  page: number
  pageSize: number
  code?: string
  name?: string
  categoryId?: string
  unitId?: string
  barcode?: string
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

export function getProductCategoryTree(): Promise<ApiResponse<ProductCategoryItem[]>> {
  return get<ProductCategoryItem[]>('/product/category/tree')
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

export function getProductUnitList(): Promise<ApiResponse<ProductUnitItem[]>> {
  return get<ProductUnitItem[]>('/product/unit/list')
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
