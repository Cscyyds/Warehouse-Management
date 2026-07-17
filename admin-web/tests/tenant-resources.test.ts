import { createPinia } from 'pinia'
import ElementPlus, { ElSelect } from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TenantResourcesView from '@/views/TenantResourcesView.vue'
import {
  queryPlatformTenants,
  queryTenantEnumMappings,
  queryTenantOrganizations,
  queryTenantPosts,
  queryTenantRoles,
} from '@/api/platformQueries'

vi.mock('@/api/platformQueries', () => ({
  queryPlatformTenants: vi.fn(),
  queryTenantEnumMappings: vi.fn(),
  queryTenantOrganizations: vi.fn(),
  queryTenantPosts: vi.fn(),
  queryTenantRoles: vi.fn(),
}))

vi.mock('@/api/platformTenantResources', () => ({
  createOrganization: vi.fn(),
  createPost: vi.fn(),
  createUser: vi.fn(),
}))

describe('TenantResourcesView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(queryPlatformTenants).mockResolvedValue({ total: 1, tenant: [{ tenant_code: 'tc_test', tenant_name: '测试租客' }] })
    vi.mocked(queryTenantOrganizations).mockResolvedValue({ total: 0, org: [] })
    vi.mocked(queryTenantPosts).mockResolvedValue({ total: 0, post: [] })
    vi.mocked(queryTenantRoles).mockResolvedValue({ total: 0, role: [] })
    vi.mocked(queryTenantEnumMappings).mockResolvedValue({ total: 0, items: [] })
  })

  it('requeries tenant resources whenever their selectors open', async () => {
    const wrapper = mount(TenantResourcesView, {
      global: {
        plugins: [createPinia(), ElementPlus],
      },
    })

    await flushPromises()

    const tenantSelector = wrapper.findAllComponents(ElSelect)
      .find((component) => component.props('placeholder') === '选择可用租客')
    expect(tenantSelector).toBeDefined()
    tenantSelector!.vm.$emit('change', 'tc_test')
    await flushPromises()

    vi.mocked(queryTenantOrganizations).mockClear()
    const organizationSelector = wrapper.findAllComponents(ElSelect)
      .find((component) => component.props('placeholder') === '选择所属组织')
    expect(organizationSelector).toBeDefined()
    organizationSelector!.vm.$emit('visible-change', true)
    await flushPromises()

    expect(queryTenantOrganizations).toHaveBeenCalledOnce()
    expect(queryTenantOrganizations).toHaveBeenCalledWith('tc_test')

    vi.mocked(queryTenantPosts).mockClear()
    const postSelector = wrapper.findAllComponents(ElSelect)
      .find((component) => component.props('placeholder') === '选择所属岗位')
    expect(postSelector).toBeDefined()
    postSelector!.vm.$emit('visible-change', true)
    await flushPromises()

    expect(queryTenantPosts).toHaveBeenCalledOnce()
    expect(queryTenantPosts).toHaveBeenCalledWith('tc_test')

    vi.mocked(queryTenantRoles).mockClear()
    const roleSelector = wrapper.findAllComponents(ElSelect)
      .find((component) => component.props('placeholder') === '选择可用角色')
    expect(roleSelector).toBeDefined()
    roleSelector!.vm.$emit('visible-change', true)
    await flushPromises()

    expect(queryTenantRoles).toHaveBeenCalledOnce()
    expect(queryTenantRoles).toHaveBeenCalledWith('tc_test')
  })
})
