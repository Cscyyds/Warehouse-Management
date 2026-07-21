import ElementPlus from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TenantOverviewView from '@/views/TenantOverviewView.vue'
import { queryTenantOverview } from '@/api/platformTenantOverview'

vi.mock('@/api/platformTenantOverview', () => ({
  queryTenantOverview: vi.fn(),
  queryPlatformTenantEmployees: vi.fn(),
  queryPlatformTenantOrganizations: vi.fn(),
  queryPlatformTenantPosts: vi.fn(),
  queryPlatformTenantRoles: vi.fn(),
  queryPlatformTenantWarehouses: vi.fn(),
}))

describe('TenantOverviewView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(queryTenantOverview).mockResolvedValue({
      total: 1,
      page: 1,
      page_size: 20,
      tenant: [{
        id: 1,
        tenant_code: 'tenant_001',
        tenant_name: '测试租客',
        contact_name: '张三',
        contact_phone: '13800000000',
        status: 1,
        created_at: '2026-01-01T10:00:00',
        current_subscription: {
          id: 1,
          subscription_id: 'subscription_001',
          start_at: '2026-01-01T00:00:00',
          end_at: '2026-12-31T23:59:59',
          max_user_count: 100,
          max_warehouse_count: 10,
          storage_quota_gb: 50,
          status: 1,
          subscription_state: 'ACTIVE',
        },
        statistics: {
          employee_total_count: 36,
          active_employee_count: 32,
          warehouse_total_count: 4,
          active_warehouse_count: 3,
          organization_count: 6,
          post_count: 12,
          role_count: 5,
          assigned_permission_count: 28,
        },
      }],
    })
  })

  it('loads and renders current subscription and quota aggregates', async () => {
    const wrapper = mount(TenantOverviewView, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    expect(queryTenantOverview).toHaveBeenCalledWith({
      keyword: undefined,
      tenant_status: undefined,
      subscription_state: undefined,
      page: 1,
      page_size: 20,
      sort_by: 'created_at',
      sort_order: 'DESC',
    })
    expect(wrapper.text()).toContain('测试租客')
    expect(wrapper.text()).toContain('订购生效中')
    expect(wrapper.text()).toContain('32')
    expect(wrapper.text()).toContain('100')
    expect(wrapper.text()).toContain('50')
  })
})
