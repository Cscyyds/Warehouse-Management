/**
 * 平台管理员侧：贸易形态配置（doc 19 §1.2）
 * 2 个接口：查询租户贸易模块形态 / 更新租户贸易模块形态
 */
import { getData, postForm } from './http'

/* —— 类型 —— */

export interface TradeModuleState {
  /** 该 module_code 是否已在 sys_tenant_module_config 建行 */
  exists: boolean
  /** 后端返回的是 int 0/1（未建行为 null），**不是 boolean**；消费侧请用 `Number(x) === 1` 判定 */
  enabled: number | boolean | null
  channel_code?: string | null
  /** 天心ERP数据同步总开关（int 0/1；无 PURCHASE_SALES 行时为 null，与 channel_code 同口径） */
  erp_sync_enabled?: number | null
}

export interface TradeConfigResult {
  tenant_id: string
  finance: TradeModuleState
  purchase_sales: TradeModuleState
  /** 是否天心贸易模式（采购/销售与财务均停用 + 绑定天心） */
  is_tianxin_trade_mode: boolean
}

export interface UpdateTradeConfigPayload {
  tenant_id: string
  /** 'true' / 'false' 字符串（Form 提交） */
  need_finance_module: string
  need_purchase_sales_module: string
  /** 两开关同关时必填，当前仅 TIANXIN；同开时忽略并置空 */
  external_software?: string
  /**
   * 天心ERP数据同步总开关，'true' / 'false' 字符串（Form 提交）。
   * ⚠️ 整表单重写语义：后端不传即按 false 落库 —— 每次保存必须显式携带现值，
   * 否则开关被重置为关（租户侧自动同步停止、手动同步入口 403 + 权限整族隐藏）。
   */
  enable_erp_sync?: string
}

export interface UpdateTradeConfigResult {
  tenant_id: string
  finance_enabled: boolean
  purchase_sales_enabled: boolean
  channel_code: string | null
  /** 首次切为天心模式时自动补建的贸易四单据同步状态行数 */
  states_created: number
  /** 保存后的天心ERP数据同步总开关（int 0/1） */
  erp_sync_enabled?: number
}

/* —— ① 查询租户贸易模块形态（doc 1.2.1） —— */

export const queryTradeConfig = (tenantId: string) =>
  getData<TradeConfigResult>('/platform-trade/configs/query', { tenant_id: tenantId })

/* —— ② 更新租户贸易模块形态（doc 1.2.2） —— */

export const updateTradeConfig = (payload: UpdateTradeConfigPayload) =>
  postForm<UpdateTradeConfigResult>('/platform-trade/configs/update', payload)

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
