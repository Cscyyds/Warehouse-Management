import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import SyncParametersTab from './SyncParametersTab.vue'
import { querySyncSettings, updateSyncSettings, type SyncModule } from '@/api/tenantMode'
vi.mock('@/api/tenantMode', () => ({ querySyncSettings: vi.fn(), updateSyncSettings: vi.fn() }))
vi.mock('element-plus', () => ({ ElMessage: { success: vi.fn(), warning: vi.fn() } }))
const effective = { sync_interval_seconds: 600, sync_window_days: 31, initial_backfill_days: 365, reconcile_days: 90 }
const modules: SyncModule[] = ['PURCHASE_SALES', 'BORROW', 'OTHER_INBOUND', 'PRODUCTION']
const settings = modules.map(module_code => ({ module_code, ...effective, sync_interval_seconds: null, effective }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(querySyncSettings).mockResolvedValue({ tenant_id: 't', tenant_mode: 'TIANXIN', settings })
  vi.mocked(updateSyncSettings).mockResolvedValue({ ...settings[1], sync_interval_seconds: 900, effective: { ...effective, sync_interval_seconds: 900 } })
})
function mountPanel() {
  return mount(SyncParametersTab, { props: { tenantId: 't', dataVersion: 0 }, global: {
    directives: { loading() {} },
    stubs: {
      ElAlert: { props: ['title'], template: '<div>{{ title }}</div>' },
      ElForm: { template: '<form><slot /></form>' }, ElFormItem: { template: '<div><slot /></div>' },
      ElButton: { props: ['disabled'], template: '<button type="button" :disabled="disabled"><slot /></button>' },
      ElInputNumber: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />' },
    },
  } })
}
it('shows effective defaults and updates only the selected module', async () => {
  const wrapper = mountPanel(); await flushPromises()
  const borrow = wrapper.findAll('section')[1]
  expect(borrow.find('input').element.value).toBe('600')
  await borrow.find('input').setValue('900')
  await borrow.find('button').trigger('click'); await flushPromises()
  expect(updateSyncSettings).toHaveBeenCalledExactlyOnceWith({ tenant_id: 't', module_code: 'BORROW', ...effective, sync_interval_seconds: 900 })
  expect(wrapper.findAll('section')[0].find('input').element.value).toBe('600')
})
it('does not allow an unloaded settings form to submit', async () => {
  vi.mocked(querySyncSettings).mockRejectedValueOnce(new Error('settings unavailable'))
  const wrapper = mountPanel(); await flushPromises()
  expect(wrapper.findAll('section')).toHaveLength(0)
  expect(wrapper.text()).toContain('settings unavailable')
  expect(updateSyncSettings).not.toHaveBeenCalled()
})
