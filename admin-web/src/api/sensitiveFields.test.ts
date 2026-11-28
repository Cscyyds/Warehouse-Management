import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./http', () => ({ getData: vi.fn(), postFormData: vi.fn() }))
import { getData, postFormData } from './http'
import { allSensitiveFields, createSensitiveField, updateSensitiveField, createSensitiveMapping } from './sensitiveFields'
beforeEach(() => { vi.resetAllMocks(); localStorage.clear() })
describe('平台敏感管理API', () => {
  it('依赖候选翻页取全，包含第二页字段，不传未支持的status过滤', async () => {
    const first = Array.from({ length: 200 }, (_, i) => ({ field_id: `f${i}` }))
    vi.mocked(getData).mockResolvedValueOnce({ fields: first, total: 201 }).mockResolvedValueOnce({ fields: [{ field_id: 'last' }], total: 201 })
    const result = await allSensitiveFields()
    expect(result).toHaveLength(201); expect(result.at(-1)?.field_id).toBe('last')
    expect(getData).toHaveBeenNthCalledWith(2, '/platform-sensitive-fields/query', { page: 2, page_size: 200 })
  })
  it('候选加载提前结束时报告不完整，不能静默省略后续页', async () => {
    vi.mocked(getData).mockResolvedValueOnce({ fields: [{ field_id: 'f' }], total: 3 }).mockResolvedValueOnce({ fields: [], total: 3 })
    await expect(allSensitiveFields()).rejects.toThrow('未完整加载')
  })
  it('新增、更新和映射使用各自平台FormData封装', async () => {
    await createSensitiveField({ module: 'PRODUCT', field_code: 'price', field_label: '价格' })
    await updateSensitiveField({ field_id: 'f', is_derived: 0, derived_from_field_ids: [] })
    await createSensitiveMapping({ field_id: 'f', interface_path: '/a', interface_name: '业务接口', io_type: 'OUTPUT', param_name: 'price' })
    expect(postFormData).toHaveBeenNthCalledWith(2, '/platform-sensitive-fields/update', { field_id: 'f', is_derived: 0, derived_from_field_ids: [] })
    expect(postFormData).toHaveBeenNthCalledWith(3, '/platform-sensitive-interface-fields/create', expect.objectContaining({ io_type: 'OUTPUT' }))
  })
})
