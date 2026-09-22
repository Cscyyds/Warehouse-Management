import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse, RequestConfig } from '@/utils/request'

export type ImportTaskType = 'employee' | 'product' | 'customer' | 'supplier' | 'sales-order' | 'purchase-order'
export type ImportTaskStatus = 'PENDING' | 'VALIDATING' | 'WRITING' | 'SUCCESS' | 'FAILED_VALIDATION' | 'FAILED_SYSTEM'
export type ImportSheetKey = 'sales_order' | 'sales_order_item' | 'purchase_order' | 'purchase_order_item'

export const IMPORT_TASK_APIS = {
  employee: { list: '/api/v1/import-tasks/employee/list', detail: '/api/v1/import-tasks/employee/detail', submit: '/api/v1/tenant-users/import' },
  product: { list: '/api/v1/import-tasks/product/list', detail: '/api/v1/import-tasks/product/detail', submit: '/api/v1/tenant-products/import' },
  customer: { list: '/api/v1/import-tasks/customer/list', detail: '/api/v1/import-tasks/customer/detail', submit: '/api/v1/tenant-customers/import' },
  supplier: { list: '/api/v1/import-tasks/supplier/list', detail: '/api/v1/import-tasks/supplier/detail', submit: '/api/v1/tenant-suppliers/import' },
  'sales-order': { list: '/api/v1/import-tasks/sales-order/list', detail: '/api/v1/import-tasks/sales-order/detail', submit: '/api/v1/tenant-sales-orders/import' },
  'purchase-order': { list: '/api/v1/import-tasks/purchase-order/list', detail: '/api/v1/import-tasks/purchase-order/detail', submit: '/api/v1/tenant-purchase-orders/import' },
} satisfies Record<ImportTaskType, { list: string; detail: string; submit: string }>

export interface ImportTaskSubmission {
  import_task_id: string
  task_type: string
  task_type_name: string
  status: ImportTaskStatus
  status_name: string
  total_count: number
  order_total: number | null
  item_total: number | null
  file_name: string | null
  file_url: string | null
  created_at: string | null
  query_api: string
}

export interface ImportTaskError {
  sheet?: string
  row: number
  name: string
  reason: string
}

export interface ImportTask extends Omit<ImportTaskSubmission, 'query_api'> {
  is_finished: boolean
  file_size: number | null
  processed_count: number
  success_count: number
  error_count: number
  has_error: boolean
  error_message: string | null
  latest_errors: ImportTaskError[]
  created_by_name: string | null
  updated_at: string | null
  started_at: string | null
  finished_at: string | null
}

export interface ImportSheetStats {
  total: number
  valid_count: number
  invalid_count: number
}

export interface ImportTaskDetail extends ImportTask {
  total_rows?: number
  valid_count?: number
  invalid_count?: number
  error_total?: number
  error_page: number
  error_page_size: number
  errors: ImportTaskError[] | Partial<Record<ImportSheetKey, ImportTaskError[]>>
  sales_order?: ImportSheetStats
  sales_order_item?: ImportSheetStats
  purchase_order?: ImportSheetStats
  purchase_order_item?: ImportSheetStats
}

export interface ImportTaskList {
  list: ImportTask[]
  total: number
  page: number
  page_size: number
}

export interface ImportTaskListParams {
  status?: ImportTaskStatus
  start_time?: string
  end_time?: string
  page: number
  page_size: number
}

export function getImportTasks(type: ImportTaskType, params: ImportTaskListParams, config?: RequestConfig) {
  return get<ImportTaskList>(IMPORT_TASK_APIS[type].list, { ...params }, config)
}

export function getImportTaskDetail(type: ImportTaskType, id: string, page = 1, pageSize = 50, config?: RequestConfig) {
  return get<ImportTaskDetail>(IMPORT_TASK_APIS[type].detail, {
    import_task_id: id, error_page: page, error_page_size: pageSize,
  }, config)
}

export function importProducts(file: File, config?: RequestConfig): Promise<ApiResponse<ImportTaskSubmission>> {
  return post<ImportTaskSubmission>('/api/v1/tenant-products/import', toMultipart({ file }), config)
}

export function importCustomers(file: File, config?: RequestConfig): Promise<ApiResponse<ImportTaskSubmission>> {
  return post<ImportTaskSubmission>('/api/v1/tenant-customers/import', toMultipart({ file }), config)
}

export function importUsers(file: File, config?: RequestConfig): Promise<ApiResponse<ImportTaskSubmission>> {
  return post<ImportTaskSubmission>('/api/v1/tenant-users/import', toMultipart({ file }), config)
}

export function importSuppliers(file: File, config?: RequestConfig): Promise<ApiResponse<ImportTaskSubmission>> {
  return post<ImportTaskSubmission>('/api/v1/tenant-suppliers/import', toMultipart({ file }), config)
}

export function importPurchaseOrders(file: File, config?: RequestConfig): Promise<ApiResponse<ImportTaskSubmission>> {
  return post<ImportTaskSubmission>('/api/v1/tenant-purchase-orders/import', toMultipart({ file }), config)
}

export function importSalesOrders(file: File, config?: RequestConfig): Promise<ApiResponse<ImportTaskSubmission>> {
  return post<ImportTaskSubmission>('/api/v1/tenant-sales-orders/import', toMultipart({ file }), config)
}
