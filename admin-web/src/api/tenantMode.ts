import { getData, postForm } from './http'

export type TenantMode = 'LOCAL' | 'TIANXIN'
export type SyncModule = 'PURCHASE_SALES' | 'BORROW' | 'OTHER_INBOUND' | 'PRODUCTION'
export interface TenantModeInfo {
  tenant_id: string
  tenant_mode: TenantMode | null
  tenant_mode_revision: number
  migration_required: boolean
  available_modules: string[]
  can_switch: boolean
  switch_blockers: Record<string, number>
  sync_ready: boolean
  sync_readiness_reasons: string[]
  credential_ready: boolean
}
export interface ModeUpdateResult {
  tenant_id: string
  old_mode: TenantMode | null
  tenant_mode: TenantMode
  tenant_mode_revision: number
  dry_run: boolean
  changed: boolean
  can_switch: boolean
  switch_blockers: Record<string, number>
  available_modules: string[]
  initialized_sync_states?: number
}
export interface SyncValues {
  sync_interval_seconds: number
  sync_window_days: number
  initial_backfill_days: number
  reconcile_days: number
}
export interface SyncSetting extends Record<keyof SyncValues, number | null> {
  module_code: SyncModule
  effective: SyncValues
}
export const queryTenantMode = (tenantId: string) =>
  getData<TenantModeInfo>('/platform-tenants/mode/query', { tenant_id: tenantId })
export const updateTenantMode = (payload: { tenant_id: string; tenant_mode: TenantMode; expected_revision: number; dry_run: boolean }) =>
  postForm<ModeUpdateResult>('/platform-tenants/mode/update', payload)
export const querySyncSettings = (tenantId: string, moduleCode?: SyncModule) =>
  getData<{ tenant_id: string; tenant_mode: TenantMode | null; settings: SyncSetting[] }>('/platform-tianxin/sync-settings/query', { tenant_id: tenantId, module_code: moduleCode })
export const updateSyncSettings = (payload: { tenant_id: string; module_code: SyncModule } & Partial<SyncValues>) =>
  postForm<SyncSetting>('/platform-tianxin/sync-settings/update', payload)
