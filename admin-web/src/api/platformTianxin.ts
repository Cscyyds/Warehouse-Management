/**
 * 平台管理员侧：天心「单据正式开启时间」按模块读写（2026-11-17 后端改造）
 * 2 个接口：查询租户四模块截止时间 / 按模块设置·清空（支持 dry-run 与 confirm 门禁）
 *
 * 后端：app/api/v1/endpoints/platform_tianxin_sync_management.py
 * 语义铁律（与后端逐字对齐）：
 * - formal_start_at **不传（undefined）= 不改**；**空串 '' = 清空**（归档功能关闭）。
 *   toUrlEncoded 丢弃 undefined/null、保留空串 —— 故清空必须显式传 ''，**绝不能用 null**
 *   （null 会被丢弃变成「不改」）。payload 类型因此收窄为 string（不含 null），编译期防误用。
 * - 日期格式仅接受 YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS（纯日期补 00:00:00）；
 *   非法格式后端 parse_formal_start_at 抛 ValueError 且端点未捕获 → **500**，前端必须本地校验。
 * - confirm 门禁：新值晚于当前时刻（未来时间）或早于当前值（调早）时必须 confirm=true，否则 400。
 *   清空（''）不触发门禁。
 */
import { getData, postForm } from './http'

/* —— 类型 —— */

export type TianxinModuleCode = 'PURCHASE_SALES' | 'BORROW' | 'OTHER_INBOUND' | 'PRODUCTION'

/** 查询结果：configs 按模块码索引（未设置为 null）；effective 供核对同单共用值 */
export interface TianxinSyncConfigQueryResult {
  tenant_id: string
  configs: Record<string, string | null>
  effective: {
    /** 生产销售退回单与贸易销货退回单（SB）同单，实际读 PURCHASE_SALES 值 */
    production_sales_return: string | null
  }
  warnings: string[]
}

/** dry-run 影响面（清空场景后端返回空对象/0，非 null） */
export interface TianxinSyncAffected {
  bills: number
  by_doc_key: Record<string, number>
  /** 其中已正常导入（wms_archive_flag=0）的存量单量：设置后不会回溯归档 */
  already_normal_imported: number
  already_normal_by_doc_key: Record<string, number>
}

/** 设置/清空/dry-run 统一返回形态 */
export interface TianxinSyncUpdateResult {
  tenant_id: string
  module_code: string
  formal_start_at: string | null
  dry_run: boolean
  /** dry-run 时为影响面对象；实际写入/不传时为 null */
  affected: TianxinSyncAffected | null
  /** 受影响样例单号（≤5，按单据日期倒序） */
  samples: string[]
  warnings: string[]
  sales_return_formal_start_at: string | null
}

export interface UpdateTianxinSyncConfigPayload {
  tenant_id: string
  module_code: TianxinModuleCode
  /** undefined=不改（UI 不提供此入口）；''=清空；'YYYY-MM-DD[ HH:MM:SS]'=设置。禁止 null */
  formal_start_at?: string
  dry_run?: boolean
  confirm?: boolean
}

/* —— 展示层映射（中文仅展示，传参一律用英文码值） —— */

/** 四模块中文名 + 行附注（与后端 TIANXIN_MODULE_CODES 同序） */
export const TIANXIN_MODULE_OPTIONS: Array<{ value: TianxinModuleCode; label: string; note: string }> = [
  { value: 'PURCHASE_SALES', label: '采购销售（贸易）', note: '含生产销售退回单（同单共用贸易值）' },
  { value: 'BORROW', label: '借出借入', note: '借入单 / 借入还出单 / 借出单 / 借出还入单' },
  { value: 'OTHER_INBOUND', label: '其他入库', note: '其他入库单（XC，单管线）' },
  { value: 'PRODUCTION', label: '生产', note: '不含销售退回单，其跟随贸易值' },
]

/** dry-run by_doc_key 的 23 类单据中文名（逐字对齐后端 doc_name / DOC_META） */
export const TIANXIN_DOC_KEY_NAMES: Record<string, string> = {
  // 贸易 5 类（PURCHASE_SALES）
  'trade-purchase-order': '进货单',
  'trade-purchase-return': '进货退回单',
  'trade-sales-order': '销货单',
  'trade-sales-return': '销货退回单',
  'trade-outbound-order': '出库单',
  // 生产 13 类（含 sales-return，同单共用贸易值）
  'finished-goods-stockin': '成品缴库单',
  'production-picking': '生产领料单',
  'production-return': '生产退料单',
  'production-supplement': '生产补料单',
  'non-production-picking': '非生产领料单',
  'non-production-return': '非生产退料单',
  'sales-return': '销售退回单',
  'outsourcing-picking': '托工领料单',
  'outsourcing-return': '托工退料单',
  'outsourcing-supplement': '托工补料单',
  'outsourcing-receipt': '托外加工缴回单',
  'material-cutting': '物料切割单',
  'outsourcing-chargeback': '托工退回单',
  // 借出借入 4 类（BORROW）
  'borrow-in-order': '借入单',
  'borrow-in-return': '借入还出单',
  'lend-out-order': '借出单',
  'lend-out-return': '借出还入单',
  // 其他入库 1 类（OTHER_INBOUND）
  'other-inbound': '其他入库单',
}

/** doc_key → 中文名（未知码原样透出，不丢信息） */
export function tianxinDocKeyName(docKey: string): string {
  return TIANXIN_DOC_KEY_NAMES[docKey] || docKey
}

/* —— ① 查询租户四模块正式开启时间 —— */

export const getTianxinSyncConfig = (tenantId: string) =>
  getData<TianxinSyncConfigQueryResult>('/platform-tianxin/sync-config/query', { tenant_id: tenantId })

/* —— ② 按模块设置/清空（dry-run 预览 / confirm 门禁） —— */

export const updateTianxinSyncConfig = (payload: UpdateTianxinSyncConfigPayload) =>
  postForm<TianxinSyncUpdateResult>('/platform-tianxin/sync-config/update', payload)