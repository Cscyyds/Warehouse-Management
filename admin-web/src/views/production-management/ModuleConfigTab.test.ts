import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ModuleConfigTab from './ModuleConfigTab.vue'
import { ApiError } from '@/api/http'
import { updateTenantMode, type TenantModeInfo } from '@/api/tenantMode'
vi.mock('@/api/tenantMode', () => ({ updateTenantMode: vi.fn() }))
vi.mock('element-plus', () => ({ ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))
const select = defineComponent({ props: ['modelValue'], emits: ['update:modelValue'],
  template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>' })
const info: TenantModeInfo = { tenant_id: 't', tenant_mode: 'LOCAL', tenant_mode_revision: 7,
  migration_required: false, available_modules: ['FINANCE'], can_switch: true, switch_blockers: {},
  sync_ready: false, sync_readiness_reasons: [], credential_ready: false }
const result = { tenant_id: 't', old_mode: 'LOCAL' as const, tenant_mode: 'TIANXIN' as const,
  tenant_mode_revision: 7, dry_run: true, changed: true, can_switch: true, switch_blockers: {}, available_modules: ['PRODUCTION'] }
function mountConfig() {
  return mount(ModuleConfigTab, { props: { tenantId: 't', info, loaded: true }, global: { stubs: {
    ElSelect: select, ElOption: { props: ['value', 'label'], template: '<option :value="value">{{ label }}</option>' },
    ElForm: { template: '<form><slot /></form>' }, ElFormItem: { template: '<div><slot /></div>' },
    ElButton: { props: ['disabled'], template: '<button :disabled="disabled" type="button"><slot /></button>' },
    ElAlert: { props: ['title'], template: '<div>{{ title }}</div>' },
  } } })
}
describe('unified tenant mode', () => {
  beforeEach(() => vi.mocked(updateTenantMode).mockReset())
  it('requires preview and submits the same revision without old switch fields', async () => {
    vi.mocked(updateTenantMode).mockResolvedValue(result)
    const wrapper = mountConfig()
    await wrapper.get('select').setValue('TIANXIN')
    expect(wrapper.findAll('button')[1].attributes('disabled')).toBeDefined()
    await wrapper.findAll('button')[0].trigger('click'); await flushPromises()
    expect(updateTenantMode).toHaveBeenLastCalledWith({ tenant_id: 't', tenant_mode: 'TIANXIN', expected_revision: 7, dry_run: true })
    expect(wrapper.findAll('button')[1].attributes('disabled')).toBeUndefined()
    await wrapper.findAll('button')[1].trigger('click'); await flushPromises()
    expect(updateTenantMode).toHaveBeenLastCalledWith({ tenant_id: 't', tenant_mode: 'TIANXIN', expected_revision: 7, dry_run: false })
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })
  it('keeps save disabled when the preview is blocked', async () => {
    vi.mocked(updateTenantMode).mockResolvedValue({ ...result, can_switch: false, switch_blockers: { purchase_receipts: 2 } })
    const wrapper = mountConfig(); await wrapper.get('select').setValue('TIANXIN')
    await wrapper.findAll('button')[0].trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('purchase_receipts：2')
    expect(wrapper.findAll('button')[1].attributes('disabled')).toBeDefined()
  })
  it('invalidates a passed preview when target or revision changes', async () => {
    vi.mocked(updateTenantMode).mockResolvedValue(result)
    const wrapper = mountConfig(); await wrapper.get('select').setValue('TIANXIN')
    await wrapper.findAll('button')[0].trigger('click'); await flushPromises()
    await wrapper.setProps({ info: { ...info, tenant_mode_revision: 8 } })
    expect(wrapper.findAll('button')[1].attributes('disabled')).toBeDefined()
    expect(updateTenantMode).toHaveBeenCalledTimes(1)
  })
  it('refreshes after a commit conflict and requires another preview', async () => {
    vi.mocked(updateTenantMode).mockResolvedValueOnce(result).mockRejectedValueOnce(new ApiError('?????', 409, { error_code: 'TENANT_MODE_VERSION_CONFLICT' }))
    const wrapper = mountConfig(); await wrapper.get('select').setValue('TIANXIN')
    await wrapper.findAll('button')[0].trigger('click'); await flushPromises()
    await wrapper.findAll('button')[1].trigger('click'); await flushPromises()
    expect(wrapper.emitted('changed')).toHaveLength(1)
    expect(wrapper.findAll('button')[1].attributes('disabled')).toBeDefined()
    expect(updateTenantMode).toHaveBeenCalledTimes(2)
  })
})
