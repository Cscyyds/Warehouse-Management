import { getData, postFormData } from './http'

export interface SimpleModeBlocker {
  error_code: string
  product_id?: string
  place_type?: string
  place_id?: string
  stock_qty?: string
  request_id?: string
  target_id?: string
}

export interface TenantSimpleMode {
  tenant_id: string
  enabled: 0 | 1
  revision: number
  can_disable: boolean
  disable_blockers: SimpleModeBlocker[]
  in_progress_request_count: number
  unfinished_task_count: number
  stock_by_product: Array<{ product_id: string; stock_qty: string }>
}

function validate(status: TenantSimpleMode, tenantId: string) {
  if (!status || status.tenant_id !== tenantId || ![0, 1].includes(status.enabled) || !Number.isSafeInteger(status.revision) || status.revision < 0) {
    throw new Error('简易模式配置返回异常，请刷新重试')
  }
  return status
}

export async function queryTenantSimpleMode(tenantId: string) {
  return validate(await getData<TenantSimpleMode>('/platform-tenants/simple-mode/query', { tenant_id: tenantId }), tenantId)
}

export async function updateTenantSimpleMode(payload: { tenant_id: string; enabled: 0 | 1; expected_revision: number }) {
  return validate(await postFormData<TenantSimpleMode>('/platform-tenants/simple-mode/update', payload), payload.tenant_id)
}
