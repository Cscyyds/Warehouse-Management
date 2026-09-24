/**
 * 模块：产品管理
 * 表名：产品类别表 / 计量单位表 / 产品资料表
 * 功能：产品类别树/计量单位/产品资料、导入导出、打印标签
 * 说明：写操作均为 multipart/form-data（FormData）
 */
import { get, post, toFormData, toMultipart } from '@/utils/request'
import type { ApiResponse, RequestConfig } from '@/utils/request'

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
 *  后端返回 key 为 categories
 */
export interface ProductCategoryListResponse {
  total: number
  categories: ProductCategoryItem[]
}

/** 产品类别详情响应
 *  后端返回 key 为 category
 */
export interface ProductCategoryDetailResponse {
  category: ProductCategoryItem
}

/** 查询产品类别列表（树形）
 * URL: GET /api/v1/tenant-product-categories/list
 * 参数: sort_by, sort_order
 */
export function getProductCategoryList(params?: {
  sort_by?: string
  sort_order?: string
}, config?: RequestConfig): Promise<ApiResponse<ProductCategoryListResponse>> {
  return get<ProductCategoryListResponse>('/api/v1/tenant-product-categories/list', params as unknown as Record<string, unknown>, config)
}

/** 兼容别名：旧代码通过 getProductCategoryTree() 获取树，返回 product_category 数组 */
export async function getProductCategoryTree(config?: RequestConfig): Promise<ApiResponse<ProductCategoryItem[]>> {
  const res = await getProductCategoryList(undefined, config)
  return { ...res, data: res.data.categories } as ApiResponse<ProductCategoryItem[]>
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
  page_size?: number
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
  page_size?: number
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
  /** 子产品编码（部分接口返回） */
  component_product_code?: string | null
  /**
   * 子产品自身是否为组合产品（0=普通 / 1=组合），供前端判断能否继续展开。
   * 2026-09 组合嵌套放开后新增；只有 /tenant-products/detail、components/* 返回。
   */
  component_is_combined?: number
  num: number
  /**
   * 子产品单价（字符串；改造前绑定的存量记录为 null，展示时需判空）。
   * 绑定（components/create）时**必传**，须 ≥ 子产品当前 min_sale_price。
   */
  unit_price?: string | null
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
  available_stock?: string | null
  sale_prices: ProductSalePriceItem[]
  // 详情接口附加字段
  images?: ProductFileItem[]
  attachments?: ProductFileItem[]
  suppliers?: Array<{ supplier_id: string; supplier_name: string | null; supplier_model: string | null; avg_cost_price?: string | null; preset_purchase_price?: string | null; last_purchase_at?: string | null }>
  // 注意：supplier_avg_costs 已由后端移除（2026-09-15 供应商信息合并），
  // 均价信息并入 suppliers[]，请勿再读取该数组。
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

/** 创建产品入参（接口15，后端 Schema: TenantCreateProductRequest）
 *  supplier_id：**JSON 对象数组字符串**，每个元素含 `supplier_id` 与 `preset_purchase_price`（>0），
 *               支持一次传入多个供应商且各自不同价（2026-09-15 起旧格式不再支持，见 buildSupplierBindPayload）。
 *  min_sale_price：最低销售金额（必填，须 ≥ 出厂价）；毛利由后端反推存储。
 */
export interface CreateProductPayload {
  product_name: string
  product_type: string
  category_id: string
  /** 供应商绑定：JSON 对象数组字符串（{supplier_id, preset_purchase_price}[]） */
  supplier_id: string
  unit_id: string
  is_weighing: number
  factory_price: string
  fifo_flag: number
  is_combined: number
  /** 最低销售金额（必填，须 ≥ 出厂价）。2026-09 改造：替换原 gross_profit_ctrl_rate */
  min_sale_price: string
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
  /** 最低销售金额（可选，传入不得为空，须 ≥ 最终生效出厂价） */
  min_sale_price?: string
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

// ────────────── 产品图片识别（豆包视觉大模型，新增产品页右上角） ──────────────

/** 识别结果的单个字段 */
export interface RecognizeField {
  /** 字段值：文本/数值/枚举/字典 ID，或客户价格、供应商明细数组 */
  value: unknown
  /** 置信度：high / medium / low */
  confidence: 'high' | 'medium' | 'low'
  /** 来源：image */
  source: string
  /** 枚举/字典的中文显示值，或明细条数摘要 */
  label?: string
}

/** 识别单次调用的 token 消耗（OpenAI 兼容 usage，后端透传上游原始值，可能缺失） */
export interface RecognizeUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  [key: string]: unknown
}

/** 图片识别响应 data 结构 */
export interface RecognizeProductData {
  request_id: string
  model: string
  usage?: RecognizeUsage
  fields: Record<string, RecognizeField>
  warnings: string[]
}

/** 图片识别（接口：POST /api/v1/tenant-products/recognize，multipart/form-data）
 * 仅登录可用；上传 1～3 张同一产品的图片，返回一份合并后的可安全回填字段
 */
export function recognizeProductImage(image: File, scene = 'productInfo'): Promise<ApiResponse<RecognizeProductData>> {
  return recognizeProductImages([image], scene)
}

export function recognizeProductImages(images: File[], scene = 'productInfo'): Promise<ApiResponse<RecognizeProductData>> {
  const fd = new FormData()
  // 单图保留旧参数名，兼容尚未升级的后端；多图使用重复的 images 字段。
  if (images.length === 1) {
    fd.append('image', images[0])
  } else {
    images.forEach(image => fd.append('images', image))
  }
  fd.append('scene', scene)
  // 视觉模型处理高分辨率图片可能超过全局 30 秒请求超时，识别接口单独放宽。
  return post<RecognizeProductData>('/api/v1/tenant-products/recognize', fd, { timeout: 120000 })
}

/** 删除产品（接口28）
 * URL: POST /api/v1/tenant-products/delete
 */
export function deleteProduct(product_id: string): Promise<ApiResponse<{ product_id: string }>> {
  return post<{ product_id: string }>('/api/v1/tenant-products/delete', toFormData({ product_id }))
}

/** 删除产品预览响应（接口29）
 *  文档描述返回 {product_id, product_name, related_order_count, stock_count}，
 *  后端实际返回通用级联预览结构（target + cascade_items + summary），以下按实际契约定义。 */
export interface ProductDeletePreviewData {
  target: { id: string; name: string; type: string }
  cascade_items: Array<{ id: string; name: string; type: string }>
  cascade_count: number
  summary: string
}

/** 删除产品预览（接口29）
 * URL: GET /api/v1/tenant-products/delete/preview
 */
export function previewDeleteProduct(product_id: string): Promise<ApiResponse<ProductDeletePreviewData>> {
  return get<ProductDeletePreviewData>('/api/v1/tenant-products/delete/preview', { product_id })
}

/** 查询产品列表（按类别，接口23）
 * URL: GET /api/v1/tenant-products/list
 */
export function getProductList(params: {
  category_id: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}, config?: RequestConfig): Promise<ApiResponse<ProductListResponse>> {
  return get<ProductListResponse>('/api/v1/tenant-products/list', params as unknown as Record<string, unknown>, config)
}

/** 查询产品详情（接口24）
 * URL: GET /api/v1/tenant-products/detail
 * 后端返回 data 直接为 product 对象（非包裹在 {product:...} 中），
 * 含 suppliers 数组（各供应商的 preset_purchase_price 等），供采购下单预填预设采购价
 */
export function getProductDetail(product_id: string, config?: RequestConfig): Promise<ApiResponse<ProductItem>> {
  return get<ProductItem>('/api/v1/tenant-products/detail', { product_id }, config)
}

/** 搜索产品（接口36，跨类别多字段组合搜索）
 * URL: GET /api/v1/tenant-products/search
 */
export function searchProduct(params: {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
  /** 产品ID精准过滤（逗号分隔或 JSON 数组），最多 100 个；
   *  传入时命中项全量返回、不受分页限制，并与搜索字段 AND 组合。 */
  product_ids?: string
}, config?: RequestConfig): Promise<ApiResponse<ProductSearchResponse>> {
  return get<ProductSearchResponse>('/api/v1/tenant-products/search', params as unknown as Record<string, unknown>, config)
}

// ────────────── 产品销售价格（接口17-19） ──────────────

/** 批量绑定客户类型销售价格（接口17）
 * URL: POST /api/v1/tenant-products/sale-prices/create
 * items 为 JSON 数组字符串，每条含 customer_type_id、sale_price、remark
 */
export function bindProductSalePrices(product_id: string, items: Array<{ customer_type_id: string; sale_price: string; remark?: string }>, config?: RequestConfig): Promise<ApiResponse<{ created_count: number; sale_prices: ProductSalePriceItem[] }>> {
  return post<{ created_count: number; sale_prices: ProductSalePriceItem[] }>(
    '/api/v1/tenant-products/sale-prices/create',
    toFormData({ product_id, items: JSON.stringify(items) }),
    config
  )
}

/** 批量更新客户类型销售价格（接口18）
 * URL: POST /api/v1/tenant-products/sale-prices/update
 * items 为 JSON 数组字符串，每条含 sale_price_id 及可选更新字段
 */
export function updateProductSalePrices(product_id: string, items: Array<{ sale_price_id: string; sale_price?: string; remark?: string }>, config?: RequestConfig): Promise<ApiResponse<{ updated_count: number; sale_prices: ProductSalePriceItem[] }>> {
  return post<{ updated_count: number; sale_prices: ProductSalePriceItem[] }>(
    '/api/v1/tenant-products/sale-prices/update',
    toFormData({ product_id, items: JSON.stringify(items) }),
    config
  )
}

/** 删除客户类型销售价格（接口19）
 * URL: POST /api/v1/tenant-products/sale-prices/delete
 * 后端实际只接收 sale_price_id（单条），非文档描述的 product_id+sale_price_ids
 */
export function deleteProductSalePrice(sale_price_id: string): Promise<ApiResponse<{ sale_price_id: string }>> {
  return post<{ sale_price_id: string }>('/api/v1/tenant-products/sale-prices/delete', toFormData({ sale_price_id }))
}

// ────────────── 组合产品子产品绑定 ──────────────

/** 绑定组合件子产品
 * URL: POST /api/v1/tenant-products/components/create
 * 参数 combined_product_id + items，items 每条含 product_id、num、**unit_price（必传）**、remark。
 *
 * ⚠️ 2026-09 改造要点：
 * - `unit_price` 为**必传**，须 ≥ 该子产品当前 min_sale_price，缺失会整批驳回「unit_price 不得为空」；
 * - 子产品**不再要求是普通产品**（组合产品可作为子产品，支持多层嵌套）；
 * - 后端会做循环引用检测，成环返回 400「检测到循环引用…」。
 */
export function bindProductComponents(
  combined_product_id: string,
  items: Array<{ product_id: string; num: number; unit_price: string | number; remark?: string }>
): Promise<ApiResponse<{ created_count: number; components: ProductComponentItem[] }>> {
  return post<{ created_count: number; components: ProductComponentItem[] }>(
    '/api/v1/tenant-products/components/create',
    toFormData({ combined_product_id, items: JSON.stringify(items) })
  )
}

/** 更新组合件子产品
 * URL: POST /api/v1/tenant-products/components/update
 * items 每条含 component_id 及可选 component_product_id（换绑，支持组合产品+环检测）、num、unit_price、remark。
 * unit_price 不传保持原值；传入须 ≥ 最终生效子产品当前的 min_sale_price。
 */
export function updateProductComponents(
  items: Array<{ component_id: string; component_product_id?: string; num?: number; unit_price?: string | number; remark?: string }>
): Promise<ApiResponse<{ updated_count: number; components: ProductComponentItem[] }>> {
  return post<{ updated_count: number; components: ProductComponentItem[] }>(
    '/api/v1/tenant-products/components/update',
    toFormData({ items: JSON.stringify(items) })
  )
}

/** 删除组合件子产品（单条）
 * URL: POST /api/v1/tenant-products/components/delete
 */
export function deleteProductComponent(component_id: string): Promise<ApiResponse<{ component_id: string }>> {
  return post<{ component_id: string }>('/api/v1/tenant-products/components/delete', toFormData({ component_id }))
}

// ────────────── 组合产品查询（2026-09-15 新增三接口） ──────────────

/** 组合产品列表行（components/list 与 components/search 同构） */
export interface CombinedProductListItem {
  product_id: string
  product_code: string
  product_name: string
  category_name?: string | null
  unit_name?: string | null
  factory_price?: string | null
  min_sale_price?: string | null
  product_status?: string | null
  is_combined?: number
  /** 有效（未删除）绑定条数，可为 0 */
  component_count?: number
  /** 仅含一层直接子产品概要，不递归（完整树请用 previewComponentTree） */
  components?: ProductComponentItem[]
}

export interface CombinedProductListResponse {
  total: number
  page: number
  page_size: number
  products: CombinedProductListItem[]
}

/** 组合产品分页列表
 * URL: GET /api/v1/tenant-products/components/list
 * 参数：category_id（含子类别）、page、sort_by（product_name/product_code/factory_price/min_sale_price/created_at）、sort_order
 */
export function getCombinedProducts(params?: {
  category_id?: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<CombinedProductListResponse>> {
  return get<CombinedProductListResponse>('/api/v1/tenant-products/components/list', params as Record<string, unknown> | undefined)
}

/** 组合产品关键词搜索（产品名称/编码/品号模糊匹配）
 * URL: GET /api/v1/tenant-products/components/search
 * keyword 必填，为空后端返回 400。
 */
export function searchCombinedProducts(params: {
  keyword: string
  page?: number
}): Promise<ApiResponse<CombinedProductListResponse>> {
  return get<CombinedProductListResponse>('/api/v1/tenant-products/components/search', params as unknown as Record<string, unknown>)
}

/** 组合产品递归树节点 */
export interface ComponentTreeNode {
  component_id: string
  component_product_id: string
  component_product_name?: string | null
  component_product_code?: string | null
  component_is_combined?: number
  num: number
  /** 存量未定价记录为 null */
  unit_price?: string | null
  /** 绑定备注（绑定时可选录入） */
  remark?: string | null
  /** 子产品为组合产品时继续展开，直至叶子 */
  components: ComponentTreeNode[]
}

export interface ComponentPreviewResponse {
  product_id: string
  product_name: string
  product_code: string
  is_combined: number
  /** 普通产品返回空数组 */
  components: ComponentTreeNode[]
}

/** 组合产品结构预览（完整多层递归树；即"组合产品详情"的树形态）
 * URL: GET /api/v1/tenant-products/components/preview
 * 传入任意产品 ID：组合产品返回完整树，普通产品返回 is_combined=0 + components=[]，不存在返回 404。
 */
export function previewComponentTree(product_id: string): Promise<ApiResponse<ComponentPreviewResponse>> {
  return get<ComponentPreviewResponse>('/api/v1/tenant-products/components/preview', { product_id })
}

/** 批量预览：某产品节点绑定的有效供应商（来源 pur_supplier_product_bind，唯一口径） */
export interface BatchPreviewSupplier {
  supplier_id: string
  supplier_name: string | null
  supplier_model: string | null
  /** 三位小数口径（如 "11.800"）；有绑定但无均价记录时为 "0" */
  avg_cost_price: string | null
  /** 两位金额口径（如 "12.50"）；无均价记录时为 null */
  preset_purchase_price: string | null
  last_purchase_at: string | null
}

/** 批量预览树节点：在组合树节点基础上，同级补 suppliers */
export interface BatchPreviewTreeNode extends Omit<ComponentTreeNode, 'components'> {
  suppliers: BatchPreviewSupplier[]
  components: BatchPreviewTreeNode[]
}

/** 批量预览-普通产品分组项 */
export interface BatchPreviewNormalProduct {
  product_id: string
  product_name: string | null
  product_code: string | null
  is_combined: 0
  suppliers: BatchPreviewSupplier[]
}

/** 批量预览-组合产品分组项 */
export interface BatchPreviewCombinedProduct {
  product_id: string
  product_name: string | null
  product_code: string | null
  is_combined: 1
  /** 注：取组合产品自身的供应商绑定，通常为 []；采购对象是子产品，供应商挂在下层节点 */
  suppliers: BatchPreviewSupplier[]
  components: BatchPreviewTreeNode[]
}

export interface BatchPreviewResponse {
  /** 普通产品（原样回传，不做树展开） */
  normal_products: BatchPreviewNormalProduct[]
  /** 组合产品（含多层递归子产品树） */
  combined_products: BatchPreviewCombinedProduct[]
}

/** 组合产品批量结构预览（含普通产品 + 各层子产品，每节点同级带供应商列表）
 * URL: GET /api/v1/tenant-products/components/batch-preview
 * product_ids 为 JSON 数组字符串（Query 传参，自动 URL 编码）；空数组/非字符串/重复 ID 本地即拒。
 * 后端全量预校验：任一 product_id 无效则整批 400，detail.errors[].index 对应入参下标。
 * silent: 批量校验失败由调用方按 errors[].index 定位提示，避免全局 toast 重复刷屏。
 */
export function batchPreviewProducts(productIds: string[]): Promise<ApiResponse<BatchPreviewResponse>> {
  return get<BatchPreviewResponse>(
    '/api/v1/tenant-products/components/batch-preview',
    { product_ids: JSON.stringify(productIds) },
    { silent: true },
  )
}

// ────────────── 产品关联供应商（接口25-27） ──────────────

/** 供应商绑定产品行（接口25 / 25b 共用同一返回结构） */
export interface SupplierProductItem {
  product_id: string
  product_code: string
  /** 品号（2026-09-17 起随接口返回；产品未录品号时后端返回 null） */
  item_no: string | null
  product_name: string
  /** 是否组合商品：0 普通 / 1 组合 */
  is_combined: number
  category_id: string
  category_name: string
  specification: string | null
  color: string | null
  unit_id: string | null
  unit_name: string
  supplier_model: string | null
  avg_cost_price: string | null
  preset_purchase_price: string | null
  last_purchase_at: string | null
}

export interface SupplierProductListResponse {
  supplier_id: string
  supplier_name: string | null
  total: number
  page: number
  page_size: number
  products: SupplierProductItem[]
}

/** 查询供应商绑定的产品列表（接口25）
 * URL: GET /api/v1/tenant-products/suppliers/query
 * 后端实际参数为 supplier_id（非文档描述的 product_id），返回该供应商绑定的产品。
 * 后端为分页接口（page/page_size，page_size 上限 100），每行含 preset_purchase_price
 * （供应商预设采购价），供采购下单选产品时预填「采购单价」。
 * is_combined 为产品级属性（0/1），2026-09-16 起随本接口一并返回——
 * 此前缺失会导致「供应商模式」的产品选择弹窗把所有行都渲染成「组合商品：否」。
 * item_no（品号）2026-09-17 起返回，此前缺失会导致弹窗「品号」列全部渲染成「-」。
 *
 * ⚠️ 本接口不支持搜索条件；需要按名称/编码/品号过滤时请用 queryProductSuppliersSearch（接口25b）。
 */
export function queryProductSuppliers(
  supplier_id: string,
  params?: { page?: number; page_size?: number },
): Promise<ApiResponse<SupplierProductListResponse>> {
  return get<SupplierProductListResponse>('/api/v1/tenant-products/suppliers/query', { supplier_id, ...params })
}

/** 在指定供应商的绑定产品范围内搜索（接口25b）
 * URL: GET /api/v1/tenant-products/suppliers/search
 *
 * 与接口25（/suppliers/query）**同一返回结构**，区别是支持 search_field/search_value
 * 服务端过滤 + 服务端分页，作用域恒为该供应商的绑定产品（supplier_id 必传）。
 * 可搜索字段：product_code / product_name / item_no / specification / color /
 *             category_name / unit_name / supplier_model（多字段 AND）。
 *
 * ⚠️ search_field 与 search_value 后端为**必传**（无默认值），无过滤条件时须传 '[]' 与 '{}'，
 *    否则后端返回 422。用 buildSearchParams({...}) 的返回值可直接满足。
 *
 * 采购下单「产品选择」弹窗的供应商模式走本接口，替代原先「循环拉全量页 + 前端过滤」。
 */
export function queryProductSuppliersSearch(
  supplier_id: string,
  params: {
    search_field: string
    search_value: string
    page?: number
    page_size?: number
  },
): Promise<ApiResponse<SupplierProductListResponse>> {
  return get<SupplierProductListResponse>('/api/v1/tenant-products/suppliers/search', { supplier_id, ...params })
}

/** 供应商绑定元素：价格必须随供应商逐个传入 */
export interface SupplierBindItemInput {
  supplier_id: string
  /** 该供应商的预设采购价（必填、须 > 0） */
  preset_purchase_price?: string | number | null
  supplier_model?: string | null
}

/**
 * 构造供应商绑定入参 `supplier_id`（JSON 对象数组字符串）。
 *
 * ⚠️ 后端契约（2026-09-15 变更，`_resolve_supplier_price_map`）：
 *   `supplier_id` 必须是**对象数组**字符串，每个对象携带 `supplier_id` 与 `preset_purchase_price`（>0），
 *   以支持「一个供应商一个价」。**单值字符串、纯字符串数组等旧格式已不再支持**；
 *   任一供应商缺价格会整批 400「预设采购价格必须随供应商逐个传入…」。
 *   同时顶层 `preset_purchase_price` 参数已从后端移除（传了会被忽略），不得再依赖它。
 *
 * 适用于 `/tenant-products/create` 与 `/tenant-products/suppliers/add`（两端共用同一解析器）。
 */
export function buildSupplierBindPayload(items: SupplierBindItemInput[]): string {
  return JSON.stringify(items.map((it) => ({
    supplier_id: String(it.supplier_id ?? '').trim(),
    preset_purchase_price: it.preset_purchase_price === undefined || it.preset_purchase_price === null
      ? ''
      : String(it.preset_purchase_price).trim(),
    ...(it.supplier_model ? { supplier_model: it.supplier_model } : {}),
  })))
}

/** 为产品新增关联供应商（接口26）
 * URL: POST /api/v1/tenant-products/suppliers/add
 *
 * 后端要求价格随供应商逐个传入，本函数统一把入参归一化为
 * `[{ supplier_id, preset_purchase_price, supplier_model? }]` 再序列化，
 * 因此下面两种写法都正确：
 *   1) 一次传多个供应商（各自带价）：`supplier_id: [{ supplier_id, preset_purchase_price }, ...]`
 *   2) 兼容旧调用：`supplier_id: 'sp_xxx'` + 顶层 `preset_purchase_price`（会自动折入数组元素）
 */
export function addProductSupplier(data: {
  product_id: string
  /** 供应商：单个ID，或（带各自价格的）对象数组 */
  supplier_id: string | SupplierBindItemInput[]
  /** 兼容旧调用：单个供应商时的预设采购价（会折入 supplier_id 数组元素） */
  preset_purchase_price?: string | number
  supplier_model?: string
}, config?: RequestConfig): Promise<ApiResponse<{ added_count: number; suppliers: unknown[] }>> {
  const items: SupplierBindItemInput[] = Array.isArray(data.supplier_id)
    ? data.supplier_id.map((it) => ({
        supplier_id: it.supplier_id,
        preset_purchase_price: it.preset_purchase_price ?? data.preset_purchase_price,
        supplier_model: it.supplier_model ?? data.supplier_model,
      }))
    : [{ supplier_id: data.supplier_id, preset_purchase_price: data.preset_purchase_price, supplier_model: data.supplier_model }]
  const payload: Record<string, unknown> = {
    product_id: data.product_id,
    supplier_id: buildSupplierBindPayload(items),
  }
  return post<{ added_count: number; suppliers: unknown[] }>('/api/v1/tenant-products/suppliers/add', toFormData(payload), config)
}

/** 更新供应商预设采购价格（接口28）
 * URL: POST /api/v1/tenant-products/suppliers/update-price
 * 仅允许更新已绑定且未删除的供应商。
 *
 * ⚠️ 同属 2026-09-15 契约变更：后端签名已收敛为 `product_id` + `supplier_id` 两个 Form 参数，
 * 价格必须随供应商逐个传入（`supplier_id` 对象数组内 `preset_purchase_price`），
 * 顶层 `preset_purchase_price` 已被移除（传了会被忽略）。支持一次为多个供应商设不同价格。
 * 本函数做了归一化，故下面两种写法都正确：
 *   1) `supplier_id: [{ supplier_id, preset_purchase_price }, ...]`（推荐，一次改多个）
 *   2) 兼容旧调用：`supplier_id: 'sp_xxx'` + 顶层 `preset_purchase_price`
 */
export function updateSupplierPresetPrice(data: {
  product_id: string
  /** 供应商：单个ID，或（带各自新价格的）对象数组 */
  supplier_id: string | SupplierBindItemInput[]
  /** 兼容旧调用：单个供应商时的新预设采购价（会折入 supplier_id 数组元素） */
  preset_purchase_price?: string | number
}, config?: RequestConfig): Promise<ApiResponse<{ product_id: string; updated_supplier_ids: string[] }>> {
  const items: SupplierBindItemInput[] = Array.isArray(data.supplier_id)
    ? data.supplier_id.map((it) => ({
        supplier_id: it.supplier_id,
        preset_purchase_price: it.preset_purchase_price ?? data.preset_purchase_price,
      }))
    : [{ supplier_id: data.supplier_id, preset_purchase_price: data.preset_purchase_price }]
  const payload: Record<string, unknown> = {
    product_id: data.product_id,
    supplier_id: buildSupplierBindPayload(items),
  }
  return post<{ product_id: string; updated_supplier_ids: string[] }>('/api/v1/tenant-products/suppliers/update-price', toFormData(payload), config)
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

// ────────────── 滞销产品（接口N / N+1） ──────────────

/** 滞销产品列表单条记录 */
export interface SlowMovingItem {
  product_id: string
  product_code: string
  product_name: string
  category_id: string
  category_name: string
  specification: string | null
  color: string | null
  unit_name: string
  product_created_at: string | null
  last_sale_date: string | null
  available_stock: string
  avg_cost_price: string
  amount: string
  suppliers: Array<{ supplier_id: string; supplier_name: string }>
}

/** 滞销产品列表响应 */
export interface SlowMovingListResponse {
  total: number
  threshold_months: number
  items: SlowMovingItem[]
}

/** 查询滞销产品分页列表（接口N）
 * URL: GET /api/v1/tenant-products/slow-moving/query
 */
export function getSlowMovingProducts(params: {
  page: number
  page_size?: number
  sort_field?: string
  sort_order?: string
}): Promise<ApiResponse<SlowMovingListResponse>> {
  return get<SlowMovingListResponse>('/api/v1/tenant-products/slow-moving/query', params as unknown as Record<string, unknown>)
}

/** 搜索滞销产品（接口N+1）
 * URL: GET /api/v1/tenant-products/slow-moving/search
 */
export function searchSlowMovingProducts(params: {
  keyword: string
  search_field?: string
  page: number
  page_size?: number
  sort_field?: string
  sort_order?: string
}): Promise<ApiResponse<SlowMovingListResponse>> {
  return get<SlowMovingListResponse>('/api/v1/tenant-products/slow-moving/search', params as unknown as Record<string, unknown>)
}
