import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
vi.mock('@/api/sensitiveFields', () => ({ querySensitiveFields: vi.fn(), searchSensitiveFields: vi.fn(), createSensitiveField: vi.fn(), updateSensitiveField: vi.fn(), deleteSensitiveField: vi.fn(), querySensitiveMappings: vi.fn(), searchSensitiveMappings: vi.fn(), createSensitiveMapping: vi.fn(), updateSensitiveMapping: vi.fn(), deleteSensitiveMapping: vi.fn(), allSensitiveFields: vi.fn(), FIELD_SEARCH_KEYS: ['field_id','field_code','field_label','description'], MAPPING_SEARCH_KEYS: ['field_id','interface_path','interface_name','param_name'] }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn(), warning: vi.fn(), info: vi.fn() }, ElMessageBox: { confirm: vi.fn().mockResolvedValue(true) } }))
import * as api from '@/api/sensitiveFields'
import View from './SensitiveFieldManagementView.vue'
import type { SensitiveFieldDefinition } from '@/types/sensitiveFields'
const field = (id = 'f'): SensitiveFieldDefinition => ({ field_id: id, module: 'PRODUCT', module_name: '产品', field_code: 'price', field_label: '价格', is_derived: false, derived_from_field_ids: [], derived_from_field_labels: [], description: '', sort_no: 0, status: 1, mapping_count: 0, permission_count: 0, updated_at: null, updated_by_name: null })
const stubs = Object.fromEntries(['ElTabs','ElTabPane','ElAlert','ElButton','ElForm','ElFormItem','ElSelect','ElOption','ElInput','ElInputNumber','ElTable','ElTableColumn','ElTag','ElTooltip','ElPagination','ElDialog','ElSwitch'].map(name => [name, { template: '<div><slot/><slot name="footer"/></div>' }]))
stubs.ElTable = { template: '<div />' }; stubs.ElTableColumn = { template: '<div />' }
async function mount() {
  const wrapper = shallowMount(View, { global: { stubs, directives: { loading: {} } } })
  await flushPromises()
  return { wrapper, state: (wrapper.vm as any).$.setupState }
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  vi.mocked(api.querySensitiveFields).mockResolvedValue({ fields: [field()], total: 1, page: 1, page_size: 20 })
  vi.mocked(api.allSensitiveFields).mockResolvedValue([field(), field('dependency')])
  vi.mocked(api.querySensitiveMappings).mockResolvedValue({ interface_fields: [], total: 0, page: 1, page_size: 20 })
  vi.mocked(api.updateSensitiveField).mockResolvedValue({ field_id: 'f', updated_fields: [] })
})
describe('平台敏感管理使用场景', () => {
  it('字段转为原始字段时显式提交空依赖数组', async () => {
    const h = await mount()
    try {
      await h.state.openField({ ...field(), is_derived: true, derived_from_field_ids: ['dependency'] })
      h.state.fieldForm.is_derived = 0; await h.state.saveField()
      expect(api.updateSensitiveField).toHaveBeenCalledWith({ field_id: 'f', is_derived: 0, derived_from_field_ids: [] })
    } finally { h.wrapper.unmount() }
  })
  it('冲突响应保留编辑内容，刷新计数不覆盖草稿', async () => {
    const h = await mount()
    try {
      vi.mocked(api.updateSensitiveField).mockRejectedValueOnce(new Error('字段名称冲突'))
      await h.state.openField(field()); h.state.fieldForm.field_label = '新名称'; await h.state.saveField(); await flushPromises()
      expect(h.state.fieldDialog).toBe(true); expect(h.state.fieldForm.field_label).toBe('新名称')
    } finally { h.wrapper.unmount() }
  })
  it('存在角色引用的原始字段不能转为派生字段', async () => {
    const h = await mount()
    try {
      await h.state.openField({ ...field(), permission_count: 3 })
      h.state.fieldForm.is_derived = 1; h.state.fieldForm.derived_from_field_ids = ['dependency']; await h.state.saveField()
      expect(api.updateSensitiveField).not.toHaveBeenCalled()
    } finally { h.wrapper.unmount() }
  })
  it('映射页保留精确字段上下文，不用OR模糊搜索冒充组合过滤', async () => {
    const h = await mount()
    try {
      h.state.showMappings(field()); await flushPromises()
      expect(api.querySensitiveMappings).toHaveBeenLastCalledWith(expect.objectContaining({ field_id: 'f' }))
      h.state.mapFilters.keyword = '价格'; await h.state.loadMappings()
      expect(api.searchSensitiveMappings).not.toHaveBeenCalled(); expect(h.state.error).toContain('清空字段和精确路径')
    } finally { h.wrapper.unmount() }
  })
})
