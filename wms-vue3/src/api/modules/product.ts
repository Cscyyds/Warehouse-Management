/**
 * 模块：产品管理
 * 表名：产品类别表 / 计量单位表 / 产品资料表
 * 功能：产品类别树/计量单位/产品资料、导入导出、打印标签
 * 说明：写操作均为 multipart/form-data（FormData）
 */
import { get, post, toFormData, toMultipart } from '@/utils/request'
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

/** 计量单位（后端 _serialize_unit 返回，snake_case） */
export interface ProductUnitItem {
  id: number
  unit_id: string
  unit_name: string
  remark: string | null
  status: number
  deleted_flag?: number
  created_by?: string | null
  created_by_name?: string | null
  updated_by?: string | null
  updated_by_name?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/** 计量单位列表响应（后端返回 key 为 unit，单数命名） */
export interface ProductUnitListResponse {
  total: number
  page: number
  page_size: number
  unit: ProductUnitItem[]
}

/** 计量单位详情响应（后端返回 key 为 unit，单数命名，含 total=1） */
export interface ProductUnitDetailResponse {
  total: number
  unit: ProductUnitItem[]
}

/** 计量单位搜索响应（同列表，含 total/page/page_size） */
export interface ProductUnitSearchResponse {
  total: number
  page: number
  page_size: number
  unit: ProductUnitItem[]
}

/** 创建计量单位入参（接口9，后端 Schema: TenantCreateUnitRequest） */
export interface CreateProductUnitPayload {
  unit_name: string
  remark?: string
}

/** 更新计量单位入参（接口10，后端 Schema: TenantUpdateUnitRequest，unit_id 和 status 必传） */
export interface UpdateProductUnitPayload {
  unit_id: string
  status: number | string
  unit_name?: string
  remark?: string
}

/** 创建计量单位
 * URL: POST /api/v1/tenant-units/create
 */
export function createProductUnit(data: CreateProductUnitPayload): Promise<ApiResponse<{ unit: ProductUnitItem }>> {
  return post<{ unit: ProductUnitItem }>('/api/v1/tenant-units/create', toFormData(data as unknown as Record<string, unknown>))
}

/** 更新计量单位
 * URL: POST /api/v1/tenant-units/update
 */
export function updateProductUnit(data: UpdateProductUnitPayload): Promise<ApiResponse<{ unit: ProductUnitItem }>> {
  return post<{ unit: ProductUnitItem }>('/api/v1/tenant-units/update', toFormData(data as unknown as Record<string, unknown>))
}

/** 删除计量单位
 * URL: POST /api/v1/tenant-units/delete
 */
export function deleteProductUnit(unit_id: string): Promise<ApiResponse<{ unit_id: string }>> {
  return post<{ unit_id: string }>('/api/v1/tenant-units/delete', toFormData({ unit_id }))
}

/** 查询计量单位列表（接口12）
 * URL: GET /api/v1/tenant-units/list
 */
export function getProductUnitList(params?: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<ProductUnitListResponse>> {
  return get<ProductUnitListResponse>('/api/v1/tenant-units/list', params as unknown as Record<string, unknown>)
}

/** 查询计量单位详情（接口13）
 * URL: GET /api/v1/tenant-units/detail
 */
export function getProductUnitDetail(unit_id: string): Promise<ApiResponse<ProductUnitDetailResponse>> {
  return get<ProductUnitDetailResponse>('/api/v1/tenant-units/detail', { unit_id })
}

/** 搜索计量单位（接口14）
 * URL: GET /api/v1/tenant-units/search
 * 参数: search_field（JSON数组字符串）、search_value（JSON对象字符串）
 */
export function searchProductUnit(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<ProductUnitSearchResponse>> {
  return get<ProductUnitSearchResponse>('/api/v1/tenant-units/search', params as unknown as Record<string, unknown>)
}

/** 兼容别名：获取计量单位选项列表（下拉选择器用），返回 { label, value } 数组 */
export async function getProductUnitOptions(): Promise<{ label: string; value: string }[]> {
  const res = await getProductUnitList()
  return (res.data.unit || []).map(u => ({ label: u.unit_name, value: u.unit_id }))
}

// ==================== 产品资料 ====================

/** 产品销售价格项（_serialize_sale_price 返回，snake_case） */
export interface ProductSalePriceItem {
  sale_price_id: string
  product_id: string
  customer_type_id: string
  customer_type_name?: string | null
  sale_price: string
  remark?: string | null
  deleted_flag?: number
  created_by?: string | null
  created_by_name?: string | null
  updated_by?: string | null
  updated_by_name?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/** 产品组合件明细项（_serialize_component 返回，snake_case） */
export interface ProductComponentItem {
  component_id: string
  combined_product_id: string
  component_product_id: string
  component_product_name?: string | null
  num: number
  remark?: string | null
  deleted_flag?: number
  created_by?: string | null
  created_by_name?: string | null
  updated_by?: string | null
  updated_by_name?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/** 产品文件项（serialize_product_files 返回） */
export interface ProductFileItem {
  file_ref_id: string
  file_id: string
  file_name: string
  file_url: string
  file_size?: number
  sort_no: number
}

/** 产品资料（_serialize_product 返回，snake_case，后端实际字段） */
export interface ProductItem {
  id: number
  product_id: string
  product_code: string
  item_no: string | null
  product_name: string
  product_type: string
  product_type_name?: string | null
  category_id: string
  category_name?: string | null
  supplier_id?: string
  supplier_name?: string | null
  supplier_model?: string | null
  specification: string | null
  origin_place: string | null
  color: string | null
  unit_id: string
  unit_name?: string | null
  unit_weight: string
  is_weighing: number
  weight_tolerance: string
  assist_unit_id: string | null
  assist_unit_name?: string | null
  convert_ratio: string
  factory_price: string
  package_qty: string
  production_cycle_days: number
  stock_warning_qty: string
  fifo_flag: number
  avg_cost_price: string
  is_combined: number
  gross_profit_ctrl_rate: string
  min_sale_price: string
  product_status: string
  product_status_name?: string | null
  remark: string | null
  deleted_flag?: number
  created_by?: string | null
  created_by_name?: string | null
  updated_by?: string | null
  updated_by_name?: string | null
  created_at?: string | null
  updated_at?: string | null
  sale_prices: ProductSalePriceItem[]
  // 详情接口附加字段
  images?: ProductFileItem[]
  attachments?: ProductFileItem[]
  suppliers?: Array<{ supplier_id: string; supplier_name: string | null; supplier_model: string | null; avg_cost_price?: string | null; last_purchase_at?: string | null }>
  supplier_avg_costs?: Array<Record<string, unknown>>
  components?: ProductComponentItem[]
}

/** 产品列表响应（后端返回 key 为 products） */
export interface ProductListResponse {
  total: number
  page: number
  page_size: number
  products: ProductItem[]
}

/** 产品搜索响应（同列表） */
export interface ProductSearchResponse {
  total: number
  page: number
  page_size: number
  products: ProductItem[]
}

/** 创建产品入参（接口15，后端 Schema: TenantCreateProductRequest） */
export interface CreateProductPayload {
  product_name: string
  product_type: string
  category_id: string
  supplier_id: string
  unit_id: string
  is_weighing: number
  factory_price: string
  fifo_flag: number
  is_combined: number
  gross_profit_ctrl_rate: string
  product_status: string
  item_no?: string
  specification?: string
  origin_place?: string
  color?: string
  unit_weight?: string
  weight_tolerance?: string
  assist_unit_id?: string
  convert_ratio?: string
  package_qty?: string
  production_cycle_days?: string
  stock_warning_qty?: string
  remark?: string
}

/** 更新产品入参（接口16，后端 Schema: TenantUpdateProductRequest，product_id 必传，其余可选） */
export interface UpdateProductPayload {
  product_id: string
  product_name?: string
  product_type?: string
  category_id?: string
  unit_id?: string
  is_weighing?: number
  factory_price?: string
  fifo_flag?: number
  is_combined?: number
  gross_profit_ctrl_rate?: string
  product_status?: string
  item_no?: string
  specification?: string
  origin_place?: string
  color?: string
  unit_weight?: string
  weight_tolerance?: string
  assist_unit_id?: string
  convert_ratio?: string
  package_qty?: string
  production_cycle_days?: string
  stock_warning_qty?: string
  remark?: string
}

/** 新增/更新产品（接口15/16，支持图片和附件上传，使用 multipart/form-data）
 * URL: POST /api/v1/tenant-products/create | /api/v1/tenant-products/update
 */
export function createProduct(data: CreateProductPayload, files?: { images?: File[]; attachments?: File[] }): Promise<ApiResponse<ProductItem>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<ProductItem>('/api/v1/tenant-products/create', fd)
}

export function updateProduct(data: UpdateProductPayload, files?: { images?: File[]; attachments?: File[] }): Promise<ApiResponse<Partial<ProductItem>>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<Partial<ProductItem>>('/api/v1/tenant-products/update', fd)
}

/** 删除产品（接口28）
 * URL: POST /api/v1/tenant-products/delete
 */
export function deleteProduct(product_id: string): Promise<ApiResponse<{ product_id: string }>> {
  return post<{ product_id: string }>('/api/v1/tenant-products/delete', toFormData({ product_id }))
}

/** 删除产品预览（接口29）
 * URL: GET /api/v1/tenant-products/delete/preview
 */
export function previewDeleteProduct(product_id: string): Promise<ApiResponse<{
  target: { id: string; name: string; type: string }
  cascade_items: Array<{ id: string; name: string; type: string }>
  cascade_count: number
  summary: string
}>> {
  return get('/api/v1/tenant-products/delete/preview', { product_id })
}

/** 查询产品列表（按类别，接口23）
 * URL: GET /api/v1/tenant-products/list
 */
export function getProductList(params: {
  category_id: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<ProductListResponse>> {
  return get<ProductListResponse>('/api/v1/tenant-products/list', params as unknown as Record<string, unknown>)
}

/** 查询产品详情（接口24）
 * URL: GET /api/v1/tenant-products/detail
 * 后端返回 data 直接为 product 对象（非包裹在 {product:...} 中）
 */
export function getProductDetail(product_id: string): Promise<ApiResponse<ProductItem>> {
  return get<ProductItem>('/api/v1/tenant-products/detail', { product_id })
}

/** 搜索产品（接口36，跨类别多字段组合搜索）
 * URL: GET /api/v1/tenant-products/search
 */
export function searchProduct(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<ProductSearchResponse>> {
  return get<ProductSearchResponse>('/api/v1/tenant-products/search', params as unknown as Record<string, unknown>)
}

// ────────────── 产品销售价格（接口17-19） ──────────────

/** 批量绑定客户类型销售价格（接口17）
 * URL: POST /api/v1/tenant-products/sale-prices/create
 * items 为 JSON 数组字符串，每条含 customer_type_id、sale_price、remark
 */
export function bindProductSalePrices(product_id: string, items: Array<{ customer_type_id: string; sale_price: string; remark?: string }>): Promise<ApiResponse<{ created_count: number; sale_prices: ProductSalePriceItem[] }>> {
  return post<{ created_count: number; sale_prices: ProductSalePriceItem[] }>(
    '/api/v1/tenant-products/sale-prices/create',
    toFormData({ product_id, items: JSON.stringify(items) })
  )
}

/** 批量更新客户类型销售价格（接口18）
 * URL: POST /api/v1/tenant-products/sale-prices/update
 * items 为 JSON 数组字符串，每条含 sale_price_id 及可选更新字段
 */
export function updateProductSalePrices(product_id: string, items: Array<{ sale_price_id: string; sale_price?: string; remark?: string }>): Promise<ApiResponse<{ updated_count: number; sale_prices: ProductSalePriceItem[] }>> {
  return post<{ updated_count: number; sale_prices: ProductSalePriceItem[] }>(
    '/api/v1/tenant-products/sale-prices/update',
    toFormData({ product_id, items: JSON.stringify(items) })
  )
}

/** 删除客户类型销售价格（接口19）
 * URL: POST /api/v1/tenant-products/sale-prices/delete
 * 后端实际只接收 sale_price_id（单条），非文档描述的 product_id+sale_price_ids
 */
export function deleteProductSalePrice(sale_price_id: string): Promise<ApiResponse<{ sale_price_id: string }>> {
  return post<{ sale_price_id: string }>('/api/v1/tenant-products/sale-prices/delete', toFormData({ sale_price_id }))
}

// ────────────── 组合产品子产品绑定（接口20-22） ──────────────

/** 绑定组合件子产品（接口20）
 * URL: POST /api/v1/tenant-products/components/create
 * 后端实际参数为 combined_product_id + items，items 每条含 product_id、num、remark
 */
export function bindProductComponents(combined_product_id: string, items: Array<{ product_id: string; num: number; remark?: string }>): Promise<ApiResponse<{ created_count: number; components: ProductComponentItem[] }>> {
  return post<{ created_count: number; components: ProductComponentItem[] }>(
    '/api/v1/tenant-products/components/create',
    toFormData({ combined_product_id, items: JSON.stringify(items) })
  )
}

/** 更新组合件子产品（接口21）
 * URL: POST /api/v1/tenant-products/components/update
 * items 每条含 component_id 及可选 component_product_id、num、remark
 */
export function updateProductComponents(items: Array<{ component_id: string; component_product_id?: string; num?: number; remark?: string }>): Promise<ApiResponse<{ updated_count: number; components: ProductComponentItem[] }>> {
  return post<{ updated_count: number; components: ProductComponentItem[] }>(
    '/api/v1/tenant-products/components/update',
    toFormData({ items: JSON.stringify(items) })
  )
}

/** 删除组合件子产品（接口22）
 * URL: POST /api/v1/tenant-products/components/delete
 * 后端实际只接收 component_id（单条）
 */
export function deleteProductComponent(component_id: string): Promise<ApiResponse<{ component_id: string }>> {
  return post<{ component_id: string }>('/api/v1/tenant-products/components/delete', toFormData({ component_id }))
}

// ────────────── 产品关联供应商（接口25-27） ──────────────

/** 查询供应商绑定的产品列表（接口25）
 * URL: GET /api/v1/tenant-products/suppliers/query
 * 后端实际参数为 supplier_id（非文档描述的 product_id），返回该供应商绑定的产品
 */
export function queryProductSuppliers(supplier_id: string): Promise<ApiResponse<{
  supplier_id: string
  supplier_name: string | null
  products: Array<{
    product_id: string
    product_code: string
    product_name: string
    category_id: string
    category_name: string
    specification: string | null
    color: string | null
    unit_id: string | null
    unit_name: string
    supplier_model: string | null
    avg_cost_price: string | null
    last_purchase_at: string | null
  }>
}>> {
  return get('/api/v1/tenant-products/suppliers/query', { supplier_id })
}

/** 为产品新增关联供应商（接口26）
 * URL: POST /api/v1/tenant-products/suppliers/add
 * 后端 supplier_id 支持单值或 JSON 对象数组字符串：
 *   [{"supplier_id":"sp_xxx","supplier_model":"型号A"},{"supplier_id":"sp_yyy","supplier_model":"型号B"}]
 */
export function addProductSupplier(data: {
  product_id: string
  /** 供应商参数：传入数组时会自动 JSON.stringify 为对象数组字符串 */
  supplier_id: string | Array<{ supplier_id: string; supplier_model?: string }>
  supplier_model?: string
}): Promise<ApiResponse<{ added_count: number; suppliers: unknown[] }>> {
  const payload: Record<string, unknown> = {
    product_id: data.product_id,
    supplier_id: Array.isArray(data.supplier_id) ? JSON.stringify(data.supplier_id) : data.supplier_id
  }
  if (data.supplier_model) payload.supplier_model = data.supplier_model
  return post<{ added_count: number; suppliers: unknown[] }>('/api/v1/tenant-products/suppliers/add', toFormData(payload))
}

/** 删除产品关联供应商（接口27）
 * URL: POST /api/v1/tenant-products/suppliers/delete
 * 后端实际参数为 product_id + supplier_id（非文档描述的 bind_ids）
 */
export function deleteProductSupplier(data: {
  product_id: string
  supplier_id: string
}): Promise<ApiResponse<{ product_id: string; supplier_id: string }>> {
  return post<{ product_id: string; supplier_id: string }>('/api/v1/tenant-products/suppliers/delete', toFormData(data as unknown as Record<string, unknown>))
}

// ────────────── 产品迁移（接口30-33） ──────────────

/** 产品迁移类别（接口30）
 * URL: POST /api/v1/tenant-products/migrate-category
 * 后端实际参数为 source_category_id + change_message（JSON数组字符串），非文档描述的 product_ids + target_category_id
 * change_message 格式：[{"new_category":"cat_xxx","change_products":["prd_1","prd_2"]}]
 */
export function migrateProductCategory(data: {
  source_category_id: string
  change_message: string
}): Promise<ApiResponse<{ migrated_count: number; details: unknown[] }>> {
  return post<{ migrated_count: number; details: unknown[] }>('/api/v1/tenant-products/migrate-category', toFormData(data as unknown as Record<string, unknown>))
}

/** 产品迁移主供应商（接口31）
 * URL: POST /api/v1/tenant-products/migrate-supplier
 * 后端实际参数为 source_supplier_id + change_message
 * change_message 格式：[{"new_supplier":"sup_xxx","change_products":["prd_1","prd_2"]}]
 */
export function migrateProductSupplier(data: {
  source_supplier_id: string
  change_message: string
}): Promise<ApiResponse<{ migrated_count: number; details: unknown[] }>> {
  return post<{ migrated_count: number; details: unknown[] }>('/api/v1/tenant-products/migrate-supplier', toFormData(data as unknown as Record<string, unknown>))
}

/** 产品迁移主计量单位（接口32）
 * URL: POST /api/v1/tenant-products/migrate-unit
 * 后端实际参数为 source_unit_id + change_message
 * change_message 格式：[{"new_unit":"unit_xxx","change_products":["prd_1","prd_2"]}]
 */
export function migrateProductUnit(data: {
  source_unit_id: string
  change_message: string
}): Promise<ApiResponse<{ migrated_count: number; details: unknown[] }>> {
  return post<{ migrated_count: number; details: unknown[] }>('/api/v1/tenant-products/migrate-unit', toFormData(data as unknown as Record<string, unknown>))
}

/** 产品迁移辅助计量单位（接口33）
 * URL: POST /api/v1/tenant-products/migrate-assist-unit
 * 后端实际参数为 source_assist_unit_id + change_message
 * change_message 格式：[{"new_assist_unit":"unit_xxx","change_products":["prd_1","prd_2"]}]
 */
export function migrateProductAssistUnit(data: {
  source_assist_unit_id: string
  change_message: string
}): Promise<ApiResponse<{ migrated_count: number; details: unknown[] }>> {
  return post<{ migrated_count: number; details: unknown[] }>('/api/v1/tenant-products/migrate-assist-unit', toFormData(data as unknown as Record<string, unknown>))
}

// ────────────── 产品图片/附件删除（接口34-35） ──────────────

/** 删除产品图片（接口34）
 * URL: POST /api/v1/tenant-products/images/delete
 * 后端返回 { deleted_count }（非文档描述的 remaining_image_urls）
 */
export function deleteProductImages(product_id: string, image_urls: string[]): Promise<ApiResponse<{ deleted_count: number }>> {
  return post<{ deleted_count: number }>('/api/v1/tenant-products/images/delete', toFormData({ product_id, image_urls: JSON.stringify(image_urls) }))
}

/** 删除产品附件（接口35）
 * URL: POST /api/v1/tenant-products/attachments/delete
 * 后端实际参数为 file_urls（非文档描述的 attachment_urls），返回 { deleted_count }
 */
export function deleteProductAttachments(product_id: string, file_urls: string[]): Promise<ApiResponse<{ deleted_count: number }>> {
  return post<{ deleted_count: number }>('/api/v1/tenant-products/attachments/delete', toFormData({ product_id, file_urls: JSON.stringify(file_urls) }))
}
