import { beforeEach, expect, it, vi } from 'vitest'
import { queryTenantMode, updateTenantMode, querySyncSettings, updateSyncSettings } from './tenantMode'
import { getData, postForm } from './http'
vi.mock('./http', () => ({ getData: vi.fn(), postForm: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it('queries a tenant mode and previews/commits using explicit revision and form fields', () => {
  queryTenantMode('t')
  expect(getData).toHaveBeenCalledWith('/platform-tenants/mode/query', { tenant_id: 't' })
  for (const dry_run of [true, false]) {
    const payload = { tenant_id: 't', tenant_mode: 'TIANXIN' as const, expected_revision: 3, dry_run }
    updateTenantMode(payload)
    expect(postForm).toHaveBeenLastCalledWith('/platform-tenants/mode/update', payload)
  }
})
it('keeps each module sync update independent of tenant mode', () => {
  querySyncSettings('t', 'BORROW')
  expect(getData).toHaveBeenCalledWith('/platform-tianxin/sync-settings/query', { tenant_id: 't', module_code: 'BORROW' })
  for (const module_code of ['BORROW', 'PRODUCTION', 'OTHER_INBOUND', 'PURCHASE_SALES'] as const) {
    const payload = { tenant_id: 't', module_code, sync_interval_seconds: 900 }
    updateSyncSettings(payload)
    expect(postForm).toHaveBeenLastCalledWith('/platform-tianxin/sync-settings/update', payload)
  }
  expect(vi.mocked(postForm).mock.calls.every(([url]) => url !== '/platform-tenants/mode/update')).toBe(true)
})
