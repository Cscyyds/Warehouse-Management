/**
 * 模块：Excel 批量导入（产品/客户/员工/供应商/采购订单）
 * 源接口：
 *   - POST /api/v1/tenant-products/import
 *   - POST /api/v1/tenant-customers/import
 *   - POST /api/v1/tenant-users/import
 *   - POST /api/v1/tenant-suppliers/import
 *   - POST /api/v1/tenant-purchase-orders/import （双 Sheet：采购主单 + 采购明细）
 * 功能：上传 .xlsx 文件，后端逐行校验后批量创建；存在错误时不落库，统一返回错误明细。
 * 说明：均为 multipart/form-data，表单字段名固定为 file。
 *   差异：单 Sheet 接口 errors 为扁平数组；采购订单双 Sheet 接口 errors 按工作表分组
 *   （{ purchase_order: [...], purchase_order_item: [...] }），错误项带 sheet 字段。
 */
import { post, toMultipart } from '@/utils/request'
import type { ApiResponse, RequestConfig } from '@/utils/request'

/** 单 Sheet 批量导入结果统计（供应商/产品/客户/员工） */
export interface BatchImportResult {
  total_rows?: number
  success_count?: number
  failure_count?: number
  errors?: Array<Record<string, unknown>>
}

/** 采购订单双 Sheet 导入的分表统计（各表行数 / 通过 / 失败） */
export interface PurchaseOrderImportSheetStats {
  total: number
  valid_count: number
  invalid_count: number
}

/** 采购订单批量导入结果（双 Sheet：errors 按工作表名称分组，错误项含 sheet/row/name/reason） */
export interface PurchaseOrderImportResult {
  purchase_order?: PurchaseOrderImportSheetStats
  purchase_order_item?: PurchaseOrderImportSheetStats
  errors?: {
    [sheetName: string]: Array<Record<string, unknown>>
  }
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

/** 批量导入采购订单（双 Sheet：采购主单 + 采购明细）
 * URL: POST /api/v1/tenant-purchase-orders/import
 * 说明：任一表任一行校验失败即全部不落库；errors 按工作表分组，错误项含 sheet 字段。
 */
export function importPurchaseOrders(file: File, config?: RequestConfig): Promise<ApiResponse<PurchaseOrderImportResult>> {
  return post<PurchaseOrderImportResult>('/api/v1/tenant-purchase-orders/import', toMultipart({ file }), config)
}
