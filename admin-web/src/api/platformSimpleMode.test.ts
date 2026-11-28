import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('./http', () => ({ getData: vi.fn(), postFormData: vi.fn() }))
import { getData, postFormData } from './http'
import { queryTenantSimpleMode, updateTenantSimpleMode } from './platformSimpleMode'

const status = { tenant_id: 'tenant', enabled: 0, revision: 6 }
beforeEach(() => { vi.resetAllMocks() })

it('查询按租户编码，更新用FormData和整数版本，不传其他字段', async () => {
  vi.mocked(getData).mockResolvedValue(status)
  vi.mocked(postFormData).mockResolvedValue({ ...status, enabled: 1, revision: 7 })
  await queryTenantSimpleMode('tenant')
  await updateTenantSimpleMode({ tenant_id: 'tenant', enabled: 1, expected_revision: 6 })
  expect(getData).toHaveBeenCalledWith('/platform-tenants/simple-mode/query', { tenant_id: 'tenant' })
  expect(postFormData).toHaveBeenCalledWith('/platform-tenants/simple-mode/update', { tenant_id: 'tenant', enabled: 1, expected_revision: 6 })
})

it('拒绝跨租户及非法版本响应，不能套用到当前租户', async () => {
  vi.mocked(getData).mockResolvedValueOnce({ ...status, tenant_id: 'other' }).mockResolvedValueOnce({ ...status, revision: -1 })
  await expect(queryTenantSimpleMode('tenant')).rejects.toThrow('返回异常')
  await expect(queryTenantSimpleMode('tenant')).rejects.toThrow('返回异常')
})
