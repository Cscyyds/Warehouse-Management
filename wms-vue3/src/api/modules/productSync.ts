/**
 * 模块：天心产品资料（PRDT）自动同步（2026-10-30 全新，7 接口）
 * 源接口：nuomi_wms/docs/本日接口变更_20260915.md 2026-10-30 21:21:50 批次
 *        + app/api/v1/endpoints/tenant_product_sync.py（响应字段权威口径）
 *
 * 端到端：
 *   POST /tenant-products/sync/refresh                     手动同步（全量快照 / 按品号补录）
 *   GET  /tenant-products/sync-failures/{list|search|detail}  失败记录三件套
 *   GET  /tenant-products/tianxin-imports/{list|search|detail} 导入清单三件套
 *
 * 约定：
 *   - 仅「天心贸易形态 + ERP 同步总开关开」的租户可用（403 双保险，文案由拦截器透出）；
 *   - 失败记录**无重试按钮**：修复后下一轮自动恢复（默认 1 小时），或用 refresh 即时触发；
 *   - list/search 不返回 raw_json（大字段分页纪律），仅 detail 返回。
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

// ─────────────────────────────────────────────────────────────────────────────
// 手动同步
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductSyncFailureItem {
  prd_no: string
  reasons: string[]
}

export interface ProductSyncStats {
  created: number
  updated: number
  skipped: number
  failed: number
  status_flipped: number
}

/** 全量/窗口模式结果 */
export interface ProductSyncWindowResult {
  mode: 'WINDOW'
  status?: string
  failed: ProductSyncFailureItem[]
  missing_marked: number
  stats: ProductSyncStats
}

/** 按品号补录结果 */
export interface ProductSyncBillNosResult {
  mode: 'BILL_NOS'
  synced: { prd_no: string; action: string }[]
  skipped: { prd_no: string; reason?: string }[]
  failed: ProductSyncFailureItem[]
  rejected: ProductSyncFailureItem[]
}

export type ProductSyncRefreshResult = ProductSyncWindowResult | ProductSyncBillNosResult

/**
 * 手动同步天心产品资料。
 * - 不传 itemNos = 全量快照同步（WINDOW）；
 * - 传 itemNos = 逐品号直查补录（≤50，后端保序去重）。
 * ⚠️ Form(list[str]) 只认「重复字段」（item_nos=A&item_nos=B），与贸易补录同约束。
 * 409：已有同步任务进行中（单飞拦截）→ 页面提示稍后查看。
 */
export function refreshProductSync(itemNos?: string[]): Promise<ApiResponse<ProductSyncRefreshResult>> {
  const params = new URLSearchParams()
  if (itemNos && itemNos.length > 0) {
    for (const no of itemNos) {
      if (String(no || '').trim()) params.append('item_nos', String(no).trim())
    }
  }
  return post<ProductSyncRefreshResult>('/api/v1/tenant-products/sync/refresh', params, { silent: true })
}

// ─────────────────────────────────────────────────────────────────────────────
// 失败记录（last_sync_status='FAILED' 即待处理；修复成功后自动移出清单）
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductSyncFailureRow {
  sync_id: string
  prd_no: string
  product_id: string | null
  last_action: string | null
  /** list/search 已解析为数组 */
  fail_reasons: string[]
  last_failed_at: string | null
  first_synced_at: string | null
  last_synced_at: string | null
}

export interface ProductSyncFailureListResult {
  total: number
  page: number
  page_size: number
  records: ProductSyncFailureRow[]
}

export interface ProductSnapshot {
  product_id: string
  product_code: string
  product_name: string
  product_status: string
  deleted_flag: number
}

export interface ProductSyncFailureDetailResult extends ProductSyncFailureRow {
  /** 最近失败轮 PRDT 原始报文整份（可能为 null） */
  raw_json: Record<string, unknown> | null
  /** 关联产品当前快照（可能为 null：产品未建/已删） */
  product_snapshot: ProductSnapshot | null
  erp_modify_date: string | null
  /** 未挂中类等提示（可 null） */
  hint: string | null
}

export interface ProductSyncListQuery {
  page?: number
  page_size?: number
  date_from?: string
  date_to?: string
  sort_by?: string
  sort_order?: 'ASC' | 'DESC'
}

/** 失败记录排序白名单（后端 _FAILURE_SORT_FIELDS） */
export const PRODUCT_SYNC_FAILURE_SORT_FIELDS = ['prd_no', 'last_action', 'last_failed_at', 'last_synced_at'] as const
/** 失败记录搜索白名单（prd_no 模糊 / last_action 等值） */
export const PRODUCT_SYNC_FAILURE_SEARCH_FIELDS = ['prd_no', 'last_action'] as const

export function listProductSyncFailures(params: ProductSyncListQuery = {}): Promise<ApiResponse<ProductSyncFailureListResult>> {
  return get<ProductSyncFailureListResult>('/api/v1/tenant-products/sync-failures/list', {
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    date_from: params.date_from,
    date_to: params.date_to,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

export function searchProductSyncFailures(
  fields: string[],
  values: Record<string, string>,
  params: ProductSyncListQuery = {},
): Promise<ApiResponse<ProductSyncFailureListResult>> {
  return get<ProductSyncFailureListResult>('/api/v1/tenant-products/sync-failures/search', {
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

/** 失败记录详情：入参 prd_no（来自列表）；已恢复成功会 404 */
export function getProductSyncFailureDetail(prdNo: string): Promise<ApiResponse<ProductSyncFailureDetailResult>> {
  return get<ProductSyncFailureDetailResult>('/api/v1/tenant-products/sync-failures/detail', { prd_no: prdNo })
}

// ─────────────────────────────────────────────────────────────────────────────
// 导入产品清单（含「待翻转状态」观察清单 pending_only）
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductImportRow {
  sync_id: string
  prd_no: string
  product_id: string | null
  last_action: string | null
  last_sync_status: string | null
  /** 非空 = 待翻转（D3 两段式观察：首轮只登记，次轮自动翻转 DISCONTINUED） */
  pending_status: string | null
  fail_reasons: string[] | null
  first_synced_at: string | null
  last_synced_at: string | null
  last_failed_at: string | null
  product_code: string | null
  product_name: string | null
  specification: string | null
  product_status: string | null
  product_deleted: number | null
}

export interface ProductImportListResult {
  total: number
  page: number
  page_size: number
  records: ProductImportRow[]
}

/** 单字段映射对照（match=false 时前端高亮差异） */
export interface ProductMappingCompareItem {
  erp_value?: string | null
  local_value?: string | null
  erp_idx1?: string | null
  local_category?: { name?: string | null; external_code?: string | null } | null
  match: boolean
}

export interface ProductMappingCompare {
  name?: ProductMappingCompareItem
  specification?: ProductMappingCompareItem
  unit?: ProductMappingCompareItem
  category?: ProductMappingCompareItem
}

export interface ProductImportDetailResult {
  prd_no: string
  product_id: string | null
  last_action: string | null
  last_sync_status: string | null
  fail_reasons: string[] | null
  pending_status: string | null
  erp_modify_date: string | null
  first_synced_at: string | null
  last_synced_at: string | null
  last_failed_at: string | null
  raw_json: Record<string, unknown> | null
  mapping_compare: ProductMappingCompare | null
  product_snapshot: ProductSnapshot | null
}

export interface ProductImportQuery extends ProductSyncListQuery {
  /** 最近动作过滤：created/updated/skipped/failed/missing */
  last_action?: string
  /** 仅看待翻转状态清单 */
  pending_only?: boolean
}

/** 导入清单排序白名单（后端 _apply_import_sort 支持产品侧列） */
export const PRODUCT_IMPORT_SORT_FIELDS = ['prd_no', 'last_action', 'last_synced_at', 'first_synced_at', 'pending_status', 'product_name', 'product_code'] as const
/** 导入清单搜索白名单（前三个模糊 / last_action 等值） */
export const PRODUCT_IMPORT_SEARCH_FIELDS = ['prd_no', 'product_name', 'product_code', 'last_action'] as const
/** 最近动作候选 */
export const PRODUCT_IMPORT_ACTION_OPTIONS = [
  { value: 'created', label: '新建' },
  { value: 'updated', label: '更新' },
  { value: 'skipped', label: '未变化' },
  { value: 'failed', label: '失败' },
  { value: 'missing', label: 'ERP 已消失' },
] as const

export function listProductImports(params: ProductImportQuery = {}): Promise<ApiResponse<ProductImportListResult>> {
  return get<ProductImportListResult>('/api/v1/tenant-products/tianxin-imports/list', {
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    date_from: params.date_from,
    date_to: params.date_to,
    last_action: params.last_action,
    pending_only: params.pending_only ? true : undefined,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

export function searchProductImports(
  fields: string[],
  values: Record<string, string>,
  params: ProductImportQuery = {},
): Promise<ApiResponse<ProductImportListResult>> {
  return get<ProductImportListResult>('/api/v1/tenant-products/tianxin-imports/search', {
    search_field: JSON.stringify(fields),
    search_value: JSON.stringify(values),
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    date_from: params.date_from,
    date_to: params.date_to,
    pending_only: params.pending_only ? true : undefined,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

/** 导入产品详情：原始报文 + 映射对照 + 同步履历 */
export function getProductImportDetail(prdNo: string): Promise<ApiResponse<ProductImportDetailResult>> {
  return get<ProductImportDetailResult>('/api/v1/tenant-products/tianxin-imports/detail', { prd_no: prdNo })
}
