/**
 * 模块：生产管理（租客侧）
 * 源接口：nuomi_wms/docs/17_WMS前端接入生产管理接口操作文档.md
 * 说明：13 类单据 × 6 个泛型端点 + 概览 + 同步设置；
 *      {doc_key} 只能取 PRODUCTION_DOCS 中的值；明细删除为 form-urlencoded。
 *      后端为只读展示 + 明细软删除 + 同步设置自助，无新建/编辑单据接口。
 */
import { get, post, toFormData } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 13 类单据（菜单顺序 = 数组顺序；概览接口不含中文名，名称/顺序一律以此为准） */
export const PRODUCTION_DOCS = [
  { docKey: 'finished-goods-stockin', name: '成品缴库单' },
  { docKey: 'production-picking', name: '生产领料单' },
  { docKey: 'production-return', name: '生产退料单' },
  { docKey: 'production-supplement', name: '生产补料单' },
  { docKey: 'non-production-picking', name: '非生产领料单' },
  { docKey: 'non-production-return', name: '非生产退料单' },
  { docKey: 'outsourcing-picking', name: '托工领料单' },
  { docKey: 'outsourcing-return', name: '托工退料单' },
  { docKey: 'outsourcing-supplement', name: '托工补料单' },
  { docKey: 'outsourcing-receipt', name: '托外加工缴回单' },
  { docKey: 'material-cutting', name: '物料切割单' },
  { docKey: 'outsourcing-chargeback', name: '托工退回单' },
  { docKey: 'sales-return', name: '销售退回单' },
] as const

export type ProductionDocKey = (typeof PRODUCTION_DOCS)[number]['docKey']

/** docKey → 中文名（概览/菜单/面包屑取名称用） */
export const PRODUCTION_DOC_NAME: Record<string, string> = Object.fromEntries(
  PRODUCTION_DOCS.map((d) => [d.docKey, d.name]),
)

/** 列表/搜索公共行字段（映射区字段逐单据不同，用索引签名承载） */
export interface ProductionBillRow {
  wms_bill_id: string
  erp_bill_no: string
  erp_bill_date: string | null
  synced_at: string | null
  item_count: number
  total_qty: string | null
  [key: string]: unknown
}

export interface ProductionBillListResult {
  total: number
  page: number
  page_size: number
  bills: ProductionBillRow[]
}

export interface ProductionItemProduct {
  product_id: string
  product_code: string
  product_name: string
  category_id: string | null
  specification: string | null
  unit_id: string | null
}

export interface ProductionItemRow {
  wms_item_id: string
  wms_bill_id: string
  erp_bill_no: string
  erp_item_seq: string
  product_id: string | null
  synced_at: string | null
  erp_deleted: number
  product: ProductionItemProduct | null
  [key: string]: unknown
}

export interface ProductionItemsResult {
  total: number
  page: number
  page_size: number
  items: ProductionItemRow[]
}

export interface ProductionBillDetailResult {
  bill: Record<string, unknown>
  items: ProductionItemRow[]
  item_total: number
}

/** 列表排序白名单（传其他值后端静默回落 erp_bill_date） */
export type ProductionSortField = 'erp_bill_date' | 'erp_bill_no' | 'erp_modify_date' | 'synced_at'

export interface ProductionBillQuery {
  page?: number
  page_size?: number
  date_start?: string
  date_end?: string
  sort_by?: ProductionSortField
  sort_order?: 'ASC' | 'DESC'
}

// ---------- 单据列表 / 表头搜索 ----------

/** 单据列表分页（接口 4.1） */
export function listProductionBills(docKey: string, params: ProductionBillQuery): Promise<ApiResponse<ProductionBillListResult>> {
  return get<ProductionBillListResult>(`/api/v1/tenant-production/${docKey}/list`, params as Record<string, unknown>)
}

/** 表头模糊搜索（接口 4.2）。注意：不搜 ERP 单号，placeholder 需写清搜索范围 */
export function searchProductionBills(docKey: string, keyword: string, page = 1, pageSize = 20): Promise<ApiResponse<ProductionBillListResult>> {
  return get<ProductionBillListResult>(`/api/v1/tenant-production/${docKey}/search`, { keyword, page, page_size: pageSize })
}

// ---------- 详情 / 明细 ----------

/** 单据详情（接口 4.3）：表头全字段 + 全部明细 */
export function getProductionBillDetail(docKey: string, billId: string, includeDeleted = false): Promise<ApiResponse<ProductionBillDetailResult>> {
  return get<ProductionBillDetailResult>(`/api/v1/tenant-production/${docKey}/detail`, {
    bill_id: billId,
    include_deleted: includeDeleted ? 1 : 0,
  })
}

/** 明细分页（接口 4.4）：大单据场景 */
export function listProductionItems(docKey: string, billId: string, page = 1, pageSize = 20): Promise<ApiResponse<ProductionItemsResult>> {
  return get<ProductionItemsResult>(`/api/v1/tenant-production/${docKey}/items/list`, { bill_id: billId, page, page_size: pageSize })
}

/** 明细模糊搜索（接口 4.5）：传 billId=单内搜索；不传=跨单搜索 */
export function searchProductionItems(docKey: string, keyword: string, options?: { billId?: string; page?: number; pageSize?: number }): Promise<ApiResponse<ProductionItemsResult>> {
  return get<ProductionItemsResult>(`/api/v1/tenant-production/${docKey}/items/search`, {
    keyword,
    bill_id: options?.billId,
    page: options?.page ?? 1,
    page_size: options?.pageSize ?? 20,
  })
}

/** 明细批量软删除结果（接口 4.6）：全部失败时后端返回 success=false，结果仍放在 data 中 */
export interface ProductionItemsDeleteResult {
  succeeded: number
  succeeded_ids: string[]
  failed: { wms_item_id: string; reason: string }[]
}

/** 明细批量软删除（接口 4.6）：form-urlencoded，wms_item_ids 为 JSON 数组字符串。
 *  silent：全部失败时后端返回 success=false，页面需要读 data.failed 展示具体失败单号与原因，
 *  故关掉全局 toast 由调用方统一处理（否则只能看到笼统的「未软删除任何明细」） */
export function deleteProductionItems(docKey: string, wmsItemIds: string[]): Promise<ApiResponse<ProductionItemsDeleteResult>> {
  return post(
    `/api/v1/tenant-production/${docKey}/items/delete`,
    toFormData({ wms_item_ids: JSON.stringify(wmsItemIds) }),
    { silent: true },
  )
}

// ---------- 概览 / 同步设置 ----------

export interface ProductionOverviewDoc {
  doc_key: string
  last_success_at: string | null
  last_error: string | null
  last_error_at: string | null
  phase: 'BACKFILL' | 'INCREMENTAL' | 'RECONCILE'
  backfill_done: number
  round_id: number
  slice_done: number
  slice_total: number
  unbound_prd_count: number
  synced_recently: boolean
}

export interface ProductionOverviewResult {
  enabled: boolean
  channel_code: string
  channel_name: string
  sync_interval_seconds: number
  sync_window_days: number
  docs: ProductionOverviewDoc[]
}

/** 模块概览（接口 4.7） */
export function getProductionOverview(): Promise<ApiResponse<ProductionOverviewResult>> {
  return get<ProductionOverviewResult>('/api/v1/tenant-production/overview')
}

export interface ProductionSyncSettingsResult {
  sync_interval_seconds: number
  sync_window_days: number
  interval_bounds: { min: number; max: number }
  window_bounds: { min: number; max: number }
}

/** 查看同步设置（接口 4.8） */
export function getProductionSyncSettings(): Promise<ApiResponse<ProductionSyncSettingsResult>> {
  return get<ProductionSyncSettingsResult>('/api/v1/tenant-production/sync/settings')
}

/** 修改同步设置（接口 4.8）：两项至少传其一；上下限以 GET 返回的 bounds 校验 */
export function updateProductionSyncSettings(payload: { sync_interval_seconds?: number; sync_window_days?: number }): Promise<ApiResponse<{ sync_interval_seconds: number; sync_window_days: number }>> {
  return post('/api/v1/tenant-production/sync/settings/update', toFormData(payload as Record<string, unknown>))
}
