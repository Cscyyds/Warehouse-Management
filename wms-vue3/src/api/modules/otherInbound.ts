/**
 * 模块：其他入库单 XC（租客侧，天心 ERP 同步；2026-11-18 全新模块）
 * 源接口：nuomi_wms/app/api/v1/endpoints/tenant_other_inbound_management.py（S1-01 ~ S1-15）
 *
 * 说明：
 *   - 单单据单管线：docKey 恒 'other-inbound'，side 恒 'all'，URL **无单据段/侧段**
 *     （/tenant-other-inbound/list，而非 /tenant-other-inbound/other-inbound/list）；
 *   - 与贸易/借出借入的协议差异在本文件归一化收敛，组件只消费公共形状：
 *     list/search/items 行数组键为 `list`（非 records/items）；
 *     表头 bill_no/bill_date/send_at → erp_bill_no/erp_bill_date/warehouse_send_at；
 *     明细 other_inbound_id/product_code/product_name → wms_bill_id/prd_no/prd_name
 *     （product_name 原键保留：XC 查询侧不做产品档案联表，详情页「产品档案」列
 *      走 product_name 回退，与借出 items/search 分支同口径）；
 *     refresh rejected_bills → rejected（BILL_NOS 的 rejected 是**计数**不是数组，
 *     必须覆盖；ERP已删计数只在 message 里，deleted_bills 不下发给组件）；
 *     restart doc_line（单数）→ doc_lines；retry details[].status → results[].action；
 *   - 详情用 wms_bill_id（前缀 **oih_**）；失败记录复用贸易拒绝表（ID 前缀 txr_，
 *     doc_key 为裸值 other-inbound），响应已是 records 键，**无需归一化**；
 *   - 白名单逐字对照后端 app/services/other_inbound/other_inbound_query_fields.py
 *     （排序非法字段后端回退 created_at 不 400；搜索非法字段 400）。
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export type OtherInboundSyncSide = 'all'

/** 其他入库模式（接口 GET /tenant-other-inbound/mode，identity 鉴权免权限登记） */
export interface OtherInboundModeResult {
  module_code: string | null
  channel_code: string | null
  erp_sync_enabled: number | null
  mode: 'TIANXIN' | 'DISABLED'
}

export function getOtherInboundMode(): Promise<ApiResponse<OtherInboundModeResult>> {
  return get<OtherInboundModeResult>('/api/v1/tenant-other-inbound/mode', undefined, { silent: true })
}

// ─────────────────────────────────────────────────────────────────────────────
// 排序/搜索白名单（逐字对照 other_inbound_query_fields.py）
// ─────────────────────────────────────────────────────────────────────────────

/** 表头排序白名单（R28 独立定义；created_at 不在黑名单——它是排序默认字段） */
const HDR_SORT_FIELDS = ['created_at', 'warehouse_send_at', 'erp_bill_date'] as const

/** 表头搜索白名单（S1-08：表头本列 + 明细 EXISTS 通道，API 字段名） */
const HDR_SEARCH_FIELDS = ['bill_no', 'rem', 'dep', 'usr', 'chk_man', 'prd_no', 'prd_name', 'spc', 'wh'] as const

/** 明细搜索白名单（S1-11：明细本列 + 表头单号 bill_no） */
const DTL_SEARCH_FIELDS = ['prd_no', 'prd_name', 'spc', 'wh', 'erp_item_seq', 'bat_no', 'bill_no'] as const

/** 黑名单（与后端一致；不可排序/搜索） */
const FIELD_BLACKLIST = new Set([
  'company_id', 'deleted_flag', 'erp_deleted_flag', 'raw_json', 'content_hash',
  'wms_bill_id', 'wms_item_id', 'updated_at', 'created_by', 'created_by_name',
  'updated_by', 'updated_by_name',
])

export function getOtherInboundHeaderSortFields(): string[] {
  return HDR_SORT_FIELDS.filter((f) => !FIELD_BLACKLIST.has(f))
}

export function getOtherInboundHeaderSearchFields(): string[] {
  return HDR_SEARCH_FIELDS.filter((f) => !FIELD_BLACKLIST.has(f))
}

/** 明细搜索下拉字段（详情页明细表无排序下拉，此白名单只喂搜索区） */
export function getOtherInboundItemSortFields(): string[] {
  return DTL_SEARCH_FIELDS.filter((f) => !FIELD_BLACKLIST.has(f))
}

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义（归一化后的公共形状；原始键经索引签名保留）
// ─────────────────────────────────────────────────────────────────────────────

export interface OtherInboundBillRow {
  wms_bill_id: string
  erp_bill_no: string
  erp_bill_date?: string | null
  erp_modify_date?: string | null
  synced_at?: string | null
  warehouse_send_at?: string | null
  ij_id?: string | null
  ij_reason?: string | null
  ij_reason_text?: string | null
  dep?: string | null
  dep_name?: string | null
  usr?: string | null
  employee_id?: string | null
  employee_name?: string | null
  chk_man?: string | null
  rem?: string | null
  bil_type?: string | null
  /** 后端输出 int（贸易/借出为字符串枚举键，公共行类型已放宽 string|number） */
  warehouse_status?: number | null
  erp_lock_status?: number | null
  wms_archive_flag?: 0 | 1
  total_qty?: string | null
  item_count?: number
  [key: string]: unknown
}

export interface OtherInboundBillListResult {
  total: number
  page: number
  page_size: number
  records: OtherInboundBillRow[]
}

export interface OtherInboundItemRow {
  wms_item_id: string
  wms_bill_id: string
  erp_bill_no: string
  erp_item_seq: string
  prd_no: string | null
  prd_name: string | null
  product_name: string | null
  [key: string]: unknown
}

export interface OtherInboundItemsResult {
  total: number
  page: number
  page_size: number
  items: OtherInboundItemRow[]
}

export interface OtherInboundBillDetailResult {
  header: Record<string, unknown>
  items: OtherInboundItemRow[]
  /** 打开详情先 ERP 实时核验的结果（降级不阻断，组件暂不消费） */
  erp_refresh?: unknown
}

export interface OtherInboundBillQuery {
  page?: number
  page_size?: number
  date_from?: string
  date_to?: string
  sort_by?: string
  sort_order?: 'ASC' | 'DESC'
  /** 归档筛选（仅 list 端点支持；0=正常单 1=历史归档单，缺省后端不过滤） */
  archived?: 0 | 1
}

/** 手动同步结果（归一化后与贸易/借出 sync/refresh 契约同构） */
export interface OtherInboundSyncRefreshResult {
  mode: 'WINDOW' | 'BILL_NOS'
  status?: string
  rejected?: { bill_no: string; reasons: string[] }[]
  stats?: { created: number; updated: number; skipped: number; rejected: number }
  synced_bills?: { bill_no: string; action: string }[]
  skipped_bills?: { bill_no: string; reason?: string }[]
  failed_bills?: { bill_no: string; reasons: string[] }[]
}

/** 重启结果（归一化后；doc_line 单数 → doc_lines，dispatched → order_line_dispatched） */
export interface OtherInboundSyncRestartResult {
  mode: 'RESTART'
  side: OtherInboundSyncSide
  start_time: string
  doc_lines: string[]
  order_line_dispatched: boolean
}

export interface OtherInboundSyncRejectRow {
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

export interface OtherInboundSyncRejectListResult {
  total: number
  page: number
  page_size: number
  records: OtherInboundSyncRejectRow[]
}

export interface OtherInboundSyncRejectDetailResult extends Omit<OtherInboundSyncRejectRow, 'reasons'> {
  reasons: string[]
}

export interface OtherInboundSyncRejectQuery {
  page?: number
  page_size?: number
  date_from?: string
  date_to?: string
  sort_by?: 'created_at' | 'erp_bill_no' | 'doc_key'
  sort_order?: 'ASC' | 'DESC'
}

export interface OtherInboundSyncRejectRetryItem {
  erp_bill_no: string
  doc_key: string
  doc_key_name: string
  action: 'created' | 'updated' | 'skipped' | 'rejected' | 'failed'
  reasons?: string[]
}

export interface OtherInboundSyncRejectRetryResult {
  side: OtherInboundSyncSide
  retried_total: number
  results?: OtherInboundSyncRejectRetryItem[]
  remaining_rejects?: number
}

/** 同步设置与运行态势（S1-03：formal_start_at 租户只读，null=未设置/归档关闭） */
export interface OtherInboundSyncSettingsResult {
  sync_interval_seconds: number
  interval_bounds: { min: number; max: number }
  phase: string
  watermark_start: string | null
  watermark_end: string | null
  last_success_at: string | null
  consecutive_failures: number
  formal_start_at: string | null
}

export interface OtherInboundBillLockResult {
  doc_key: string
  doc_name: string
  wms_bill_id: string
  erp_bill_no: string
  erp_lock_status: number
  pushed: boolean
}

/** 失败记录的 doc_key 为裸值（无前缀，复用贸易拒绝表） */
export function rejectDocKeyOfOtherInboundDocKey(docKey: string): string {
  return docKey
}

// ─────────────────────────────────────────────────────────────────────────────
// 归一化（XC 原始协议 → 组件公共形状；原始键全部保留）
// ─────────────────────────────────────────────────────────────────────────────

type RawRecord = Record<string, unknown>

function normalizeHeader(row: RawRecord): OtherInboundBillRow {
  return {
    ...row,
    wms_bill_id: String(row.wms_bill_id ?? ''),
    erp_bill_no: String(row.bill_no ?? ''),
    erp_bill_date: (row.bill_date as string | null) ?? null,
    warehouse_send_at: (row.send_at as string | null) ?? null,
  }
}

function normalizeItem(row: RawRecord): OtherInboundItemRow {
  return {
    ...row,
    wms_item_id: String(row.wms_item_id ?? ''),
    wms_bill_id: String(row.other_inbound_id ?? ''),
    erp_bill_no: String(row.bill_no ?? ''),
    erp_item_seq: String(row.erp_item_seq ?? ''),
    prd_no: (row.product_code as string | null) ?? null,
    prd_name: (row.product_name as string | null) ?? null,
    product_name: (row.product_name as string | null) ?? null,
  }
}

function rawRows(data: unknown): RawRecord[] {
  const raw = (data ?? {}) as RawRecord
  return Array.isArray(raw.list) ? (raw.list as RawRecord[]) : []
}

function normalizeListResult(data: unknown): OtherInboundBillListResult {
  const raw = (data ?? {}) as RawRecord
  return {
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? 1),
    page_size: Number(raw.page_size ?? 20),
    records: rawRows(data).map(normalizeHeader),
  }
}

function normalizeItemsResult(data: unknown): OtherInboundItemsResult {
  const raw = (data ?? {}) as RawRecord
  return {
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? 1),
    page_size: Number(raw.page_size ?? 20),
    items: rawRows(data).map(normalizeItem),
  }
}

function normalizeDetailResult(data: unknown): OtherInboundBillDetailResult {
  const raw = (data ?? {}) as RawRecord
  const items = Array.isArray(raw.items) ? (raw.items as RawRecord[]) : []
  return {
    ...raw,
    header: normalizeHeader((raw.header ?? {}) as RawRecord),
    items: items.map(normalizeItem),
  }
}

function normalizeRefreshResult(data: unknown): OtherInboundSyncRefreshResult {
  const raw = (data ?? {}) as RawRecord
  const out: RawRecord = { ...raw }
  // BILL_NOS 的 rejected 是计数、WINDOW 的 rejected 是扁平统计——一律以 rejected_bills 数组覆盖
  out.rejected = Array.isArray(raw.rejected_bills) ? raw.rejected_bills : []
  delete out.rejected_bills
  // ERP已删计数已并入 message（「ERP已删 D」），公共形状无 deleted_bills 通道
  delete out.deleted_bills
  if (raw.mode === 'WINDOW') {
    out.stats = {
      created: Number(raw.created ?? 0),
      updated: Number(raw.updated ?? 0),
      skipped: Number(raw.skipped ?? 0),
      rejected: Number(raw.rejected ?? 0),
    }
  }
  // BILL_NOS 不造 stats：组件走 message 原文透传，保留「ERP已删」计数
  return out as unknown as OtherInboundSyncRefreshResult
}

function normalizeRestartResult(data: unknown): OtherInboundSyncRestartResult {
  const raw = (data ?? {}) as RawRecord
  const line = raw.doc_line
  return {
    mode: 'RESTART',
    side: 'all',
    start_time: String(raw.start_time ?? ''),
    doc_lines: line ? [String(line)] : [],
    order_line_dispatched: Boolean(raw.dispatched),
  }
}

function normalizeRetryResult(data: unknown): OtherInboundSyncRejectRetryResult {
  const raw = (data ?? {}) as RawRecord
  const details = Array.isArray(raw.details) ? (raw.details as RawRecord[]) : []
  return {
    side: 'all',
    retried_total: Number(raw.retried ?? 0),
    results: details.map((item) => ({
      erp_bill_no: String(item.erp_bill_no ?? ''),
      doc_key: String(item.doc_key ?? ''),
      doc_key_name: String(item.doc_key_name ?? ''),
      action: String(item.status ?? '') === 'succeeded' ? 'updated' : 'rejected',
      reasons: item.error ? [String(item.error)] : undefined,
    })),
    remaining_rejects: Number(raw.remaining_rejects ?? 0),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 端点函数（15 个；URL 无单据段/侧段）
// ─────────────────────────────────────────────────────────────────────────────

export async function listOtherInboundBills(params: OtherInboundBillQuery): Promise<ApiResponse<OtherInboundBillListResult>> {
  const res = await get<unknown>('/api/v1/tenant-other-inbound/list', params as Record<string, unknown>)
  return { ...res, data: normalizeListResult(res.data) }
}

export async function searchOtherInboundBills(
  fields: string[],
  values: Record<string, string>,
  params: Omit<OtherInboundBillQuery, 'sort_by' | 'date_from' | 'date_to' | 'archived'> & { sort_by?: string } = {},
): Promise<ApiResponse<OtherInboundBillListResult>> {
  const res = await get<unknown>('/api/v1/tenant-other-inbound/search', {
    search_field: JSON.stringify(fields),
    search_value: JSON.stringify(values),
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
  return { ...res, data: normalizeListResult(res.data) }
}

/** 单据详情：表头全字段 + 全部明细（含长度字段组）。用 wms_bill_id（oih_ 前缀） */
export async function getOtherInboundBillDetail(wmsBillId: string): Promise<ApiResponse<OtherInboundBillDetailResult>> {
  const res = await get<unknown>('/api/v1/tenant-other-inbound/detail', { wms_bill_id: wmsBillId })
  return { ...res, data: normalizeDetailResult(res.data) }
}

export async function listOtherInboundItems(params: OtherInboundBillQuery = {}): Promise<ApiResponse<OtherInboundItemsResult>> {
  const res = await get<unknown>('/api/v1/tenant-other-inbound/items/list', {
    page: params.page ?? 1,
    page_size: params.page_size ?? 100,
    date_from: params.date_from,
    date_to: params.date_to,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
  return { ...res, data: normalizeItemsResult(res.data) }
}

export async function searchOtherInboundItems(
  fields: string[],
  values: Record<string, string>,
  params: Omit<OtherInboundBillQuery, 'sort_by' | 'date_from' | 'date_to' | 'archived'> & { sort_by?: string } = {},
): Promise<ApiResponse<OtherInboundItemsResult>> {
  const res = await get<unknown>('/api/v1/tenant-other-inbound/items/search', {
    search_field: JSON.stringify(fields),
    search_value: JSON.stringify(values),
    page: params.page ?? 1,
    page_size: params.page_size ?? 100,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
  return { ...res, data: normalizeItemsResult(res.data) }
}

/**
 * 手动同步 / 按单号补录。
 * ⚠️ Form(list[str]) 只认「重复字段」（bill_nos=A&bill_nos=B），与贸易/借出同约束。
 */
export async function refreshOtherInboundBills(billNos?: string[]): Promise<ApiResponse<OtherInboundSyncRefreshResult>> {
  const params = new URLSearchParams()
  if (billNos && billNos.length > 0) {
    for (const no of billNos) {
      if (String(no || '').trim()) params.append('bill_nos', String(no).trim())
    }
  }
  const res = await post<unknown>('/api/v1/tenant-other-inbound/sync/refresh', params, { silent: true })
  return { ...res, data: normalizeRefreshResult(res.data) }
}

/** 重启自动同步（单管线无侧段；起始时间不得晚于当前、不得早于一年前） */
export async function restartOtherInboundSync(startTime: string): Promise<ApiResponse<OtherInboundSyncRestartResult>> {
  const params = new URLSearchParams()
  params.append('start_time', startTime)
  const res = await post<unknown>('/api/v1/tenant-other-inbound/sync/restart', params, { silent: true })
  return { ...res, data: normalizeRestartResult(res.data) }
}

// ── 同步设置（仅间隔可调；formal_start_at 租户只读，绝不回传）──
export function getOtherInboundSyncSettings(): Promise<ApiResponse<OtherInboundSyncSettingsResult>> {
  return get<OtherInboundSyncSettingsResult>('/api/v1/tenant-other-inbound/sync/settings')
}

export function updateOtherInboundSyncSettings(payload: { sync_interval_seconds: number }): Promise<ApiResponse<{ sync_interval_seconds: number }>> {
  const params = new URLSearchParams()
  params.append('sync_interval_seconds', String(payload.sync_interval_seconds))
  return post<{ sync_interval_seconds: number }>('/api/v1/tenant-other-inbound/sync/settings/update', params)
}

// ── 失败记录（单管线 side 恒 'all'，URL 无侧段；响应已是 records 键，无需归一化）──
export function listOtherInboundSyncRejects(params: OtherInboundSyncRejectQuery = {}): Promise<ApiResponse<OtherInboundSyncRejectListResult>> {
  return get<OtherInboundSyncRejectListResult>('/api/v1/tenant-other-inbound/sync-rejects/list', {
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    date_from: params.date_from,
    date_to: params.date_to,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

export function searchOtherInboundSyncRejects(
  fields: string[],
  values: Record<string, string>,
  params: Omit<OtherInboundSyncRejectQuery, 'sort_by'> & { sort_by?: string } = {},
): Promise<ApiResponse<OtherInboundSyncRejectListResult>> {
  return get<OtherInboundSyncRejectListResult>('/api/v1/tenant-other-inbound/sync-rejects/search', {
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

export function getOtherInboundSyncRejectDetail(rejectId: string): Promise<ApiResponse<OtherInboundSyncRejectDetailResult>> {
  return get<OtherInboundSyncRejectDetailResult>('/api/v1/tenant-other-inbound/sync-rejects/detail', { reject_id: rejectId })
}

export async function retryOtherInboundSyncRejects(erpBillNos?: string[]): Promise<ApiResponse<OtherInboundSyncRejectRetryResult>> {
  const params = new URLSearchParams()
  if (erpBillNos && erpBillNos.length > 0) {
    for (const no of erpBillNos) {
      if (String(no || '').trim()) params.append('erp_bill_nos', String(no).trim())
    }
  }
  const res = await post<unknown>('/api/v1/tenant-other-inbound/sync-rejects/retry', params, { silent: true })
  return { ...res, data: normalizeRetryResult(res.data) }
}

/**
 * 单据手动上锁/解锁（镜像借出/生产 bill-lock）。
 * ⚠️ JSON body（非 Form）。幂等：目标状态与现状相同 → 后端不推 ERP、不改库（pushed=false）。
 */
export function updateOtherInboundBillLock(payload: {
  doc_key: string
  wms_bill_id: string
  lock_status: 0 | 1
}): Promise<ApiResponse<OtherInboundBillLockResult>> {
  return post<OtherInboundBillLockResult>('/api/v1/tenant-other-inbound/bill-lock/update', payload, { silent: true })
}