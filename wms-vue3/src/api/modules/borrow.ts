/**
 * 模块：借出借入四单据（租客侧，天心 ERP 同步；2026-10-30 全新模块）
 * 源接口：nuomi_wms/docs/本日接口变更_20260915.md 2026-10-30 17:00:33 批次
 *        + docs/19_天心侧接口前端对接文档_生产与贸易.md「借出借入四单据」补充
 *
 * 说明：
 *   - 4 单据 × 6 端点 = 24 个 + 手动同步 4 + 重启 2 + 设置 2 + 失败记录 6 + 重导入 2
 *     + 模式查询 1 + 锁单 1 = 37 个接口；
 *   - docKey 与 URL 段**不同名**（borrow-in-order ↔ in-order），映射见 BORROW_DOC_META；
 *   - 详情用 wms_bill_id（前缀 **blh_**，贸易为 txh_）；
 *   - search 协议与贸易一致：search_field=JSON 数组、search_value=JSON 对象；
 *   - 失败记录落在同一张 trade_sync_reject 表，但 doc_key 为**裸值**（borrow-in-order，无前缀）；
 *   - 白名单逐字对照后端 app/services/borrow/borrow_query_fields.py（明细无 free_id/name_eng/location_no）。
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'
import { BORROW_DOC_TITLES, BORROW_DOC_META, borrowSearchFieldsOf } from '@/config/borrowDocConfig'

/** 4 类借出借入单据（菜单顺序 = 数组顺序） */
export const BORROW_DOCS = [
  { docKey: 'borrow-in-order', name: BORROW_DOC_TITLES['borrow-in-order'], shortName: 'BN' },
  { docKey: 'borrow-in-return', name: BORROW_DOC_TITLES['borrow-in-return'], shortName: 'BB' },
  { docKey: 'lend-out-order', name: BORROW_DOC_TITLES['lend-out-order'], shortName: 'LN' },
  { docKey: 'lend-out-return', name: BORROW_DOC_TITLES['lend-out-return'], shortName: 'LB' },
] as const

export type BorrowDocKey = (typeof BORROW_DOCS)[number]['docKey']
export type BorrowSyncSide = 'in' | 'out'

/** 借出借入模式（接口 GET /tenant-borrow/mode，identity 鉴权免权限登记） */
export interface BorrowModeResult {
  borrow_mode: 'TIANXIN' | 'NATIVE'
  borrow_module_enabled: boolean
  channel_code: string | null
  erp_sync_enabled: boolean
}

export function getBorrowMode(): Promise<ApiResponse<BorrowModeResult>> {
  return get<BorrowModeResult>('/api/v1/tenant-borrow/mode', undefined, { silent: true })
}

// ─────────────────────────────────────────────────────────────────────────────
// 排序/搜索白名单（逐字对照 borrow_query_fields.py）
// ─────────────────────────────────────────────────────────────────────────────

/** 表头通用白名单（四单据共用；与后端 HDR_COMMON 一致） */
const HDR_COMMON = [
  'erp_bill_no', 'erp_bill_date', 'erp_modify_date', 'synced_at',
  'bl_id', 'cus_no', 'sal_no', 'bil_type', 'dep', 'dep_name',
  'usr', 'cls_id', 'cls_date', 'est_dd', 'pay_dd', 'cus_os_no',
  'warehouse_status', 'erp_lock_status', 'total_qty',
] as const

/** 表头联表字段（借入族联供应商、借出族联客户；employee 两侧都有） */
const HDR_JOINED_IN = ['supplier_name', 'employee_name'] as const
const HDR_JOINED_OUT = ['customer_name', 'employee_name'] as const

const HEADER_SORT_BY_DOC: Record<string, readonly string[]> = {
  'borrow-in-order': [...HDR_COMMON, ...HDR_JOINED_IN],
  'borrow-in-return': [...HDR_COMMON, ...HDR_JOINED_IN, 'rep_bl_no'],
  'lend-out-order': [...HDR_COMMON, ...HDR_JOINED_OUT],
  'lend-out-return': [...HDR_COMMON, ...HDR_JOINED_OUT, 'rep_bl_no'],
}

/** 明细通用白名单（无 free_id / name_eng / location_no） */
const DTL_COMMON = [
  'erp_item_seq', 'erp_bill_no', 'prd_no', 'prd_name',
  'spc', 'prd_mark', 'wh', 'unit', 'qty', 'bat_no', 'rem',
  'source_os_no', 'source_item_seq',
] as const

/** 明细联表字段（产品档案 + 仓库编号/名称） */
const DTL_JOINED = ['product_name', 'warehouse_no', 'warehouse_name'] as const

/** 各单据差异列（明细级，与后端 DTL_SPECIFIC 一致） */
const ITEM_SORT_BY_DOC: Record<string, readonly string[]> = {
  'borrow-in-order': [...DTL_COMMON, ...DTL_JOINED, 'planned_in_stock_qty', 'in_stock_qty', 'actual_in_stock_qty', 'warehouse_task_status', 'pending_out_qty', 'out_qty', 'erp_qty_rtn'],
  'borrow-in-return': [...DTL_COMMON, ...DTL_JOINED, 'return_qty', 'planned_return_qty', 'deducted_receipt_qty', 'confirmed_release_qty', 'converted_receipt_qty', 'actual_return_qty'],
  'lend-out-order': [...DTL_COMMON, ...DTL_JOINED, 'pending_out_qty', 'actual_out_qty', 'pending_return_qty', 'returned_qty', 'warehouse_task_status', 'erp_qty_rtn'],
  'lend-out-return': [...DTL_COMMON, ...DTL_JOINED, 'planned_return_qty', 'in_stock_qty', 'actual_in_stock_qty', 'deducted_out_qty', 'confirmed_release_qty'],
}

/** 黑名单（与后端一致；不可排序/搜索/出现在列配置） */
const FIELD_BLACKLIST = new Set([
  'company_id', 'deleted_flag', 'erp_deleted_flag', 'raw_json', 'content_hash',
  'wms_bill_id', 'wms_item_id',
  'created_at', 'updated_at', 'created_by', 'created_by_name', 'updated_by', 'updated_by_name',
])

export function getBorrowHeaderSortFields(docKey: string): string[] {
  return Array.from(new Set(HEADER_SORT_BY_DOC[docKey] || [])).filter((f) => !FIELD_BLACKLIST.has(f))
}

/**
 * 表头**筛选区**字段 = 排序白名单 − 隐藏清单（族级 BORROW_SEARCH_HIDDEN_FIELDS +
 * 单据级 BORROW_SEARCH_HIDDEN_BY_DOC，理由见 config/borrowDocConfig.ts 注释；
 * 后端另放明细字段走 EXISTS 通道，本 UI 不下发明细字段）。
 *
 * ⚠️ 边界：**只影响筛选区**，不动 HEADER_SORT_BY_DOC —— 数量合计等表格列仍可点表头排序。
 */
export function getBorrowHeaderSearchFields(docKey: string): string[] {
  return borrowSearchFieldsOf(docKey, getBorrowHeaderSortFields(docKey))
}

export function getBorrowItemSortFields(docKey: string): string[] {
  return Array.from(new Set(ITEM_SORT_BY_DOC[docKey] || [])).filter((f) => !FIELD_BLACKLIST.has(f))
}

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义（与贸易同构；表头无 ps_id）
// ─────────────────────────────────────────────────────────────────────────────

export interface BorrowBillRow {
  wms_bill_id: string
  erp_bill_no: string
  erp_bill_date: string | null
  erp_modify_date?: string | null
  synced_at?: string | null
  bl_id?: string | null
  cus_no?: string | null
  supplier_id?: string | null
  supplier_name?: string | null
  customer_id?: string | null
  customer_name?: string | null
  employee_id?: string | null
  employee_name?: string | null
  bil_type?: string | null
  dep?: string | null
  dep_name?: string | null
  cls_id?: string | null
  est_dd?: string | null
  pay_dd?: string | null
  rep_bl_no?: string | null
  warehouse_status?: string | null
  erp_lock_status?: string | null
  total_qty?: string | null
  [key: string]: unknown
}

export interface BorrowBillListResult {
  total: number
  page: number
  page_size: number
  records: BorrowBillRow[]
}

export interface BorrowItemRow {
  wms_item_id: string
  wms_bill_id: string
  erp_bill_no: string
  erp_item_seq: string
  prd_no: string | null
  prd_name: string | null
  product_name: string | null
  [key: string]: unknown
}

export interface BorrowItemsResult {
  total: number
  page: number
  page_size: number
  items: BorrowItemRow[]
}

export interface BorrowBillDetailResult {
  header: Record<string, unknown>
  items: BorrowItemRow[]
}

export interface BorrowBillQuery {
  page?: number
  page_size?: number
  date_from?: string
  date_to?: string
  sort_by?: string
  sort_order?: 'ASC' | 'DESC'
}

/** 手动同步结果（契约与贸易 sync/refresh 完全同构） */
export interface BorrowSyncRefreshResult {
  mode: 'WINDOW' | 'BILL_NOS'
  status?: string
  rejected?: { bill_no: string; reasons: string[] }[]
  stats?: { created: number; updated: number; skipped: number; rejected: number }
  synced_bills?: { bill_no: string; action: string }[]
  skipped_bills?: { bill_no: string; reason?: string }[]
  failed_bills?: { bill_no: string; reasons: string[] }[]
}

/** 重启结果（doc_lines 为**裸 doc_key**：borrow-in-order / borrow-in-return） */
export interface BorrowSyncRestartResult {
  mode: 'RESTART'
  side: BorrowSyncSide
  start_time: string
  doc_lines: string[]
  order_line_dispatched: boolean
}

export interface BorrowSyncRejectRow {
  reject_id: string
  doc_key: string
  doc_key_name: string
  erp_bill_no: string
  reasons: string
  trigger_type: string
  round_id: number | null
  created_at: string
  [key: string]: unknown
}

export interface BorrowSyncRejectListResult {
  total: number
  page: number
  page_size: number
  records: BorrowSyncRejectRow[]
}

export interface BorrowSyncRejectDetailResult extends Omit<BorrowSyncRejectRow, 'reasons'> {
  reasons: string[]
}

export interface BorrowSyncRejectQuery {
  page?: number
  page_size?: number
  date_from?: string
  date_to?: string
  sort_by?: 'created_at' | 'erp_bill_no' | 'doc_key'
  sort_order?: 'ASC' | 'DESC'
}

export interface BorrowSyncRejectRetryItem {
  erp_bill_no: string
  doc_key: string
  doc_key_name: string
  action: 'created' | 'updated' | 'skipped' | 'rejected' | 'failed'
  reasons?: string[]
}

export interface BorrowSyncRejectRetryResult {
  side: BorrowSyncSide
  retried_total: number
  results?: BorrowSyncRejectRetryItem[]
  remaining_rejects?: number
}

export interface BorrowSyncSettingsResult {
  sync_interval_seconds: number
  interval_bounds: { min: number; max: number }
}

export interface BorrowBillLockResult {
  doc_key: string
  doc_name: string
  wms_bill_id: string
  erp_bill_no: string
  erp_lock_status: number
  pushed: boolean
}

/** docKey → URL 段（in-order 等） */
export function borrowSegmentOf(docKey: string): string {
  return BORROW_DOC_META[docKey]?.segment || docKey
}

/** docKey → 所属侧（in|out） */
export function borrowSideOfDocKey(docKey: string): BorrowSyncSide {
  return BORROW_DOC_META[docKey]?.side || 'in'
}

/** 失败记录的 doc_key 为裸值（无前缀） */
export function rejectDocKeyOfBorrowDocKey(docKey: string): string {
  return docKey
}

// ─────────────────────────────────────────────────────────────────────────────
// 端点函数
// ─────────────────────────────────────────────────────────────────────────────

export function listBorrowBills(docKey: string, params: BorrowBillQuery): Promise<ApiResponse<BorrowBillListResult>> {
  return get<BorrowBillListResult>(`/api/v1/tenant-borrow/${borrowSegmentOf(docKey)}/list`, params as Record<string, unknown>)
}

export function searchBorrowBills(
  docKey: string,
  fields: string[],
  values: Record<string, string>,
  params: Omit<BorrowBillQuery, 'sort_by' | 'date_from' | 'date_to'> & { sort_by?: string } = {},
): Promise<ApiResponse<BorrowBillListResult>> {
  return get<BorrowBillListResult>(`/api/v1/tenant-borrow/${borrowSegmentOf(docKey)}/search`, {
    search_field: JSON.stringify(fields),
    search_value: JSON.stringify(values),
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

/** 单据详情：表头全字段 + 全部明细。用 wms_bill_id（blh_ 前缀） */
export function getBorrowBillDetail(docKey: string, wmsBillId: string): Promise<ApiResponse<BorrowBillDetailResult>> {
  return get<BorrowBillDetailResult>(`/api/v1/tenant-borrow/${borrowSegmentOf(docKey)}/detail`, { wms_bill_id: wmsBillId })
}

export function listBorrowItems(docKey: string, params: BorrowBillQuery = {}): Promise<ApiResponse<BorrowItemsResult>> {
  return get<BorrowItemsResult>(`/api/v1/tenant-borrow/${borrowSegmentOf(docKey)}/items/list`, {
    page: params.page ?? 1,
    page_size: params.page_size ?? 100,
    date_from: params.date_from,
    date_to: params.date_to,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

export function searchBorrowItems(
  docKey: string,
  fields: string[],
  values: Record<string, string>,
  params: Omit<BorrowBillQuery, 'sort_by' | 'date_from' | 'date_to'> & { sort_by?: string } = {},
): Promise<ApiResponse<BorrowItemsResult>> {
  return get<BorrowItemsResult>(`/api/v1/tenant-borrow/${borrowSegmentOf(docKey)}/items/search`, {
    search_field: JSON.stringify(fields),
    search_value: JSON.stringify(values),
    page: params.page ?? 1,
    page_size: params.page_size ?? 100,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

/**
 * 手动同步 / 按单号补录。
 * ⚠️ Form(list[str]) 只认「重复字段」（bill_nos=A&bill_nos=B），与贸易同约束。
 */
export function refreshBorrowBills(docKey: string, billNos?: string[]): Promise<ApiResponse<BorrowSyncRefreshResult>> {
  const params = new URLSearchParams()
  if (billNos && billNos.length > 0) {
    for (const no of billNos) {
      if (String(no || '').trim()) params.append('bill_nos', String(no).trim())
    }
  }
  return post<BorrowSyncRefreshResult>(
    `/api/v1/tenant-borrow/${borrowSegmentOf(docKey)}/sync/refresh`,
    params,
    { silent: true },
  )
}

/** 重启自动同步（in 侧管借入+借入还出，out 侧管借出+借出还入） */
export function restartBorrowSync(side: BorrowSyncSide, startTime: string): Promise<ApiResponse<BorrowSyncRestartResult>> {
  const params = new URLSearchParams()
  params.append('start_time', startTime)
  return post<BorrowSyncRestartResult>(`/api/v1/tenant-borrow/${side}/sync/restart`, params, { silent: true })
}

// ── 同步设置（仅间隔，无窗口项）──
export function getBorrowSyncSettings(): Promise<ApiResponse<BorrowSyncSettingsResult>> {
  return get<BorrowSyncSettingsResult>('/api/v1/tenant-borrow/sync/settings')
}

export function updateBorrowSyncSettings(payload: { sync_interval_seconds: number }): Promise<ApiResponse<{ sync_interval_seconds: number }>> {
  const params = new URLSearchParams()
  params.append('sync_interval_seconds', String(payload.sync_interval_seconds))
  return post<{ sync_interval_seconds: number }>('/api/v1/tenant-borrow/sync/settings/update', params)
}

// ── 失败记录（严格分侧 in/out）──
export function listBorrowSyncRejects(side: BorrowSyncSide, params: BorrowSyncRejectQuery = {}): Promise<ApiResponse<BorrowSyncRejectListResult>> {
  return get<BorrowSyncRejectListResult>(`/api/v1/tenant-borrow/${side}/sync-rejects/list`, {
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    date_from: params.date_from,
    date_to: params.date_to,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

export function searchBorrowSyncRejects(
  side: BorrowSyncSide,
  fields: string[],
  values: Record<string, string>,
  params: Omit<BorrowSyncRejectQuery, 'sort_by'> & { sort_by?: string } = {},
): Promise<ApiResponse<BorrowSyncRejectListResult>> {
  return get<BorrowSyncRejectListResult>(`/api/v1/tenant-borrow/${side}/sync-rejects/search`, {
    search_field: JSON.stringify(fields),
    search_value: JSON.stringify(values),
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    date_from: params.date_from,
    date_to: params.date_to,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

export function getBorrowSyncRejectDetail(side: BorrowSyncSide, rejectId: string): Promise<ApiResponse<BorrowSyncRejectDetailResult>> {
  return get<BorrowSyncRejectDetailResult>(`/api/v1/tenant-borrow/${side}/sync-rejects/detail`, { reject_id: rejectId })
}

export function retryBorrowSyncRejects(side: BorrowSyncSide, erpBillNos?: string[]): Promise<ApiResponse<BorrowSyncRejectRetryResult>> {
  const params = new URLSearchParams()
  if (erpBillNos && erpBillNos.length > 0) {
    for (const no of erpBillNos) {
      if (String(no || '').trim()) params.append('erp_bill_nos', String(no).trim())
    }
  }
  return post<BorrowSyncRejectRetryResult>(`/api/v1/tenant-borrow/${side}/sync-rejects/retry`, params, { silent: true })
}

/**
 * 单据手动上锁/解锁（镜像生产 bill-lock）。
 * ⚠️ JSON body（非 Form），与生产 /tenant-production/bill-lock/update 同构。
 * 幂等：目标状态与现状相同 → 后端不推 ERP、不改库，直接返回提示（pushed=false）。
 */
export function updateBorrowBillLock(payload: {
  doc_key: string
  wms_bill_id: string
  lock_status: 0 | 1
}): Promise<ApiResponse<BorrowBillLockResult>> {
  return post<BorrowBillLockResult>('/api/v1/tenant-borrow/bill-lock/update', payload, { silent: true })
}
