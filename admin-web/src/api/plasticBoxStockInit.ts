/**
 * 平台管理员侧：塑料盒库存期初导入（2026-09-29 批次，3 接口，平台管理员 JWT 鉴权）
 * 异步导入：import 提交后只做快检（表头/行数/文件可解析），逐行校验与库存写入在后台
 * 执行，用 list/detail 两个查询接口轮询进度与错误明细（条目与租户侧导入任务同构）。
 */
import { getData, postMultipart } from './http'

/* —— 类型 —— */

export type StockInitTaskStatus =
  | 'PENDING' | 'VALIDATING' | 'WRITING' | 'SUCCESS' | 'FAILED_VALIDATION' | 'FAILED_SYSTEM'

/** 单条错误（单 Sheet 结构） */
export interface StockInitTaskError {
  row: number
  name: string
  reason: string
  sheet?: string
}

/** 导入任务条目（list 条目，与租户侧 plastic-box 导入任务同构） */
export interface StockInitTask {
  import_task_id: string
  task_type: string
  task_type_name: string
  status: StockInitTaskStatus
  status_name: string
  is_finished: boolean
  file_name: string | null
  file_url: string | null
  file_size: number | null
  total_count: number
  order_total: number | null
  item_total: number | null
  processed_count: number
  success_count: number
  error_count: number
  has_error: boolean
  error_message: string | null
  latest_errors: StockInitTaskError[]
  created_by_name: string | null
  created_at: string | null
  updated_at: string | null
  started_at: string | null
  finished_at: string | null
}

/** 导入提交返回（快检通过后受理结果；逐行校验结果不在此返回） */
export interface StockInitImportResult {
  import_task_id: string
  task_type: string
  task_type_name: string
  status: StockInitTaskStatus
  status_name: string
  total_count: number
  order_total: number | null
  item_total: number | null
  file_name: string | null
  file_url: string | null
  created_at: string | null
  query_api?: string
}

export interface StockInitTaskListResult {
  list: StockInitTask[]
  total: number
  page: number
  page_size: number
}

/** 任务详情：任务全字段 + 错误明细分页（单 Sheet 结构） */
export interface StockInitTaskDetail extends StockInitTask {
  total_rows: number
  valid_count: number
  invalid_count: number
  errors: StockInitTaskError[]
  error_total: number
  error_page: number
  error_page_size: number
}

/* —— ① 塑料盒库存期初 Excel 导入（异步提交） —— */

export function importPlasticBoxStockInit(tenantId: string, file: File): Promise<StockInitImportResult> {
  const form = new FormData()
  form.append('tenant_id', tenantId)
  form.append('file', file)
  return postMultipart<StockInitImportResult>('/platform-wms/plastic-box-stock-init/import', form)
}

/* —— ② 任务列表查询 —— */

export function queryStockInitImportTasks(params: {
  tenant_id: string
  status?: StockInitTaskStatus | ''
  start_time?: string
  end_time?: string
  page?: number
  page_size?: number
}): Promise<StockInitTaskListResult> {
  return getData<StockInitTaskListResult>('/platform-wms/plastic-box-stock-init/import-tasks/list', {
    tenant_id: params.tenant_id,
    status: params.status || undefined,
    start_time: params.start_time || undefined,
    end_time: params.end_time || undefined,
    page: params.page ?? 1,
    page_size: params.page_size ?? 10,
  })
}

/* —— ③ 任务详情查询（含错误明细分页） —— */

export function queryStockInitImportTaskDetail(params: {
  tenant_id: string
  import_task_id: string
  error_page?: number
  error_page_size?: number
}): Promise<StockInitTaskDetail> {
  return getData<StockInitTaskDetail>('/platform-wms/plastic-box-stock-init/import-tasks/detail', {
    tenant_id: params.tenant_id,
    import_task_id: params.import_task_id,
    error_page: params.error_page ?? 1,
    error_page_size: params.error_page_size ?? 50,
  })
}
