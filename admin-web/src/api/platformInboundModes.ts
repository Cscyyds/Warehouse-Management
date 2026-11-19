import { getData, postForm } from './http'

export type InboundModule = 'borrow' | 'other-inbound'

export interface InboundModeConfig {
  exists: boolean
  isTianxin: boolean
  syncEnabled: boolean
}

interface UpdateInboundModeResult {
  states_created: number
  erp_sync_enabled: number
  warnings?: string[]
}

export async function queryInboundMode(module: InboundModule, tenantId: string): Promise<InboundModeConfig> {
  const params = { tenant_id: tenantId }
  if (module === 'borrow') {
    const result = await getData<{
      borrow: { exists: boolean; erp_sync_enabled: number | null }
      is_tianxin_borrow_mode: boolean
    }>('/platform-borrow/configs/query', params)
    return {
      exists: result.borrow.exists,
      isTianxin: result.is_tianxin_borrow_mode,
      syncEnabled: result.borrow.erp_sync_enabled === 1,
    }
  }
  const result = await getData<{
    module_code: string | null
    erp_sync_enabled: number | null
    is_tianxin_other_inbound_mode: boolean
  }>('/platform-other-inbound/configs/query', params)
  return {
    exists: result.module_code !== null,
    isTianxin: result.is_tianxin_other_inbound_mode,
    syncEnabled: result.erp_sync_enabled === 1,
  }
}

export function updateInboundMode(module: InboundModule, tenantId: string, isTianxin: boolean, syncEnabled: boolean) {
  if (module === 'borrow') {
    return postForm<UpdateInboundModeResult>('/platform-borrow/configs/update', {
      tenant_id: tenantId,
      need_borrow_module: String(!isTianxin),
      external_software: isTianxin ? 'TIANXIN' : undefined,
      enable_erp_sync: String(isTianxin && syncEnabled),
    })
  }
  return postForm<UpdateInboundModeResult>('/platform-other-inbound/configs/update', {
    tenant_id: tenantId,
    enabled: isTianxin ? 0 : 1,
    channel_code: isTianxin ? 'TIANXIN' : undefined,
    erp_sync_enabled: isTianxin && syncEnabled ? 1 : 0,
  })
}
