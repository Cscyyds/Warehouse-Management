import ElementPlus from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductionManagementView from '@/views/ProductionManagementView.vue'
import { listChannels, queryProductionConfigs } from '@/api/productionManagement'

vi.mock('@/api/productionManagement', () => ({
  PRODUCTION_DOC_OPTIONS: [{ value: 'production-picking', label: '生产领料单' }],
  listChannels: vi.fn(),
  queryProductionConfigs: vi.fn(),
  queryTenantProductionConfig: vi.fn(),
  updateProductionConfig: vi.fn(),
  deleteProductionConfig: vi.fn(),
  listTenantCredentials: vi.fn(),
  updateTenantCredential: vi.fn(),
  testTenantCredential: vi.fn(),
  deleteTenantCredential: vi.fn(),
  triggerProductionSync: vi.fn(),
  fetchProductionBills: vi.fn(),
  querySyncStatus: vi.fn(),
  querySyncLogs: vi.fn(),
}))

describe('ProductionManagementView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listChannels).mockResolvedValue({
      channels: [{
        channel_code: 'TIANXIN',
        channel_name: '天心',
        available: true,
        supported_doc_count: 13,
        credential_fields: [
          { key: 'api_base_url', label: '站点号', required: true, secret: false },
          { key: 'comp_no', label: '账套代号', required: true, secret: false },
          { key: 'usr', label: '登录账号', required: true, secret: false },
          { key: 'pwd', label: '登录密码', required: true, secret: true },
        ],
      }],
    })
    vi.mocked(queryProductionConfigs).mockResolvedValue({
      total: 2,
      page: 1,
      page_size: 20,
      items: [
        {
          tenant_id: 'tenant_001',
          tenant_name: '广州测试租户',
          tenant_status: 1,
          contact_name: '张三',
          contact_phone: '13800000000',
          enabled: 1,
          channel_code: 'TIANXIN',
          channel_name: '天心',
          sync_interval_seconds: 600,
          sync_window_days: 31,
          initial_backfill_days: 365,
          reconcile_days: 90,
          remark: null,
          credential_configured: true,
          credential_status: 1,
          api_base_url: '192.168.1.10:8000',
          updated_at: '2026-09-01 10:00:00',
        },
        {
          tenant_id: 'tenant_002',
          tenant_name: '深圳未开通租户',
          tenant_status: 1,
          contact_name: '李四',
          contact_phone: '13900000000',
          enabled: 0,
          channel_code: null,
          channel_name: null,
          sync_interval_seconds: null,
          sync_window_days: null,
          initial_backfill_days: null,
          reconcile_days: null,
          remark: null,
          credential_configured: false,
          credential_status: null,
          api_base_url: null,
          updated_at: null,
        },
      ],
    })
  })

  it('loads channels and the tenant config overview on mount', async () => {
    const wrapper = mount(ProductionManagementView, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    expect(listChannels).toHaveBeenCalled()
    expect(queryProductionConfigs).toHaveBeenCalledWith({
      keyword: undefined,
      enabled: undefined,
      channel_code: undefined,
      page: 1,
      page_size: 20,
    })
    expect(wrapper.text()).toContain('广州测试租户')
    expect(wrapper.text()).toContain('深圳未开通租户')
    expect(wrapper.text()).toContain('已开启')
    expect(wrapper.text()).toContain('未开启')
    expect(wrapper.text()).toContain('天心')
  })
})
