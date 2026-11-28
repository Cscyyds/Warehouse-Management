/**
 * 模块：生产管理 · 原生三单（租客侧，本地业务单据）
 * 源接口：nuomi_wms/docs/正常流程生产三单改造方案/接口实测手册_20261124/01_主工程57条接口.md
 * 权限：perm_production_native_view（查询）/ perm_production_native_manage（写操作）
 * 编码：写接口全部 multipart/form-data（Text 字段）；items 为单个 Text 字段内的 JSON 数组字符串；
 *      数组元素版本=整数、数量=十进制字符串；bill_date 仅 YYYY-MM-DD。
 *
 * 与手册的 12 处已知偏差按代码实现适配（见 docs/本日接口变更.md 2026-11-25 批次）：
 * - detail 无 summary/has_more_items/exception_summary/顶层 can_*；能力判断读 allowed_actions。
 * - 批量写接口顶层无 version；新版本读 data.results[0].version。
 * - items/delete 顶层为 updated_count（恒 0）；真实计数在 results[] 内。
 * - create 无 created_count；items/create 才有。
 * - 退料 items/update 只回显本次提交明细，不能用于整体刷新。
 */
import { get, post, type ApiResponse, type RequestConfig } from '@/utils/request'

// ---------- 常量 ----------

/** 原生三单（顺序 = 菜单顺序） */
export const NATIVE_PRODUCTION_DOCS = [
  { docKey: 'production-picking', name: '生产领料单' },
  { docKey: 'production-return', name: '生产退料单' },
  { docKey: 'finished-goods-stockin', name: '成品缴库单' },
] as const

export type NativeDocKey = (typeof NATIVE_PRODUCTION_DOCS)[number]['docKey']

/** docKey → 中文名（面包屑/标题用） */
export const NATIVE_DOC_NAME: Record<string, string> = Object.fromEntries(
  NATIVE_PRODUCTION_DOCS.map((d) => [d.docKey, d.name]),
)

/** 各单据明细行可编辑字段（items/update 白名单，行级；供表单置灰判断） */
export const NATIVE_ITEM_EDITABLE_FIELDS: Record<NativeDocKey, readonly string[]> = {
  'production-picking': ['qty', 'length', 'xjxc', 'remark'],
  'finished-goods-stockin': ['qty', 'length', 'remark'],
  'production-return': ['return_qty', 'remark'],
}

/** 各单据长度单位（后端长度校验支持的物理单位） */
export const NATIVE_LENGTH_UNITS = ['m', 'dm', 'cm', 'mm'] as const

// ---------- 类型 ----------

export interface NativeHeaderRow {
  bill_id: string
  bill_no: string
  bill_date: string
  version: number
  audit_status: number
  audit_status_name?: string
  warehouse_status: number
  warehouse_status_name?: string
  business_status: 'NORMAL' | 'EXCEPTION' | 'VOID'
  business_status_name?: string
  created_by?: string
  created_by_name?: string
  created_at?: string
  updated_by_name?: string
  updated_at?: string
  send_by_name?: string | null
  send_at?: string | null
  source_picking_id?: string
  source_picking_no?: string
  audit_by_name?: string
  audit_at?: string
  audit_remark?: string
  allowed_actions?: NativeAllowedActions
  remark?: string | null
  [key: string]: unknown
}

export interface NativeAllowedActions {
  can_edit?: boolean
  can_audit?: boolean
  can_send?: boolean
  can_cancel_send?: boolean
  can_append_items?: boolean
  can_update_item_qty?: boolean
  [key: string]: unknown
}

export interface NativeListResult {
  total: number
  page: number
  page_size: number
  items: Array<NativeHeaderRow & { allowed_actions?: NativeAllowedActions }>
}

export interface NativeItemRow {
  item_id: string
  bill_id: string
  bill_no?: string
  line_no?: number
  client_line_id?: string
  version: number
  header_version?: number
  product_id: string
  product_code: string
  product_name: string
  specification?: string | null
  color?: string | null
  unit_id?: string | null
  unit_name?: string | null
  length?: string | null
  length_value?: string | null
  length_unit?: string | null
  xjxc?: number
  length_text?: string | null
  length_dimension?: 'LENGTH' | 'NON_LENGTH' | 'UNRESOLVED_UNIT' | null
  length_status?: string
  qty?: string | null
  return_qty?: string | null
  remaining_qty?: string | null
  actual_qty?: string | null
  confirmed_release_qty?: string | null
  deducted_return_qty?: string | null
  deducted_out_qty?: string | null
  finalized_deduction_qty?: string | null
  pending_physical_return_qty?: string | null
  actual_physical_return_qty?: string | null
  warehouse_task_status?: number
  exception_status?: string
  resource_state?: string
  source_picking_id?: string
  source_picking_item_id?: string
  source_picking_no?: string
  return_reason?: string | null
  remark?: string | null
  eligible?: boolean
  blocked_reason?: string | null
  blocked_reason_message?: string | null
  [key: string]: unknown
}

export interface NativeItemsResult {
  total: number
  page: number
  page_size: number
  items: NativeItemRow[]
}

export interface NativeDetailResult extends NativeHeaderRow {
  items: NativeItemRow[]
  allowed_actions?: NativeAllowedActions
  blocked_reasons?: Record<string, string>
  blocked_reason_messages?: Record<string, string>
}

/** 批量写接口（audit/unaudit/send/cancel-send/delete/items/delete）的响应：逐单结果在 results[] */
export interface NativeBatchResult<T = unknown> {
  request_id: string
  replayed: boolean
  /** audit/unaudit/send/cancel-send 为 updated_count；delete 为 deleted_count；items/delete 顶层 updated_count 恒 0 */
  updated_count?: number
  deleted_count?: number
  deleted_item_count?: number
  results?: Array<{
    bill_id: string
    bill_no?: string
    version?: number
    deleted_count?: number
    deleted_item_count?: number
    items?: Array<{ item_id: string; version: number }>
    [key: string]: unknown
  } & T>
}

/** 单主单写接口（create/update/items/*）的响应 */
export interface NativeWriteResult extends Partial<NativeBatchResult> {
  bill_id?: string
  bill_no?: string
  version?: number
  items?: NativeItemRow[]
  created_items?: NativeItemRow[]
  created_count?: number
  [key: string]: unknown
}

// ---------- 工具 ----------

/** 生成 request_id：一次提交动作生成一次，网络失败重试沿用，改内容必须换新。 */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // 开发环境兜底（http 明文环境 crypto.randomUUID 可能不可用）
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * 原生写接口专用 multipart 构造。
 * 与 toMultipart 的差别：**保留空字符串**——后端约定「可空文本字段传空串=清空，省略=保留原值」，
 * toMultipart 会把 '' 过滤掉导致「清空备注」永远发不出去。这里只过滤 undefined/null。
 */
export function nativeMultipart(data: Record<string, unknown>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
      form.append(key, JSON.stringify(value))
    } else {
      form.append(key, String(value))
    }
  }
  return form
}

/** 把明细行数组序列化为单个 Text 字段的 JSON 数组字符串（原生写接口强制格式）。 */
export function nativeItems(rows: Array<Record<string, unknown>>): string {
  return JSON.stringify(rows.map((r) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(r)) {
      if (v === undefined) continue
      out[k] = v
    }
    return out
  }))
}

/** 从批量/单笔写响应里取主单新版本（批量在 results[0].version，单笔在顶层 version）。 */
export function primaryVersion(data: NativeWriteResult | NativeBatchResult | undefined | null): number | undefined {
  if (!data) return undefined
  const batch = data as NativeBatchResult
  if (Array.isArray(batch.results) && batch.results.length > 0 && typeof batch.results[0].version === 'number') {
    return batch.results[0].version
  }
  const single = data as NativeWriteResult
  return typeof single.version === 'number' ? single.version : undefined
}

/** 是否为成功幂等重放（不再次改变库存或额度，前端不重复提示成功）。 */
export function isReplayed(data: { replayed?: boolean } | null | undefined): boolean {
  return data?.replayed === true
}

/** 从写响应中提取逐单结果数组；单笔接口（无 batch 标记）包装为单元素数组。 */
export function batchRows(data: NativeWriteResult | NativeBatchResult | null | undefined): Array<Record<string, unknown>> {
  if (!data) return []
  const batch = data as NativeBatchResult
  if (Array.isArray(batch.results)) return batch.results as Array<Record<string, unknown>>
  return [data as unknown as Record<string, unknown>]
}

// ---------- 读接口 ----------

export interface NativeListQuery {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface NativeSearchQuery extends NativeListQuery {
  date_start?: string
  date_end?: string
  audit_status?: 0 | 1 | 2 | 3
  warehouse_status?: 0 | 1 | 3
  business_status?: 'NORMAL' | 'EXCEPTION' | 'VOID'
}

/** 组合搜索条件（search 端点必填对）：fields 与 values 的键必须一一对应。 */
export interface NativeSearchCondition {
  fields: string[]
  values: Record<string, string | number | { start_time?: string; end_time?: string }>
}

/** 组合搜索字段/值对序列化为 query 参数（GET query；日期区间在对象内用 start_time/end_time）。 */
export function nativeSearchParams(q: NativeSearchQuery & { condition?: NativeSearchCondition }): Record<string, unknown> {
  const params: Record<string, unknown> = {
    page: q.page ?? 1,
    page_size: q.page_size ?? 20,
  }
  if (q.sort_by) params.sort_by = q.sort_by
  if (q.sort_order) params.sort_order = q.sort_order
  if (q.date_start) params.date_start = q.date_start
  if (q.date_end) params.date_end = q.date_end
  if (q.audit_status !== undefined) params.audit_status = q.audit_status
  if (q.warehouse_status !== undefined) params.warehouse_status = q.warehouse_status
  if (q.business_status) params.business_status = q.business_status
  if (q.condition) {
    params.search_field = JSON.stringify(q.condition.fields)
    params.search_value = JSON.stringify(q.condition.values)
  }
  return params
}

export function listNativeBills(docKey: NativeDocKey, query: NativeListQuery, config?: RequestConfig): Promise<ApiResponse<NativeListResult>> {
  return get<NativeListResult>(`/api/v1/tenant-production-native/${docKey}/list`, {
    page: query.page ?? 1,
    page_size: query.page_size ?? 20,
    ...(query.sort_by ? { sort_by: query.sort_by } : {}),
    ...(query.sort_order ? { sort_order: query.sort_order } : {}),
  }, config)
}

export function searchNativeBills(docKey: NativeDocKey, query: NativeSearchQuery & { condition: NativeSearchCondition }, config?: RequestConfig): Promise<ApiResponse<NativeListResult>> {
  return get<NativeListResult>(`/api/v1/tenant-production-native/${docKey}/search`, nativeSearchParams(query), config)
}

export function getNativeBillDetail(docKey: NativeDocKey, billId: string, config?: RequestConfig): Promise<ApiResponse<NativeDetailResult>> {
  return get<NativeDetailResult>(`/api/v1/tenant-production-native/${docKey}/detail`, { bill_id: billId }, config)
}

export function listNativeItems(docKey: NativeDocKey, query: NativeListQuery, config?: RequestConfig): Promise<ApiResponse<NativeItemsResult>> {
  return get<NativeItemsResult>(`/api/v1/tenant-production-native/${docKey}/items/list`, {
    page: query.page ?? 1,
    page_size: query.page_size ?? 20,
    // 明细筛选使用独立 search 端点的组合条件。
    ...(query.sort_by ? { sort_by: query.sort_by } : {}),
    ...(query.sort_order ? { sort_order: query.sort_order } : {}),
  }, config)
}

export function searchNativeItems(docKey: NativeDocKey, query: NativeListQuery & { condition: NativeSearchCondition }, config?: RequestConfig): Promise<ApiResponse<NativeItemsResult>> {
  const params: Record<string, unknown> = {
    page: query.page ?? 1,
    page_size: query.page_size ?? 20,
    search_field: JSON.stringify(query.condition.fields),
    search_value: JSON.stringify(query.condition.values),
  }
  if (query.sort_by) params.sort_by = query.sort_by
  if (query.sort_order) params.sort_order = query.sort_order
  return get<NativeItemsResult>(`/api/v1/tenant-production-native/${docKey}/items/search`, params, config)
}

export interface NativeOperationQuery {
  page?: number
  page_size?: number
  bill_id: string
  item_id?: string
  request_id?: string
  action?: string
}

export interface NativeOperationRow {
  log_id: string
  operation_id: string
  request_id: string
  seq: number
  record_role: string
  doc_key: string
  bill_id: string
  item_id: string | null
  action: string
  allocated_qty?: string
  available_stock_delta?: string
  warehouse_stock_delta?: string
  position_stock_delta?: string
  operator_id: string
  operator_name: string
  created_at: string
  [key: string]: unknown
}

export function listNativeOperations(docKey: NativeDocKey, query: NativeOperationQuery, config?: RequestConfig): Promise<ApiResponse<{ total: number; page: number; page_size: number; items: NativeOperationRow[] }>> {
  return get(`/api/v1/tenant-production-native/${docKey}/operations/list`, {
    page: query.page ?? 1,
    page_size: query.page_size ?? 20,
    bill_id: query.bill_id,
    ...(query.item_id ? { item_id: query.item_id } : {}),
    ...(query.request_id ? { request_id: query.request_id } : {}),
    ...(query.action ? { action: query.action } : {}),
  } as Record<string, unknown>, config)
}

// ---------- 冲减（退料专属） ----------

export interface DeductionPreviewRow {
  client_line_id: string
  source_picking_item_id: string
  return_qty: string
  can_submit: boolean
  blocked_reason: string | null
  blocked_reason_message?: string | null
  available_physical_return_qty?: string
  from_issued_qty?: string
  deduct_pending_qty?: string
  source_remaining_after?: string
  max_return_qty?: string
  [key: string]: unknown
}

export interface DeductionPreviewResult {
  source_version: number
  can_submit: boolean
  items: DeductionPreviewRow[]
}

export function calculateDeduction(
  payload: { source_picking_id: string; items: Array<{ client_line_id: string; source_picking_item_id: string; return_qty: string }>; exclude_return_item_id?: string },
  config?: RequestConfig,
): Promise<ApiResponse<DeductionPreviewResult>> {
  return post(`/api/v1/tenant-production-native/production-return/calculate-deduction`, nativeMultipart({
    source_picking_id: payload.source_picking_id,
    items: payload.items,
    ...(payload.exclude_return_item_id ? { exclude_return_item_id: payload.exclude_return_item_id } : {}),
  }), config)
}

export interface DeductionRecordRow {
  deduction_id: string
  request_id: string
  return_id: string
  return_item_id: string
  source_picking_id: string
  source_picking_item_id: string
  action: 'APPLY' | 'REVERSE' | 'FINALIZE'
  qty: string
  reference_deduction_id?: string | null
  reason?: string | null
  operator_id: string
  operator_name: string
  created_at: string
  source_remaining_before?: string
  source_remaining_after?: string
  [key: string]: unknown
}

export function listDeductionRecords(
  query: { page?: number; page_size?: number; source_picking_id?: string; source_picking_item_id?: string; return_id?: string; return_item_id?: string; action?: string },
  config?: RequestConfig,
): Promise<ApiResponse<{ total: number; page: number; page_size: number; items: DeductionRecordRow[] }>> {
  return get(`/api/v1/tenant-production-native/production-return/deduction-records`, {
    page: query.page ?? 1,
    page_size: query.page_size ?? 20,
    ...(query.source_picking_id ? { source_picking_id: query.source_picking_id } : {}),
    ...(query.source_picking_item_id ? { source_picking_item_id: query.source_picking_item_id } : {}),
    ...(query.return_id ? { return_id: query.return_id } : {}),
    ...(query.return_item_id ? { return_item_id: query.return_item_id } : {}),
    ...(query.action ? { action: query.action } : {}),
  } as Record<string, unknown>, config)
}

// ---------- 写接口（单主单） ----------

export interface NativeCreatePayload {
  request_id: string
  bill_date: string
  remark?: string
  items: Array<Record<string, unknown>>
  /** 退料专属 */
  source_picking_id?: string
  expected_source_version?: number
}

// 已下线的退料原因即使来自旧草稿也不能透传（包括空串和 null）。
function nativeWriteItems(docKey: NativeDocKey, items: Array<Record<string, unknown>>) {
  if (docKey !== 'production-return') return items
  return items.map(item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'return_reason')))
}

export function createNativeBill(docKey: NativeDocKey, payload: NativeCreatePayload, config?: RequestConfig): Promise<ApiResponse<NativeWriteResult>> {
  const data: Record<string, unknown> = {
    request_id: payload.request_id,
    bill_date: payload.bill_date,
    items: nativeWriteItems(docKey, payload.items),
  }
  if (payload.remark !== undefined) data.remark = payload.remark
  if (docKey === 'production-return') {
    data.source_picking_id = payload.source_picking_id
    data.expected_source_version = payload.expected_source_version
  }
  return post(`/api/v1/tenant-production-native/${docKey}/create`, nativeMultipart(data), config)
}

export function updateNativeBillHeader(
  docKey: NativeDocKey,
  payload: { request_id: string; bill_id: string; expected_version: number; bill_date?: string; remark?: string },
  config?: RequestConfig,
): Promise<ApiResponse<NativeWriteResult>> {
  const data: Record<string, unknown> = {
    request_id: payload.request_id,
    bill_id: payload.bill_id,
    expected_version: payload.expected_version,
  }
  if (payload.bill_date !== undefined) data.bill_date = payload.bill_date
  if (payload.remark !== undefined) data.remark = payload.remark
  return post(`/api/v1/tenant-production-native/${docKey}/update`, nativeMultipart(data), config)
}

export function appendNativeItems(
  docKey: NativeDocKey,
  payload: { request_id: string; bill_id: string; expected_version: number; items: Array<Record<string, unknown>>; expected_source_version?: number },
  config?: RequestConfig,
): Promise<ApiResponse<NativeWriteResult>> {
  const data: Record<string, unknown> = {
    request_id: payload.request_id,
    bill_id: payload.bill_id,
    expected_version: payload.expected_version,
    items: nativeWriteItems(docKey, payload.items),
  }
  if (payload.expected_source_version !== undefined) data.expected_source_version = payload.expected_source_version
  return post(`/api/v1/tenant-production-native/${docKey}/items/create`, nativeMultipart(data), config)
}

export function updateNativeItems(
  docKey: NativeDocKey,
  payload: { request_id: string; bill_id: string; expected_version: number; items: Array<Record<string, unknown>>; expected_source_version?: number },
  config?: RequestConfig,
): Promise<ApiResponse<NativeWriteResult>> {
  const data: Record<string, unknown> = {
    request_id: payload.request_id,
    bill_id: payload.bill_id,
    expected_version: payload.expected_version,
    items: nativeWriteItems(docKey, payload.items),
  }
  if (payload.expected_source_version !== undefined) data.expected_source_version = payload.expected_source_version
  return post(`/api/v1/tenant-production-native/${docKey}/items/update`, nativeMultipart(data), config)
}

export function deleteNativeItems(
  docKey: NativeDocKey,
  payload: { request_id: string; bill_id: string; expected_version: number; items: Array<{ item_id: string; expected_item_version: number }>; expected_source_version?: number },
  config?: RequestConfig,
): Promise<ApiResponse<NativeBatchResult>> {
  const data: Record<string, unknown> = {
    request_id: payload.request_id,
    bill_id: payload.bill_id,
    expected_version: payload.expected_version,
    items: payload.items,
  }
  if (payload.expected_source_version !== undefined) data.expected_source_version = payload.expected_source_version
  return post(`/api/v1/tenant-production-native/${docKey}/items/delete`, nativeMultipart(data), config)
}

// ---------- 写接口（批量主单） ----------

export interface NativeDocTarget {
  bill_id: string
  expected_version: number
  expected_source_version?: number
}

export function auditNativeBills(
  docKey: NativeDocKey,
  payload: { request_id: string; items: NativeDocTarget[]; action: 'PASS' | 'REJECT' },
  config?: RequestConfig,
): Promise<ApiResponse<NativeBatchResult>> {
  return post(`/api/v1/tenant-production-native/${docKey}/audit`, nativeMultipart({
    request_id: payload.request_id,
    items: payload.items,
    action: payload.action,
  }), config)
}

export function unauditNativeBills(
  docKey: NativeDocKey,
  payload: { request_id: string; items: NativeDocTarget[] },
  config?: RequestConfig,
): Promise<ApiResponse<NativeBatchResult>> {
  return post(`/api/v1/tenant-production-native/${docKey}/unaudit`, nativeMultipart({
    request_id: payload.request_id,
    items: payload.items,
  }), config)
}

export function sendNativeBills(
  docKey: NativeDocKey,
  payload: { request_id: string; items: NativeDocTarget[] },
  config?: RequestConfig,
): Promise<ApiResponse<NativeBatchResult>> {
  return post(`/api/v1/tenant-production-native/${docKey}/warehouse/send`, nativeMultipart({
    request_id: payload.request_id,
    items: payload.items,
  }), config)
}

export function cancelSendNativeBills(
  docKey: NativeDocKey,
  payload: { request_id: string; items: NativeDocTarget[] },
  config?: RequestConfig,
): Promise<ApiResponse<NativeBatchResult>> {
  return post(`/api/v1/tenant-production-native/${docKey}/warehouse/cancel-send`, nativeMultipart({
    request_id: payload.request_id,
    items: payload.items,
  }), config)
}

export function deleteNativeBills(
  docKey: NativeDocKey,
  payload: { request_id: string; items: NativeDocTarget[] },
  config?: RequestConfig,
): Promise<ApiResponse<NativeBatchResult>> {
  return post(`/api/v1/tenant-production-native/${docKey}/delete`, nativeMultipart({
    request_id: payload.request_id,
    items: payload.items,
  }), config)
}
