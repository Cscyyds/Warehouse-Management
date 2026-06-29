/**
 * 模块：供应商管理
 * 表名：供应商类型表 / 供应商档案表
 * 功能：供应商类型、供应商档案的 CRUD / 搜索 / 详情 / 文件管理
 * 说明：写操作均为 multipart/form-data（FormData），字段统一 snake_case
 * 后端 Schema：platform_management.py TenantCreateSupplierTypeRequest / TenantCreateSupplierRequest
 */
import { get, post, toFormData, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

// ==================== 供应商类型 ====================

/** 供应商类型项（后端返回，snake_case） */
export interface SupplierTypeItem {
  supplier_type_id: string
  type_name: string
  status: number
  remark?: string | null
  created_at?: string
  updated_at?: string
  created_by?: string | null
  created_by_name?: string | null
  updated_by?: string | null
  updated_by_name?: string | null
}

/** 供应商类型列表响应 */
export interface SupplierTypeListResponse {
  total: number
  page?: number
  page_size?: number
  supplier_type: SupplierTypeItem[]
}

/** 供应商类型详情响应 */
export interface SupplierTypeDetailResponse {
  supplier_type: SupplierTypeItem
}

/** 新增供应商类型请求参数 */
export interface CreateSupplierTypePayload {
  type_name: string
  remark?: string
  status?: number | string
}

/** 修改供应商类型请求参数 */
export interface UpdateSupplierTypePayload {
  supplier_type_id: string
  type_name?: string
  remark?: string
  status?: number | string
}

/** 新增供应商类型
 * URL: POST /api/v1/tenant-supplier-types/create
 */
export function createSupplierType(data: CreateSupplierTypePayload): Promise<ApiResponse<SupplierTypeItem>> {
  return post<SupplierTypeItem>('/api/v1/tenant-supplier-types/create', toFormData(data as unknown as Record<string, unknown>))
}

/** 修改供应商类型
 * URL: POST /api/v1/tenant-supplier-types/update
 */
export function updateSupplierType(data: UpdateSupplierTypePayload): Promise<ApiResponse<SupplierTypeItem>> {
  return post<SupplierTypeItem>('/api/v1/tenant-supplier-types/update', toFormData(data as unknown as Record<string, unknown>))
}

/** 删除供应商类型（若有供应商绑定时需传 migrate_target_id）
 * URL: POST /api/v1/tenant-supplier-types/delete
 */
export function deleteSupplierType(supplier_type_id: string, migrate_target_id?: string): Promise<ApiResponse<{ supplier_type_id: string }>> {
  const payload: Record<string, unknown> = { supplier_type_id }
  if (migrate_target_id) payload.migrate_target_id = migrate_target_id
  return post<{ supplier_type_id: string }>('/api/v1/tenant-supplier-types/delete', toFormData(payload))
}

/** 查询供应商类型列表
 * URL: GET /api/v1/tenant-supplier-types/list
 */
export function getSupplierTypeList(params?: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SupplierTypeListResponse>> {
  return get<SupplierTypeListResponse>('/api/v1/tenant-supplier-types/list', params as unknown as Record<string, unknown>)
}

/** 查询供应商类型详情
 * URL: GET /api/v1/tenant-supplier-types/detail
 */
export function getSupplierTypeDetail(supplier_type_id: string): Promise<ApiResponse<SupplierTypeDetailResponse>> {
  return get<SupplierTypeDetailResponse>('/api/v1/tenant-supplier-types/detail', { supplier_type_id })
}

/** 搜索供应商类型
 * URL: GET /api/v1/tenant-supplier-types/search
 */
export function searchSupplierType(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SupplierTypeListResponse>> {
  return get<SupplierTypeListResponse>('/api/v1/tenant-supplier-types/search', params as unknown as Record<string, unknown>)
}

/** 供应商类型迁移（将源类型下所有供应商批量迁移到目标类型）
 * URL: POST /api/v1/tenant-supplier-types/migrate
 */
export function migrateSupplierType(source_supplier_type_id: string, target_supplier_type_id: string): Promise<ApiResponse<{ migrated_count: number }>> {
  return post<{ migrated_count: number }>('/api/v1/tenant-supplier-types/migrate', toFormData({ source_supplier_type_id, target_supplier_type_id }))
}

// ==================== 供应商档案 ====================

/** 供应商档案项（后端返回，snake_case） */
export interface SupplierItem {
  supplier_id: string
  supplier_code?: string
  supplier_name: string
  short_name?: string | null
  supplier_type_id?: string | null
  supplier_type_name?: string | null
  area_id?: string | null
  detail_address?: string | null
  phone1?: string | null
  phone2?: string | null
  fax_no?: string | null
  email?: string | null
  principal_phone?: string | null
  business_contact?: string | null
  contact_phone?: string | null
  bank_name?: string | null
  bank_account?: string | null
  payee_name?: string | null
  purchaser_user_id?: string | null
  balance?: string
  credit_amount?: string
  prepayment_amount?: string
  gift_amount?: string
  is_monthly_settlement?: number
  status: number
  remark?: string | null
  image_urls?: string[]
  attachment_urls?: string[]
  created_at?: string
  updated_at?: string
  created_by?: string | null
  created_by_name?: string | null
  updated_by?: string | null
  updated_by_name?: string | null
}

/** 供应商列表响应（后端返回 key 为 supplier 单数命名） */
export interface SupplierListResponse {
  total: number
  page?: number
  page_size?: number
  supplier: SupplierItem[]
}

/** 供应商详情响应 */
export interface SupplierDetailResponse {
  supplier: SupplierItem
}

/** 新增供应商请求参数 */
export interface CreateSupplierPayload {
  supplier_name: string
  short_name?: string
  supplier_type_id?: string
  area_id?: string
  detail_address?: string
  phone1?: string
  phone2?: string
  fax_no?: string
  email?: string
  principal_phone?: string
  business_contact?: string
  contact_phone?: string
  bank_name?: string
  bank_account?: string
  payee_name?: string
  purchaser_user_id?: string
  remark?: string
  status?: number | string
}

/** 修改供应商请求参数 */
export interface UpdateSupplierPayload extends Partial<CreateSupplierPayload> {
  supplier_id: string
}

/** 新增供应商（支持上传图片和附件）
 * URL: POST /api/v1/tenant-suppliers/create
 */
export function createSupplier(data: CreateSupplierPayload, files?: { images?: File[]; attachments?: File[] }): Promise<ApiResponse<SupplierItem>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<SupplierItem>('/api/v1/tenant-suppliers/create', fd)
}

/** 修改供应商（可追加图片和附件）
 * URL: POST /api/v1/tenant-suppliers/update
 */
export function updateSupplier(data: UpdateSupplierPayload, files?: { images?: File[]; attachments?: File[] }): Promise<ApiResponse<SupplierItem>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<SupplierItem>('/api/v1/tenant-suppliers/update', fd)
}

/** 删除供应商
 * URL: POST /api/v1/tenant-suppliers/delete
 */
export function deleteSupplier(supplier_id: string): Promise<ApiResponse<{ supplier_id: string }>> {
  return post<{ supplier_id: string }>('/api/v1/tenant-suppliers/delete', toFormData({ supplier_id }))
}

/** 查询供应商列表
 * URL: GET /api/v1/tenant-suppliers/list
 */
export function getSupplierList(params?: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SupplierListResponse>> {
  return get<SupplierListResponse>('/api/v1/tenant-suppliers/list', params as unknown as Record<string, unknown>)
}

/** 查询供应商详情
 * URL: GET /api/v1/tenant-suppliers/detail
 */
export function getSupplierDetail(supplier_id: string): Promise<ApiResponse<SupplierDetailResponse>> {
  return get<SupplierDetailResponse>('/api/v1/tenant-suppliers/detail', { supplier_id })
}

/** 搜索供应商
 * URL: GET /api/v1/tenant-suppliers/search
 */
export function searchSupplier(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<SupplierListResponse>> {
  return get<SupplierListResponse>('/api/v1/tenant-suppliers/search', params as unknown as Record<string, unknown>)
}

/** 删除供应商图片
 * URL: POST /api/v1/tenant-suppliers/images/delete
 */
export function deleteSupplierImages(supplier_id: string, image_urls: string[]): Promise<ApiResponse<{ deleted_count: number; remaining_image_urls: string[] }>> {
  return post<{ deleted_count: number; remaining_image_urls: string[] }>('/api/v1/tenant-suppliers/images/delete', toFormData({ supplier_id, image_urls: JSON.stringify(image_urls) }))
}

/** 删除供应商附件
 * URL: POST /api/v1/tenant-suppliers/attachments/delete
 */
export function deleteSupplierAttachments(supplier_id: string, file_urls: string[]): Promise<ApiResponse<{ deleted_count: number; remaining_attachment_urls: string[] }>> {
  return post<{ deleted_count: number; remaining_attachment_urls: string[] }>('/api/v1/tenant-suppliers/attachments/delete', toFormData({ supplier_id, file_urls: JSON.stringify(file_urls) }))
}
