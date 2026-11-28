import { getData } from './http'

/* —— ③ 同步失败（拒绝）记录查询（平台排障用，严格分侧；平台管理员 JWT 鉴权，不受总开关限制） —— */

export type TradeRejectSide = 'purchase' | 'sales'

/** 失败记录行（平台侧额外返回 raw_error 原始报错；list/search 的 reasons 为 JSON 数组字符串） */
export interface PlatformSyncRejectRow {
  reject_id: string
  doc_key: string
  doc_key_name: string
  erp_bill_no: string
  reasons: string
  trigger_type: string
  round_id: number
  created_at: string
  raw_error?: string | null
  [key: string]: unknown
}

export interface PlatformSyncRejectListResult {
  total: number
  page: number
  page_size: number
  records: PlatformSyncRejectRow[]
}

/** 失败记录详情：reasons 已解析为数组，含 raw_error */
export interface PlatformSyncRejectDetailResult extends Omit<PlatformSyncRejectRow, 'reasons'> {
  reasons: string[]
}

export interface PlatformSyncRejectQuery {
  page?: number
  page_size?: number
  date_from?: string
  date_to?: string
  sort_by?: string
  sort_order?: string
}

/** 指定租户、指定侧的失败记录分页（side 必传：purchase/sales 二选一） */
export const listPlatformSyncRejects = (
  tenantId: string,
  side: TradeRejectSide,
  params: PlatformSyncRejectQuery = {},
) =>
  getData<PlatformSyncRejectListResult>('/platform-trade/sync-rejects/list', {
    tenant_id: tenantId,
    side,
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    date_from: params.date_from,
    date_to: params.date_to,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })

/**
 * 失败记录搜索：search_field 为字段名 JSON 数组字符串、search_value 为字段→值 JSON 对象字符串
 * （erp_bill_no 模糊，doc_key / trigger_type 等值），可与时间窗 AND 组合。
 */
export const searchPlatformSyncRejects = (
  tenantId: string,
  side: TradeRejectSide,
  fields: string[],
  values: Record<string, string>,
  params: PlatformSyncRejectQuery = {},
) =>
  getData<PlatformSyncRejectListResult>('/platform-trade/sync-rejects/search', {
    tenant_id: tenantId,
    side,
    search_field: JSON.stringify(fields),
    search_value: JSON.stringify(values),
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    date_from: params.date_from,
    date_to: params.date_to,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })

/** 单条失败详情（reject_id 前缀 txr_；跨侧/不存在 → 404「拒绝记录不存在」） */
export const getPlatformSyncRejectDetail = (tenantId: string, side: TradeRejectSide, rejectId: string) =>
  getData<PlatformSyncRejectDetailResult>('/platform-trade/sync-rejects/detail', {
    tenant_id: tenantId,
    side,
    reject_id: rejectId,
  })
