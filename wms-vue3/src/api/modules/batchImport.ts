/**
 * 模块：Excel 批量导入（产品/客户/员工/供应商）
 * 源接口：
 *   - POST /api/v1/tenant-products/import
 *   - POST /api/v1/tenant-customers/import
 *   - POST /api/v1/tenant-users/import
 *   - POST /api/v1/tenant-suppliers/import
 * 功能：上传 .xlsx 文件，后端逐行校验后批量创建；存在错误时不落库，统一返回错误明细。
 * 说明：均为 multipart/form-data，表单字段名固定为 file；返回 data 结构统一。
 */
import { post, toMultipart } from '@/utils/request'
import type { ApiResponse, RequestConfig } from '@/utils/request'

/** 批量导入返回结果（四个接口统一） */
export interface BatchImportResult {
  total_rows?: number
  success_count?: number
  failure_count?: number
  errors?: Array<Record<string, unknown>>
}

/** 批量导入产品
 * URL: POST /api/v1/tenant-products/import
 * config.silent 为 true 时不弹全局错误 toast（由弹窗自行展示）
 */
export function importProducts(file: File, config?: RequestConfig): Promise<ApiResponse<BatchImportResult>> {
  return post<BatchImportResult>('/api/v1/tenant-products/import', toMultipart({ file }), config)
}

/** 批量导入正式客户
 * URL: POST /api/v1/tenant-customers/import
 */
export function importCustomers(file: File, config?: RequestConfig): Promise<ApiResponse<BatchImportResult>> {
  return post<BatchImportResult>('/api/v1/tenant-customers/import', toMultipart({ file }), config)
}

/** 批量导入员工
 * URL: POST /api/v1/tenant-users/import
 */
export function importUsers(file: File, config?: RequestConfig): Promise<ApiResponse<BatchImportResult>> {
  return post<BatchImportResult>('/api/v1/tenant-users/import', toMultipart({ file }), config)
}

/** 批量导入供应商
 * URL: POST /api/v1/tenant-suppliers/import
 */
export function importSuppliers(file: File, config?: RequestConfig): Promise<ApiResponse<BatchImportResult>> {
  return post<BatchImportResult>('/api/v1/tenant-suppliers/import', toMultipart({ file }), config)
}
