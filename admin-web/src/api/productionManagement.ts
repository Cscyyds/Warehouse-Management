import { getData, postForm } from './http'
import type {
  ChannelItem,
  CredentialListData,
  CredentialView,
  FetchBillsPayload,
  FetchBillsResult,
  ProductionConfigDetail,
  ProductionConfigListData,
  ProductionConfigListParams,
  SyncLogListData,
  SyncLogParams,
  SyncStatusData,
  SyncTriggerMode,
  TenantProductionConfigData,
  TriggerSyncPayload,
  UpdateCredentialPayload,
  UpdateProductionConfigPayload,
} from '@/types/productionManagement'

/**
 * 13 类生产单据下拉选项（文档附录 8.1）。
 * Tab3 状态行以接口⑫ docs[] 为准；此常量用于 Tab4 日志筛选与 Tab3 触发/补录下拉的兜底。
 */
export const PRODUCTION_DOC_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'finished-goods-stockin', label: '成品缴库单' },
  { value: 'production-picking', label: '生产领料单' },
  { value: 'production-return', label: '生产退料单' },
  { value: 'production-supplement', label: '生产补料单' },
  { value: 'non-production-picking', label: '非生产领料单' },
  { value: 'non-production-return', label: '非生产退料单' },
  { value: 'sales-return', label: '销售退回单' },
  { value: 'outsourcing-picking', label: '托工领料单' },
  { value: 'outsourcing-return', label: '托工退料单' },
  { value: 'outsourcing-supplement', label: '托工补料单' },
  { value: 'outsourcing-receipt', label: '托外加工缴回单' },
  { value: 'material-cutting', label: '物料切割单' },
  { value: 'outsourcing-chargeback', label: '托工退回单' },
]

/* —— ① 渠道枚举 —— */

export const listChannels = () =>
  getData<{ channels: ChannelItem[] }>('/platform-production/channels/list')

/* —— ②③④⑤ 模块配置 —— */

export const queryProductionConfigs = (params: ProductionConfigListParams = {}) =>
  getData<ProductionConfigListData>('/platform-production/configs/list', { page: 1, page_size: 20, ...params })

export const queryTenantProductionConfig = (tenantId: string) =>
  getData<TenantProductionConfigData>('/platform-production/configs/query', { tenant_id: tenantId })

export const updateProductionConfig = (payload: UpdateProductionConfigPayload) =>
  postForm<{ tenant_id: string; created: boolean; enabled: number; channel_code: string | null }>(
    '/platform-production/configs/update',
    payload,
  )

export const deleteProductionConfig = (payload: { tenant_id: string; purge_sync_state: 0 | 1 }) =>
  postForm<{ tenant_id: string; channel_code: string | null; purged_states: number }>(
    '/platform-production/configs/delete',
    payload,
  )

/* —— ⑥⑦⑧⑨ 渠道凭证 —— */

export const listTenantCredentials = (tenantId: string) =>
  getData<CredentialListData>('/platform-production/credentials/list', { tenant_id: tenantId })

export const updateTenantCredential = (payload: UpdateCredentialPayload) =>
  postForm<{ tenant_id: string; channel_code: string; credential_id: string; pwd_changed: boolean }>(
    '/platform-production/credentials/update',
    payload,
  )

/** 连通测试：覆盖模式传 api_base_url+auth_payload，已保存模式传 tenant_id(+channel_code)，二选一 */
export const testTenantCredential = (payload: Record<string, string>) =>
  postForm<{ ok: boolean }>('/platform-production/credentials/test', payload)

export const deleteTenantCredential = (payload: { tenant_id: string; channel_code?: string }) =>
  postForm<{ tenant_id: string; channel_code: string }>('/platform-production/credentials/delete', payload)

/* —— ⑩⑪⑫⑬ 同步触发/补录/状态/日志 —— */

export const triggerProductionSync = (payload: TriggerSyncPayload) =>
  postForm<{ tenant_id: string; mode: SyncTriggerMode; dispatched: number }>(
    '/platform-production/sync/trigger',
    payload,
  )

export const fetchProductionBills = (payload: FetchBillsPayload) =>
  postForm<FetchBillsResult>('/platform-production/sync/fetch-bills', payload)

export const querySyncStatus = (tenantId: string) =>
  getData<SyncStatusData>('/platform-production/sync/status', { tenant_id: tenantId })

export const querySyncLogs = (params: SyncLogParams) =>
  getData<SyncLogListData>('/platform-production/sync/logs', { page: 1, page_size: 20, ...params })

/* —— 便于子组件引用的类型再导出 —— */

export type {
  ChannelItem,
  CredentialView,
  FetchBillsResult,
  ProductionConfigDetail,
  ProductionConfigSummaryRow,
  SyncDocState,
  SyncLogRow,
  SyncStatusData,
} from '@/types/productionManagement'
