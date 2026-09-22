/**
 * 平台管理员侧：贸易形态配置（doc 19 §1.2）
 * 2 个接口：查询租户贸易模块形态 / 更新租户贸易模块形态
 */
import { getData, postForm } from './http'

/* —— 类型 —— */

export interface TradeModuleState {
  exists: boolean
  enabled: boolean
  channel_code?: string | null
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
}

export interface UpdateTradeConfigResult {
  tenant_id: string
  finance_enabled: boolean
  purchase_sales_enabled: boolean
  channel_code: string | null
  /** 首次切为天心模式时自动补建的贸易四单据同步状态行数 */
  states_created: number
}

/* —— ① 查询租户贸易模块形态（doc 1.2.1） —— */

export const queryTradeConfig = (tenantId: string) =>
  getData<TradeConfigResult>('/platform-trade/configs/query', { tenant_id: tenantId })

/* —— ② 更新租户贸易模块形态（doc 1.2.2） —— */

export const updateTradeConfig = (payload: UpdateTradeConfigPayload) =>
  postForm<UpdateTradeConfigResult>('/platform-trade/configs/update', payload)
