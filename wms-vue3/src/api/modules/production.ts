/**
 * 模块：生产管理（租客侧）
 * 源接口：nuomi_wms/docs/17_WMS前端接入生产管理接口操作文档.md
 * 说明：13 类单据 × 6 个泛型端点 + 概览 + 同步设置；
 *      {doc_key} 只能取 PRODUCTION_DOCS 中的值；明细删除为 form-urlencoded。
 *      后端为只读展示 + 明细软删除 + 同步设置自助，无新建/编辑单据接口。
 */
import { get, post, toFormData } from '@/utils/request'
import type { ApiResponse, RequestConfig } from '@/utils/request'

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
  /** ERP 锁单状态快照：1=已锁定（ERP 内不可操作）0=未锁定 */
  erp_lock_status?: number
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

/** 详情实时刷新结果（接口 4.3 erp_refresh）：后端返回详情前会先按单张直查（GETDATA）
 *  同步 ERP 最新数据；LOCAL_MISSING 仅后端内部使用（此时接口直接 404），不会出现在响应里 */
export interface ProductionErpRefresh {
  status: 'SYNCED' | 'UNCHANGED' | 'ERP_DELETED' | 'TIMEOUT' | 'ERROR' | 'SKIPPED'
  message: string | null
}

export interface ProductionBillDetailResult {
  bill: Record<string, unknown>
  items: ProductionItemRow[]
  item_total: number
  erp_refresh?: ProductionErpRefresh | null
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

/** 表头模糊搜索（接口 4.2）：匹配 ERP 单号 + 映射区字段（部门/经办人/备注等） */
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

// ---------- 单据箱贴标签打印 ----------

/**
 * 单据箱贴标签 PDF 下载（天心分支）。
 * 后端按参考图版式生成：一张有效明细一页 100×70mm 标签
 * （顶部单号条码 + 品名/品号/颜色/数量/单位/长度/规格 + 底部品号条码），
 * 长度仅领料/退料/补料类单据有（天心 PRD_MARK 栏位），颜色取产品档案。
 * 注意：打印实现为天心渠道专用，其他渠道后端会返回业务失败提示。
 */
export function printProductionBillPdf(docKey: string, billId: string): Promise<Blob> {
  return get<Blob>(
    `/api/v1/tenant-production/${docKey}/print/pdf`,
    { bill_id: billId },
    { responseType: 'blob', silent: true },
  ) as unknown as Promise<Blob>
}

/**
 * 多张单据（同 doc_key）批量箱贴标签 PDF 下载（天心分支）：
 * 各单据标签连续输出到同一份 PDF（后端去重保序，单次上限 50 张单据，
 * 任一单据无效整体报错并指明单据ID）。
 */
export function printProductionBillsPdf(docKey: string, billIds: string[]): Promise<Blob> {
  return get<Blob>(
    `/api/v1/tenant-production/${docKey}/print/pdf`,
    { bill_ids: billIds.join(',') },
    { responseType: 'blob', silent: true },
  ) as unknown as Promise<Blob>
}

/** 单据箱贴 TSPL 直打结果（天心分支）：每张有效明细一组芯烨 TSPL 指令 */
export interface ProductionBillTsplItem {
  /** 展示名（ERP单号-品号） */
  label: string
  tspl_commands: string[]
}

export interface ProductionBillTsplResult {
  items: ProductionBillTsplItem[]
  erp_bill_no: string
  item_count: number
  bill_count: number
  bill_nos: string[]
}

/**
 * 单据箱贴标签 TSPL 直打（天心分支）：与 PDF 下载同一套字段与版式（100×70mm），
 * 返回每张明细一组 TSPL 指令，前端经本机打印代理（xp.print）直打标签打印机。
 * density 为型号浓度设置（后端 SET DENSITY，默认 8）。
 */
export function printProductionBillTspl(
  docKey: string,
  billId: string,
  density?: number,
): Promise<ApiResponse<ProductionBillTsplResult>> {
  return get<ProductionBillTsplResult>(
    `/api/v1/tenant-production/${docKey}/print/tspl`,
    { bill_id: billId, ...(density ? { density } : {}) },
    { silent: true },
  )
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

// ---------- 单据锁单状态变更（天心 ERP 上锁/解锁，WMS 前端手动操作） ----------

/** 天心接口无单据别（识别代号 BIL_ID）的 2 类单据，后端不支持锁单/解锁，页面隐藏操作入口 */
export const PRODUCTION_LOCK_UNSUPPORTED_DOCS: ReadonlySet<string> = new Set([
  'outsourcing-receipt', // 托外加工缴回单
  'outsourcing-chargeback', // 托工退回单
])

/** 该单据类别是否支持锁单/解锁 */
export function isBillLockSupported(docKey: string): boolean {
  return !PRODUCTION_LOCK_UNSUPPORTED_DOCS.has(docKey)
}

export interface ProductionBillLockPayload {
  doc_key: string
  wms_bill_id: string
  /** 1=上锁（ERP 单据不可操作）0=解锁（恢复可操作） */
  lock_status: 0 | 1
}

/** 锁单变更结果：erp_lock_status 为请求结束时表头最终状态；pushed=false 表示
 *  幂等拦截（目标状态与原状态相同，未触达 ERP）——两种场景后端都返回
 *  success=false + message（「这个单据原本的状态就是解锁的/上锁的」），
 *  调用方按业务失败路径 catch 后展示 message 即可。 */
export interface ProductionBillLockResult {
  doc_key: string
  doc_name: string
  wms_bill_id: string
  erp_bill_no: string
  erp_lock_status: number
  pushed: boolean
}

/** 变更生产单据锁单状态：推送天心锁单指令（LOCK_STATUS=1/0）并回写本地状态。
 *  与现状相同 / ERP 调用失败时后端返回 success=false（HTTP 200），message 为可直接
 *  展示的中文原因——故 silent 由调用方统一 toast（同明细软删除的处理方式）。
 *  Content-Type 为 application/json。 */
export function updateProductionBillLockStatus(
  payload: ProductionBillLockPayload,
  config?: RequestConfig,
): Promise<ApiResponse<ProductionBillLockResult>> {
  return post<ProductionBillLockResult>(
    '/api/v1/tenant-production/bill-lock/update',
    payload,
    config,
  )
}

// ---------- 仓库作业状态批量变更 / 未绑定品号清单 ----------
// 源接口：nuomi_wms/docs/20_生产管理_批量作业状态变更与未同步品号查询接口指引.md/** 目标仓库作业状态：COMPLETED=已完成（未作业明细置完成并清零剩余量）/ PENDING=待作业（还原应作业余量） */
export type ProductionWmsTargetStatus = 'COMPLETED' | 'PENDING'

export interface ProductionWmsStatusBatchPayload {
  /** 单据类别，13 类之一；单次只能操作一个类别 */
  doc_key: string
  /** 单据日期起（闭区间），YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS */
  date_start: string
  /** 单据日期止（闭区间，纯日期时后端按当天 23:59:59 计算） */
  date_end: string
  target_status: ProductionWmsTargetStatus
}

/** 批量结果：affected_bills=表头状态变化张数；affected_items=实际变更明细数；skipped_items=因已作业/冲突跳过数 */
export interface ProductionWmsStatusBatchResult {
  affected_bills: number
  affected_items: number
  skipped_items: number
}

/** 批量变更生产单据作业状态（doc 20 §2）。
 *  按「单据类别 + ERP 单据日期闭区间」批量变更仓库作业状态；已作业（actual_qty>0）与
 *  ERP 漂移冲突（wms_drift_flag=1）明细由后端强制跳过，前端无需也不能干预。
 *  Content-Type 为 application/json（与同步设置的表单编码不同）。
 *  区间内无有效单据时仍返回成功，三项统计均为 0。
 *  ⚠️ 后端 doc_key **只接受 13 类之一**（未知 404），不支持"全部"；多类别需由调用方
 *  逐个调用后自行汇总，故此处开放 config（传 `{ silent: true }` 以免逐类弹错）。 */
export function batchUpdateProductionWmsStatus(
  payload: ProductionWmsStatusBatchPayload,
  config?: RequestConfig,
): Promise<ApiResponse<ProductionWmsStatusBatchResult>> {
  return post<ProductionWmsStatusBatchResult>(
    '/api/v1/tenant-production/wms-status/batch-update',
    payload,
    config,
  )
}

/** 单张仓库作业状态变更入参：wms_bill_id / erp_bill_no 二选一定位单据（前者优先） */
export interface ProductionWmsStatusUpdatePayload {
  doc_key: string
  wms_bill_id?: string
  erp_bill_no?: string
  target_status: ProductionWmsTargetStatus
}

/** 单张变更结果：warehouse_status 为请求结束时表头最终状态（1=待作业 3=已完成） */
export interface ProductionWmsStatusUpdateResult {
  doc_key: string
  doc_name: string
  wms_bill_id: string
  erp_bill_no: string
  warehouse_status: number
  affected_items: number
  skipped_items: number
}

/** 变更单张生产单据的仓库作业状态（详情页手动改为已完成/待作业）。
 *  明细处理与批量接口同一套规则：已作业与 ERP 漂移冲突明细后端强制跳过；
 *  单据已是目标状态时幂等返回（统计为 0）。失败走 HTTP 4xx（400 入参 / 404 单据
 *  不存在），调用方可传 `{ silent: true }` 后在 catch 中统一展示 message。 */
export function updateProductionBillWmsStatus(
  payload: ProductionWmsStatusUpdatePayload,
  config?: RequestConfig,
): Promise<ApiResponse<ProductionWmsStatusUpdateResult>> {
  return post<ProductionWmsStatusUpdateResult>(
    '/api/v1/tenant-production/wms-status/update',
    payload,
    config,
  )
}

/** 未绑定品号处理动作：MISSING=档案缺失（去产品管理补录）/ PENDING_REBIND=档案已有待回绑（联系平台 FULL 重扫） */
export type UnboundProductStatus = 'MISSING' | 'PENDING_REBIND'

export interface UnboundProductRow {
  prd_no: string
  prd_name: string | null
  status: UnboundProductStatus
  doc_keys: string[]
  doc_names: string[]
  /** 该品号跨多少张单据 */
  bill_count: number
  /** 该品号出现在多少条明细行 */
  item_count: number
  first_synced_at: string | null
  last_synced_at: string | null
}

/** 顶部统计卡（全量口径，受 keyword 过滤影响、不受分页影响） */
export interface UnboundProductsSummary {
  missing_count: number
  pending_rebind_count: number
  /** 未绑定明细总行数（品号去重前） */
  item_total: number
}

export interface UnboundProductsResult {
  /** 品号数（非明细行数），keyword 过滤后口径 */
  total: number
  page: number
  /** 实际生效页大小（订阅到期时后端静默压到 ≤10，渲染分页器须以此为准） */
  page_size: number
  summary: UnboundProductsSummary
  /** 已按 item_count 降序、prd_no 升序排列，不支持自定义排序 */
  items: UnboundProductRow[]
}

export interface UnboundProductsQuery {
  keyword?: string
  doc_key?: string
  page?: number
  page_size?: number
}

/** 未绑品号清单（doc 20 §3）：ERP 已同步但 WMS 无产品档案的品号，按品号聚合去重。
 *  注意 keyword 有 min_length=1 约束——空白串必须整个省略该参数，否则 422。 */
export function listUnboundProducts(query: UnboundProductsQuery = {}): Promise<ApiResponse<UnboundProductsResult>> {
  const params: Record<string, unknown> = {
    page: query.page ?? 1,
    page_size: query.page_size ?? 20,
  }
  const kw = query.keyword?.trim()
  if (kw) params.keyword = kw
  if (query.doc_key) params.doc_key = query.doc_key
  return get<UnboundProductsResult>('/api/v1/tenant-production/unbound-products', params)
}
