/**
 * 单据家族 API 分发层：按 docKey 解析所属家族（trade / borrow / other-inbound），返回同一套方法签名。
 *
 * 组件（TradeBillList / TradeBillDetail / SyncRejectPanel）只依赖本文件的接口，
 * 不再直接 import 具体家族的模块——新增家族只需在此登记一组适配器。
 *
 * 类型说明：三族响应结构同构（后端同协议；其他入库的键名差异在其模块内归一化），
 * 故用本文件的「最小公共形状」承载；各家族模块的返回类型结构上可赋值
 * （两端都有索引签名），适配器只需收敛 docKey/side 的联合类型。
 */
import type { ApiResponse } from '@/utils/request'
import * as trade from './trade'
import * as borrow from './borrow'
import * as otherInbound from './otherInbound'
import type { TradeDocKey, TradeSyncSide, TradeSyncRefreshResult } from './trade'
import type { BorrowSyncSide } from './borrow'
import { ERP_FAMILIES, resolveErpDoc, type ErpFamilyKey } from '@/config/erpDocFamily'

export interface ErpBillRow {
  wms_bill_id: string
  erp_bill_no: string
  erp_bill_date?: string | null
  total_qty?: string | null
  /** 贸易/借出为字符串枚举键，其他入库为 int（枚举展示统一 String(value) 查表） */
  warehouse_status?: string | number | null
  erp_lock_status?: string | number | null
  clssa?: string | null
  /** 历史归档标记（2026-11-18 批次）：1=早于正式开启时间首次导入的归档单（不可再作业） */
  wms_archive_flag?: 0 | 1
  [key: string]: unknown
}

export interface ErpItemRow {
  wms_item_id: string
  wms_bill_id?: string
  erp_bill_no: string
  erp_item_seq: string
  [key: string]: unknown
}

export interface ErpBillListResult {
  total: number
  page: number
  page_size: number
  records: ErpBillRow[]
}

export interface ErpItemsResult {
  total: number
  page: number
  page_size: number
  items: ErpItemRow[]
}

export interface ErpBillDetailResult {
  header: Record<string, unknown>
  items: ErpItemRow[]
}

export interface ErpBillQuery {
  page?: number
  page_size?: number
  date_from?: string
  date_to?: string
  sort_by?: string
  sort_order?: 'ASC' | 'DESC'
  /** 归档筛选（2026-11-18 批次）：0=正常单 1=历史归档单，缺省=都返回；仅 list 分支携带（search 端点无此参数） */
  archived?: 0 | 1
}

/** 手动同步结果（两族契约完全一致） */
export type ErpSyncRefreshResult = TradeSyncRefreshResult

export interface ErpRestartResult {
  mode: 'RESTART'
  side: string
  start_time: string
  doc_lines: string[]
  order_line_dispatched: boolean
}

export interface ErpRejectRow {
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

export interface ErpRejectListResult {
  total: number
  page: number
  page_size: number
  records: ErpRejectRow[]
}

export interface ErpRejectDetailResult extends Omit<ErpRejectRow, 'reasons'> {
  reasons: string[]
}

export interface ErpRejectQuery {
  page?: number
  page_size?: number
  date_from?: string
  date_to?: string
  sort_by?: string
  sort_order?: 'ASC' | 'DESC'
}

export interface ErpRetryItem {
  erp_bill_no: string
  doc_key: string
  doc_key_name: string
  action: 'created' | 'updated' | 'skipped' | 'rejected' | 'failed'
  reasons?: string[]
}

export interface ErpRetryResult {
  side: string
  retried_total: number
  results?: ErpRetryItem[]
  remaining_rejects?: number
}

export interface ErpFamilyApi {
  list(docKey: string, params: ErpBillQuery): Promise<ApiResponse<ErpBillListResult>>
  search(docKey: string, fields: string[], values: Record<string, string>, params: ErpBillQuery): Promise<ApiResponse<ErpBillListResult>>
  detail(docKey: string, wmsBillId: string): Promise<ApiResponse<ErpBillDetailResult>>
  items(docKey: string, params: ErpBillQuery): Promise<ApiResponse<ErpItemsResult>>
  itemsSearch(docKey: string, fields: string[], values: Record<string, string>, params: ErpBillQuery): Promise<ApiResponse<ErpItemsResult>>
  refresh(docKey: string, billNos?: string[]): Promise<ApiResponse<ErpSyncRefreshResult>>
  restart(side: string, startTime: string): Promise<ApiResponse<ErpRestartResult>>
  listRejects(side: string, params: ErpRejectQuery): Promise<ApiResponse<ErpRejectListResult>>
  searchRejects(side: string, fields: string[], values: Record<string, string>, params: ErpRejectQuery): Promise<ApiResponse<ErpRejectListResult>>
  rejectDetail(side: string, rejectId: string): Promise<ApiResponse<ErpRejectDetailResult>>
  retryRejects(side: string, billNos?: string[]): Promise<ApiResponse<ErpRetryResult>>
  /** 表头排序白名单（后端 400 门槛，页面据此过滤 sort_by） */
  headerSortFields(docKey: string): string[]
  /** 表头可搜索字段（搜索区常驻项） */
  headerSearchFields(docKey: string): string[]
  /** 明细可排序/可搜索字段（详情页搜索下拉） */
  itemSortFields(docKey: string): string[]
  /** 失败记录 doc_key（trade 带前缀 / borrow 裸值） */
  rejectDocKey(docKey: string): string
}

const tradeApi: ErpFamilyApi = {
  list: (docKey, params) => trade.listTradeBills(docKey as TradeDocKey, params),
  search: (docKey, fields, values, params) => trade.searchTradeBills(docKey as TradeDocKey, fields, values, params),
  detail: (docKey, wmsBillId) => trade.getTradeBillDetail(docKey as TradeDocKey, wmsBillId),
  items: (docKey, params) => trade.listTradeItems(docKey as TradeDocKey, params),
  itemsSearch: (docKey, fields, values, params) => trade.searchTradeItems(docKey as TradeDocKey, fields, values, params),
  refresh: (docKey, billNos) => trade.refreshTradeBills(docKey as TradeDocKey, billNos),
  restart: (side, startTime) => trade.restartTradeSync(side as TradeSyncSide, startTime),
  listRejects: (side, params) => trade.listTradeSyncRejects(side as TradeSyncSide, params as trade.TradeSyncRejectQuery),
  searchRejects: (side, fields, values, params) =>
    trade.searchTradeSyncRejects(side as TradeSyncSide, fields, values, params as trade.TradeSyncRejectQuery),
  rejectDetail: (side, rejectId) => trade.getTradeSyncRejectDetail(side as TradeSyncSide, rejectId),
  retryRejects: (side, billNos) => trade.retryTradeSyncRejects(side as TradeSyncSide, billNos),
  headerSortFields: (docKey) => trade.getHeaderSortFields(docKey),
  headerSearchFields: (docKey) => trade.getHeaderSearchFields(docKey),
  itemSortFields: (docKey) => trade.getItemSortFields(docKey),
  rejectDocKey: (docKey) => trade.rejectDocKeyOfDocKey(docKey),
}

const borrowApi: ErpFamilyApi = {
  list: (docKey, params) => borrow.listBorrowBills(docKey, params),
  search: (docKey, fields, values, params) => borrow.searchBorrowBills(docKey, fields, values, params),
  detail: (docKey, wmsBillId) => borrow.getBorrowBillDetail(docKey, wmsBillId),
  items: (docKey, params) => borrow.listBorrowItems(docKey, params),
  itemsSearch: (docKey, fields, values, params) => borrow.searchBorrowItems(docKey, fields, values, params),
  refresh: (docKey, billNos) => borrow.refreshBorrowBills(docKey, billNos),
  restart: (side, startTime) => borrow.restartBorrowSync(side as BorrowSyncSide, startTime),
  listRejects: (side, params) => borrow.listBorrowSyncRejects(side as BorrowSyncSide, params as borrow.BorrowSyncRejectQuery),
  searchRejects: (side, fields, values, params) =>
    borrow.searchBorrowSyncRejects(side as BorrowSyncSide, fields, values, params as borrow.BorrowSyncRejectQuery),
  rejectDetail: (side, rejectId) => borrow.getBorrowSyncRejectDetail(side as BorrowSyncSide, rejectId),
  retryRejects: (side, billNos) => borrow.retryBorrowSyncRejects(side as BorrowSyncSide, billNos),
  headerSortFields: (docKey) => borrow.getBorrowHeaderSortFields(docKey),
  headerSearchFields: (docKey) => borrow.getBorrowHeaderSearchFields(docKey),
  itemSortFields: (docKey) => borrow.getBorrowItemSortFields(docKey),
  rejectDocKey: (docKey) => borrow.rejectDocKeyOfBorrowDocKey(docKey),
}

/** 其他入库：单管线单单据，docKey/side 不入 URL（恒 other-inbound / all） */
const otherInboundApi: ErpFamilyApi = {
  list: (_docKey, params) => otherInbound.listOtherInboundBills(params),
  search: (_docKey, fields, values, params) => otherInbound.searchOtherInboundBills(fields, values, params),
  detail: (_docKey, wmsBillId) => otherInbound.getOtherInboundBillDetail(wmsBillId),
  items: (_docKey, params) => otherInbound.listOtherInboundItems(params),
  itemsSearch: (_docKey, fields, values, params) => otherInbound.searchOtherInboundItems(fields, values, params),
  refresh: (_docKey, billNos) => otherInbound.refreshOtherInboundBills(billNos),
  restart: (_side, startTime) => otherInbound.restartOtherInboundSync(startTime),
  listRejects: (_side, params) => otherInbound.listOtherInboundSyncRejects(params as otherInbound.OtherInboundSyncRejectQuery),
  searchRejects: (_side, fields, values, params) =>
    otherInbound.searchOtherInboundSyncRejects(fields, values, params as otherInbound.OtherInboundSyncRejectQuery),
  rejectDetail: (_side, rejectId) => otherInbound.getOtherInboundSyncRejectDetail(rejectId),
  retryRejects: (_side, billNos) => otherInbound.retryOtherInboundSyncRejects(billNos),
  headerSortFields: () => otherInbound.getOtherInboundHeaderSortFields(),
  headerSearchFields: () => otherInbound.getOtherInboundHeaderSearchFields(),
  itemSortFields: () => otherInbound.getOtherInboundItemSortFields(),
  rejectDocKey: (docKey) => otherInbound.rejectDocKeyOfOtherInboundDocKey(docKey),
}

export const ERP_FAMILY_API: Record<ErpFamilyKey, ErpFamilyApi> = {
  trade: tradeApi,
  borrow: borrowApi,
  'other-inbound': otherInboundApi,
}

/** docKey → 家族 API；未知 docKey 返回 null */
export function erpApiOfDocKey(docKey: string): ErpFamilyApi | null {
  const resolved = resolveErpDoc(docKey)
  return resolved ? ERP_FAMILY_API[resolved.family.key] : null
}

export { ERP_FAMILIES }
