import { createPinia } from 'pinia'
import ElementPlus, { ElSelect, ElSwitch } from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TenantOnboardingView from '@/views/TenantOnboardingView.vue'
import { queryPlatformTenants } from '@/api/platformQueries'
import { createTenant } from '@/api/platformTenants'

vi.mock('@/api/platformQueries', () => ({
  queryPlatformTenants: vi.fn(),
}))

vi.mock('@/api/platformTenants', () => ({
  createTenant: vi.fn(),
  createTenantSubscription: vi.fn(),
}))

describe('TenantOnboardingView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(queryPlatformTenants).mockResolvedValue({ total: 0, tenant: [] })
  })

  it('requeries tenant options whenever the tenant selector opens', async () => {
    const wrapper = mount(TenantOnboardingView, {
      global: {
        plugins: [createPinia(), ElementPlus],
      },
    })

    await flushPromises()
    expect(queryPlatformTenants).toHaveBeenCalledTimes(1)

    wrapper.findAllComponents(ElSelect).find(select => select.props('filterable'))!.vm.$emit('visible-change', true)
    await flushPromises()

    expect(queryPlatformTenants).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it.each([false, true])('submits a required unified mode and integer simple-mode flag (%s)', async simpleMode => {
    vi.mocked(createTenant).mockResolvedValue({ id: 1, tenant_code: 'new_tenant', tenant_name: '测试租户', status: 1, tenant_mode: 'TIANXIN' })
    const wrapper = mount(TenantOnboardingView, { global: { plugins: [createPinia(), ElementPlus] } })
    await flushPromises()
    await wrapper.get('input[placeholder="例如：华东配送中心"]').setValue('测试租户')
    await wrapper.get('input[placeholder="负责人姓名"]').setValue('负责人')
    await wrapper.get('input[placeholder="手机或座机"]').setValue('13800000000')
    wrapper.findAllComponents(ElSelect)[0].vm.$emit('update:modelValue', 'TIANXIN')
    wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', simpleMode)
    await wrapper.findAll('button').find(button => button.text().includes('创建租客并生成编码'))!.trigger('click')
    await flushPromises()
    expect(createTenant).toHaveBeenCalledExactlyOnceWith({
      tenant_name: '测试租户', contact_name: '负责人', contact_phone: '13800000000', contact_email: undefined,
      tenant_mode: 'TIANXIN', simple_mode_enabled: simpleMode ? 1 : 0,
    })
    wrapper.unmount()
  })
})
