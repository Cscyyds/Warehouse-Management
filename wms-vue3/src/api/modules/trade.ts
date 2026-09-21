/**
 * 模块：贸易数据（租客侧，天心 ERP 同步）
 * 源接口：nuomi_wms/docs/19_天心侧接口前端对接文档_生产与贸易.md §2.2
 *
 * 说明：
 *   - 4 单据 × 6 端点 = 24 个 + 1 个 mode 查询 = 25 个接口；
 *   - {doc} 只能取 TRADE_DOCS 中的值；
 *   - 贸易族为只读 + 手动同步（sync/refresh），无新建/编辑/软删除；
 *   - 详情用 wms_bill_id（txh_ 前缀），不再使用 ERP 单号（2026-09-15 后批次已切换）；
 *   - search 协议：search_field 为字段名 JSON 数组字符串，search_value 为字段→值 JSON 对象字符串；
 *   - 排序/搜索字段必须落在白名单内，黑名单字段不可排/搜（见 doc 2.2.2）。
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 4 类贸易单据（菜单顺序 = 数组顺序）。
 *  permView/permManage 仅作注释性归档（后端两个聚合权限码）；
 *  端点→权限码的权威登记在 config/permissionUrlMap.ts，页面级绑定在 config/pagePermissionMap.ts。 */
export const TRADE_DOCS = [
  { docKey: 'purchase-order', name: '进货单', shortName: 'PC', permView: 'perm_trade_view', permManage: 'perm_trade_manage' },
  { docKey: 'purchase-return', name: '进货退回单', shortName: 'PB', permView: 'perm_trade_view', permManage: 'perm_trade_manage' },
  { docKey: 'sales-order', name: '销货单', shortName: 'SA', permView: 'perm_trade_view', permManage: 'perm_trade_manage' },
  { docKey: 'sales-return', name: '销货退回单', shortName: 'SB', permView: 'perm_trade_view', permManage: 'perm_trade_manage' },
] as const

export type TradeDocKey = (typeof TRADE_DOCS)[number]['docKey']

/** docKey → 中文名（菜单/面包屑/详情标题取名称用） */
export const TRADE_DOC_NAME: Record<string, string> = Object.fromEntries(
  TRADE_DOCS.map((d) => [d.docKey, d.name]),
)

// ─────────────────────────────────────────────────────────────────────────────
// 模式查询（接口 2.2.1）
// ─────────────────────────────────────────────────────────────────────────────

export interface TradeModeResult {
  /**
   * 后端判定的贸易模式（前端分流唯一依据，不要用下方三个字段自行拼判据）。
   * 判据：PURCHASE_SALES.enabled==0 且 FINANCE.enabled==0 且 PS.channel_code=='TIANXIN'。
   */
  purchase_sales_mode: 'TIANXIN' | 'NATIVE'
  /** 财务模块是否启用（天心接管时 enabled=0 → false） */
  finance_module_enabled: boolean
  /** 采购/销售模块是否启用（天心接管时 enabled=0 → false） */
  purchase_sales_module_enabled: boolean
  /** 对接的外部系统渠道编码（天心为 'TIANXIN'；纯本系统为 null） */
  channel_code: string | null
}

/**
 * 查询本租户贸易模式（接口 2.2.1）。
 * 鉴权：仅身份（任何登录租客员工可调，不依赖权限注册）。
 * silent=true：登录后一次性拉取，失败不弹全局 toast，由 tradeMode store 兜底。
 */
export function getTradeMode(): Promise<ApiResponse<TradeModeResult>> {
  return get<TradeModeResult>('/api/v1/tenant-trade/mode', undefined, { silent: true })
}

// ─────────────────────────────────────────────────────────────────────────────
// 排序/搜索白名单与黑名单（doc 2.2.2 / 2.2.5）
// ─────────────────────────────────────────────────────────────────────────────

/** 表头通用排序白名单（4 单据共用） */
const HEADER_SORT_COMMON = [
  'erp_bill_no', 'erp_bill_date', 'erp_modify_date', 'synced_at',
  'ps_id', 'cus_no', 'sal_no', 'rem', 'bil_type',
  'dep', 'dep_name', 'usr', 'cls_date', 'lz_cls_id',
  'warehouse_status', 'total_qty',
] as const

/** 各单据专属表头排序字段（doc 2.2.2） */
const HEADER_SORT_BY_DOC: Record<TradeDocKey, readonly string[]> = {
  'purchase-order': [...HEADER_SORT_COMMON, 'supplier_name', 'employee_name', 'source_os_no'],
  'purchase-return': [...HEADER_SORT_COMMON, 'supplier_name', 'employee_name', 'source_os_no', 'apply_os_no'],
  'sales-order': [...HEADER_SORT_COMMON, 'customer_name', 'employee_name', 'transfer_os_no', 'ck_cls_id', 'cus_os_no'],
  'sales-return': [...HEADER_SORT_COMMON, 'customer_name', 'employee_name', 'transfer_os_no'],
}

/** 表头搜索 = 排序白名单 + 额外表头字段 + 明细字段（doc 2.2.3） */
const HEADER_SEARCH_EXTRA = ['source_os_no', 'transfer_os_no', 'apply_os_no', 'ck_cls_id', 'cus_os_no'] as const

/** 明细通用排序白名单（4 单据共用） */
const ITEM_SORT_COMMON = [
  'erp_item_seq', 'erp_bill_no', 'prd_no', 'prd_name', 'name_eng', 'spc', 'prd_mark',
  'wh', 'unit', 'qty', 'rem', 'bat_no', 'free_id',
  'source_os_no', 'source_item_seq',
  'product_name', 'location_no', 'location_name',
] as const

/** 各单据专属明细排序字段（doc 2.2.5） */
const ITEM_SORT_BY_DOC: Record<TradeDocKey, readonly string[]> = {
  'purchase-order': [...ITEM_SORT_COMMON, 'planned_in_stock_qty', 'in_stock_qty', 'actual_in_stock_qty', 'warehouse_task_status', 'pending_out_qty', 'out_qty'],
  'purchase-return': [...ITEM_SORT_COMMON, 'return_qty', 'planned_return_qty', 'deducted_receipt_qty', 'confirmed_release_qty', 'converted_receipt_qty', 'actual_return_qty'],
  'sales-order': [...ITEM_SORT_COMMON, 'ck_no', 'ship_status', 'pending_out_qty', 'actual_out_qty', 'pending_return_qty', 'returned_qty', 'warehouse_task_status'],
  'sales-return': [...ITEM_SORT_COMMON, 'so_os_no', 'planned_return_qty', 'in_stock_qty', 'actual_in_stock_qty', 'deducted_out_qty', 'confirmed_release_qty'],
}

/**
 * 黑名单字段（doc 2.2.2）：不可排序、不可搜索、不在列配置中出现。
 * 包含审计四列（created_at / updated_at / created_by / updated_by）。
 */
const FIELD_BLACKLIST = new Set([
  'company_id', 'deleted_flag', 'erp_deleted_flag', 'raw_json', 'content_hash',
  'wms_bill_id', 'wms_item_id',
  'created_at', 'updated_at', 'created_by', 'updated_by',
])

/** 判断字段是否落入黑名单（列配置/排序下拉生成时过滤） */
export function isBlacklistField(name: string): boolean {
  return FIELD_BLACKLIST.has(name)
}

/** 获取指定单据的表头排序白名单（已去重、已过滤黑名单） */
export function getHeaderSortFields(docKey: TradeDocKey): string[] {
  return Array.from(new Set(HEADER_SORT_BY_DOC[docKey])).filter((f) => !isBlacklistField(f))
}

/** 获取指定单据的表头可搜索字段（排序白名单 + 额外表头字段，已过滤黑名单） */
export function getHeaderSearchFields(docKey: TradeDocKey): string[] {
  const base = [...HEADER_SORT_BY_DOC[docKey], ...HEADER_SEARCH_EXTRA]
  return Array.from(new Set(base)).filter((f) => !isBlacklistField(f))
}

/** 获取指定单据的明细排序/搜索白名单（已去重、已过滤黑名单） */
export function getItemSortFields(docKey: TradeDocKey): string[] {
  return Array.from(new Set(ITEM_SORT_BY_DOC[docKey])).filter((f) => !isBlacklistField(f))
}

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

/** 列表/搜索公共行字段（enriched 字段用索引签名承载） */
export interface TradeBillRow {
  wms_bill_id: string
  erp_bill_no: string
  erp_bill_date: string | null
  erp_modify_date: string | null
  synced_at: string | null
  ps_id: string | null
  cus_no: string | null
  supplier_id: string | null
  supplier_name: string | null
  customer_id: string | null
  customer_name: string | null
  sal_no: string | null
  employee_id: string | null
  employee_name: string | null
  rem: string | null
  bil_type: string | null
  dep: string | null
  dep_name: string | null
  source_os_no: string | null
  transfer_os_no: string | null
  apply_os_no: string | null
  warehouse_status: string | null
  total_qty: string | null
  ck_cls_id: string | null
  lz_cls_id: string | null
  [key: string]: unknown
}

export interface TradeBillListResult {
  total: number
  page: number
  page_size: number
  records: TradeBillRow[]
}

/** 明细行（含联表 product_name / location_no / location_name） */
export interface TradeItemRow {
  wms_item_id: string
  wms_bill_id: string
  erp_bill_no: string
  erp_item_seq: string
  prd_no: string | null
  prd_name: string | null
  product_name: string | null
  location_no: string | null
  location_name: string | null
  [key: string]: unknown
}

export interface TradeItemsResult {
  total: number
  page: number
  page_size: number
  items: TradeItemRow[]
}

export interface TradeBillDetailResult {
  header: Record<string, unknown>
  items: TradeItemRow[]
}

/** 列表查询参数（接口 2.2.2） */
export interface TradeBillQuery {
  page?: number
  page_size?: number
  date_from?: string
  date_to?: string
  sort_by?: string
  sort_order?: 'ASC' | 'DESC'
}

/** 明细分页查询参数（接口 2.2.5，跨单） */
export interface TradeItemQuery {
  page?: number
  page_size?: number
  date_from?: string
  date_to?: string
  sort_by?: string
  sort_order?: 'ASC' | 'DESC'
}

/** 手动同步结果（接口 2.2.7） */
export interface TradeSyncRefreshResult {
  mode: 'WINDOW' | 'BILL_NOS'
  status?: string
  rejected?: { bill_no: string; reasons: string[] }[]
  stats?: { created: number; updated: number; skipped: number; rejected: number }
  synced_bills?: { bill_no: string; action: string }[]
  skipped_bills?: { bill_no: string; reason?: string }[]
  failed_bills?: { bill_no: string; reasons: string[] }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// 端点函数
// ─────────────────────────────────────────────────────────────────────────────

/** 单据列表分页（接口 2.2.2） */
export function listTradeBills(docKey: TradeDocKey, params: TradeBillQuery): Promise<ApiResponse<TradeBillListResult>> {
  return get<TradeBillListResult>(`/api/v1/tenant-trade/${docKey}/list`, params as Record<string, unknown>)
}

/**
 * 表头多字段搜索（接口 2.2.3）。
 * @param fields 字段名数组（如 ['erp_bill_no','customer_name']），需落在 getHeaderSearchFields 白名单内
 * @param values 字段→值对象（如 {erp_bill_no:'SA5812'}），多字段 AND 组合
 * 协议：search_field / search_value 均 JSON.stringify 后作为 query 参数传递。
 */
export function searchTradeBills(
  docKey: TradeDocKey,
  fields: string[],
  values: Record<string, string>,
  params: Omit<TradeBillQuery, 'sort_by' | 'date_from' | 'date_to'> & { sort_by?: string } = {},
): Promise<ApiResponse<TradeBillListResult>> {
  return get<TradeBillListResult>(`/api/v1/tenant-trade/${docKey}/search`, {
    search_field: JSON.stringify(fields),
    search_value: JSON.stringify(values),
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

/** 单据详情（接口 2.2.4）：表头全字段 + 全部明细。用 wms_bill_id（txh_ 前缀） */
export function getTradeBillDetail(docKey: TradeDocKey, wmsBillId: string): Promise<ApiResponse<TradeBillDetailResult>> {
  return get<TradeBillDetailResult>(`/api/v1/tenant-trade/${docKey}/detail`, { wms_bill_id: wmsBillId })
}

/** 明细分页（接口 2.2.5，跨单）：page_size 默认 100，上限 500 */
export function listTradeItems(docKey: TradeDocKey, params: TradeItemQuery = {}): Promise<ApiResponse<TradeItemsResult>> {
  return get<TradeItemsResult>(`/api/v1/tenant-trade/${docKey}/items/list`, {
    page: params.page ?? 1,
    page_size: params.page_size ?? 100,
    date_from: params.date_from,
    date_to: params.date_to,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

/**
 * 明细多字段搜索（接口 2.2.6）。
 * @param fields 字段名数组，需落在 getItemSortFields 白名单内
 * @param values 字段→值对象
 */
export function searchTradeItems(
  docKey: TradeDocKey,
  fields: string[],
  values: Record<string, string>,
  params: Omit<TradeItemQuery, 'sort_by' | 'date_from' | 'date_to'> & { sort_by?: string } = {},
): Promise<ApiResponse<TradeItemsResult>> {
  return get<TradeItemsResult>(`/api/v1/tenant-trade/${docKey}/items/search`, {
    search_field: JSON.stringify(fields),
    search_value: JSON.stringify(values),
    page: params.page ?? 1,
    page_size: params.page_size ?? 100,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

/**
 * 手动同步 / 按单号补录（接口 2.2.7）。
 * - 不传 billNos = 窗口同步（mode=WINDOW）；
 * - 传 billNos = 逐单补录（mode=BILL_NOS，上限 50）。
 * 线上格式：后端签名为 Form(list[str])，FastAPI 只认「重复字段」
 * （bill_nos=PC1&bill_nos=PC2）；传 JSON 字符串会被解析成单元素列表，
 * 导致补录单号变成 "[\"PC1\"]" 字面量而查不到单（已实测验证）。
 * silent=true：200 壳失败 / 409 BUSY/DEFERRED 由页面自行消费，不弹全局 toast。
 */
export function refreshTradeBills(docKey: TradeDocKey, billNos?: string[]): Promise<ApiResponse<TradeSyncRefreshResult>> {
  const params = new URLSearchParams()
  if (billNos && billNos.length > 0) {
    for (const no of billNos) {
      if (String(no || '').trim()) params.append('bill_nos', String(no).trim())
    }
  }
  return post<TradeSyncRefreshResult>(
    `/api/v1/tenant-trade/${docKey}/sync/refresh`,
    params,
    { silent: true },
  )
}
