import { createPinia } from 'pinia'
import ElementPlus, { ElSelect } from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TenantOnboardingView from '@/views/TenantOnboardingView.vue'
import { queryPlatformTenants } from '@/api/platformQueries'

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

    wrapper.findComponent(ElSelect).vm.$emit('visible-change', true)
    await flushPromises()

    expect(queryPlatformTenants).toHaveBeenCalledTimes(2)
  })
})
