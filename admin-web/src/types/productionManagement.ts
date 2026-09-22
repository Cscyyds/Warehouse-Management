/** 生产管理配置（平台后台）相关类型 —— 对齐后端 platform_production_management.py 真实返回字段。 */

/** 渠道凭证表单元数据（由接口①下发，前端据此动态渲染 Tab2 表单） */
export interface CredentialField {
  key: string
  label: string
  required: boolean
  secret: boolean
  /** 渲染控件类型；缺省 text。scheme=http/https 下拉（值随 api_base_url 前缀落库，供后续同步请求使用） */
  widget?: 'text' | 'scheme'
}

/** 可接入渠道枚举项（接口①） */
export interface ChannelItem {
  channel_code: string
  channel_name: string
  /** 渠道是否已实现可启用；false 时下拉置灰，tooltip「预留占位」 */
  available: boolean
  supported_doc_count: number
  credential_fields: CredentialField[]
}

/** 租户生产模块配置总览行（接口② configs/list 的 items[]） */
export interface ProductionConfigSummaryRow {
  tenant_id: string
  tenant_name: string
  tenant_status: number
  contact_name?: string | null
  contact_phone?: string | null
  /** 生产模块开关 0/1，未配置过=0 */
  enabled: number
  channel_code?: string | null
  channel_name?: string | null
  sync_interval_seconds?: number | null
  sync_window_days?: number | null
  initial_backfill_days?: number | null
  reconcile_days?: number | null
  remark?: string | null
  /** 凭证三要素是否齐全 */
  credential_configured: boolean
  credential_status?: number | null
  api_base_url?: string | null
  updated_at?: string | null
}

/** 单租户模块配置详情（接口③ configs/query 的 config，整体可为 null=从未配置） */
export interface ProductionConfigDetail {
  config_id: string
  enabled: number
  channel_code?: string | null
  channel_name?: string | null
  sync_interval_seconds?: number | null
  sync_window_days?: number | null
  initial_backfill_days?: number | null
  reconcile_days?: number | null
  remark?: string | null
  updated_by_name?: string | null
  updated_at?: string | null
}

/** 凭证脱敏视图（接口③ credential / 接口⑥ items[]，pwd 永不回显） */
export interface CredentialView {
  credential_id: string
  channel_code: string
  channel_name?: string | null
  /** 三要素是否齐全 */
  configured: boolean
  /** 站点协议前缀（http/https，历史无前缀数据回显 http） */
  api_scheme?: string | null
  /** 站点号 host:port（不含协议前缀，前缀见 api_scheme） */
  api_base_url?: string | null
  comp_no?: string | null
  usr?: string | null
  default_usr?: string | null
  /** 密码是否已配置（布尔，内容不返回） */
  pwd_configured: boolean
  status: number
  has_cached_token: boolean
  token_expires_at?: string | null
  remark?: string | null
  updated_by_name?: string | null
  updated_at?: string | null
  /** 仅接口⑥返回：是否为启用中模块正在使用的渠道（该行删除按钮禁用） */
  in_use?: boolean
}

/** 接口③ configs/query 返回体 */
export interface TenantProductionConfigData {
  tenant_id: string
  tenant_name: string
  config: ProductionConfigDetail | null
  credential: CredentialView | null
}

/** 单个单据同步状态（接口⑫ sync/status 的 docs[]） */
export interface SyncDocState {
  doc_key: string
  doc_name: string
  /** BACKFILL 回填中 / INCREMENTAL 增量 */
  phase: string
  backfill_done: number
  watermark_end?: string | null
  next_run_at?: string | null
  last_success_at?: string | null
  last_error_at?: string | null
  last_error_msg?: string | null
  consecutive_failures: number
  round_id: number
  slice_done: number
  slice_total: number
  /** 未绑定 WMS 产品的明细数，>0 说明租户产品档案有缺口 */
  unbound_prd_count: number
  claimed_by?: string | null
  lease_until?: string | null
}

/** 接口⑫ sync/status 返回体 */
export interface SyncStatusData {
  tenant_id: string
  enabled: boolean
  channel_code?: string | null
  docs: SyncDocState[]
}

/** 单行同步日志（接口⑬ sync/logs 的 logs[]） */
export interface SyncLogRow {
  log_id: string
  log_level: string
  doc_key: string
  doc_name: string
  trigger_type?: string | null
  phase?: string | null
  round_id: number
  window_start?: string | null
  window_end?: string | null
  bills_fetched: number
  headers_upserted: number
  items_upserted: number
  items_erp_deleted: number
  unbound_prd_count: number
  status: string
  error_msg?: string | null
  started_at?: string | null
  finished_at?: string | null
  duration_ms?: number | null
}

/** 接口⑪ fetch-bills 返回体 */
export interface FetchBillsResult {
  requested: number
  fetched: number
  missing: string[]
}

/* —— 请求参数类型 —— */

export interface ProductionConfigListParams {
  keyword?: string
  enabled?: 0 | 1
  channel_code?: string
  page?: number
  page_size?: number
}

export interface UpdateProductionConfigPayload {
  tenant_id: string
  enabled: 0 | 1
  channel_code?: string
  sync_interval_seconds?: number
  sync_window_days?: number
  initial_backfill_days?: number
  reconcile_days?: number
  remark?: string
}

export interface UpdateCredentialPayload {
  tenant_id: string
  channel_code?: string
  /** 站点协议前缀 http/https（默认 http），与 api_base_url 一起拼成完整前缀落库 */
  api_scheme?: string
  api_base_url: string
  /** JSON 字符串：{"comp_no","usr","pwd","default_usr"}；编辑时 pwd 留空=沿用原密码 */
  auth_payload: string
  status_flag?: 0 | 1
  remark?: string
}

export type SyncTriggerMode = 'INCREMENTAL' | 'FULL'

export interface TriggerSyncPayload {
  tenant_id: string
  doc_key?: string
  mode?: SyncTriggerMode
}

export interface FetchBillsPayload {
  tenant_id: string
  doc_key: string
  /** JSON 字符串数组，如 ["ML24230147"]，单次 ≤50 */
  erp_bill_nos: string
}

export type SyncLogLevel = 'ROUND' | 'SLICE'
export type SyncLogStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'RUNNING'

export interface SyncLogParams {
  tenant_id: string
  doc_key?: string
  log_level?: SyncLogLevel
  log_status?: SyncLogStatus
  page?: number
  page_size?: number
}

/* —— 分页返回体 —— */

export interface ProductionConfigListData {
  total: number
  page: number
  page_size: number
  items: ProductionConfigSummaryRow[]
}

export interface CredentialListData {
  tenant_id: string
  tenant_name: string
  total: number
  items: CredentialView[]
}

export interface SyncLogListData {
  total: number
  page: number
  page_size: number
  logs: SyncLogRow[]
}
