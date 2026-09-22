import ElementPlus from 'element-plus'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductionManagementView from '@/views/ProductionManagementView.vue'
import ChannelCredentialTab from '@/views/production-management/ChannelCredentialTab.vue'
import type { ChannelItem } from '@/types/productionManagement'
import { listChannels, queryProductionConfigs, queryTenantProductionConfig, listTenantCredentials, updateTenantCredential } from '@/api/productionManagement'

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
          { key: 'api_scheme', label: '站点协议', required: true, secret: false, widget: 'scheme' },
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

  it('加载详情失败时禁用保存，避免把「加载失败」当成「未配置」而误改', async () => {
    vi.mocked(queryTenantProductionConfig).mockRejectedValue(new Error('config query failed'))
    // el-drawer 默认 teleport 到 body，故挂到 document 上后再从 DOM 取按钮
    const wrapper = mount(ProductionManagementView, {
      global: { plugins: [ElementPlus] },
      attachTo: document.body,
    })
    await flushPromises()

    const configButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('配置'))
    expect(configButton).toBeTruthy()
    ;(configButton as HTMLButtonElement).click()
    await flushPromises()

    expect(queryTenantProductionConfig).toHaveBeenCalledWith('tenant_001')

    const saveButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('保存配置'))
    expect(saveButton).toBeTruthy()
    // 详情查询失败 → 表单按「未配置 / enabled=0」渲染，若不拦住，一点保存就把已开通的模块关掉
    expect((saveButton as HTMLButtonElement).disabled).toBe(true)
    expect(document.body.textContent).toContain('配置尚未加载成功')

    wrapper.unmount()
  })
})

const TIANXIN_CHANNEL: ChannelItem = {
  channel_code: 'TIANXIN',
  channel_name: '天心',
  available: true,
  supported_doc_count: 13,
  credential_fields: [
    { key: 'api_scheme', label: '站点协议', required: true, secret: false, widget: 'scheme' },
    { key: 'api_base_url', label: '站点号', required: true, secret: false },
    { key: 'comp_no', label: '账套代号', required: true, secret: false },
    { key: 'usr', label: '登录账号', required: true, secret: false },
    { key: 'pwd', label: '登录密码', required: true, secret: true },
  ],
}

describe('ChannelCredentialTab 站点协议前缀', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listTenantCredentials).mockResolvedValue({
      tenant_id: 'tenant_001', tenant_name: '广州测试租户', total: 0, items: [],
    })
    vi.mocked(updateTenantCredential).mockResolvedValue({
      tenant_id: 'tenant_001', channel_code: 'TIANXIN', credential_id: 'tcc_1', pwd_changed: true,
    })
  })

  it('新增凭证默认 http，选择后按 https 提交，且 api_scheme 不混入 auth_payload', async () => {
    const wrapper = mount(ChannelCredentialTab, {
      global: { plugins: [ElementPlus] },
      attachTo: document.body,
      props: { tenantId: 'tenant_001', channels: [TIANXIN_CHANNEL], dataVersion: 0 },
    })
    await flushPromises()

    const createButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('新增凭证'))
    expect(createButton).toBeTruthy()
    ;(createButton as HTMLButtonElement).click()
    await flushPromises()

    // 协议下拉默认 http（弹窗内第二个 el-select，第一个是接入渠道）；
    // 点开选 https://（el-select 下拉项 teleport 到 body）
    const schemeSelect = Array.from(document.querySelectorAll('.el-select'))[1]
    expect(schemeSelect.querySelector('.el-select__placeholder')?.textContent).toContain('http')
    ;(schemeSelect.querySelector('.el-select__wrapper') as HTMLElement).click()
    await flushPromises()
    const httpsOption = Array.from(document.querySelectorAll('.el-select-dropdown__item'))
      .find((item) => item.textContent?.includes('https'))
    ;(httpsOption as HTMLElement).click()
    await flushPromises()

    // 弹窗 teleport 到 body；按序填站点号/账套/账号/密码（scheme 下拉的 input 不算文本字段）
    const inputs = Array.from(document.querySelectorAll('.el-dialog input')) as HTMLInputElement[]
    const textInputs = inputs.filter((input) => !input.closest('.el-select'))
    const [site, compNo, usr, pwd] = textInputs
    await new DOMWrapper(site).setValue('192.168.1.10:8000')
    await new DOMWrapper(compNo).setValue('ZS')
    await new DOMWrapper(usr).setValue('DG001')
    await new DOMWrapper(pwd).setValue('secret')

    const saveButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('保存凭证'))
    ;(saveButton as HTMLButtonElement).click()
    await flushPromises()

    expect(updateTenantCredential).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant_001',
      api_scheme: 'https',
      api_base_url: '192.168.1.10:8000',
    }))
    const authPayload = vi.mocked(updateTenantCredential).mock.calls[0][0].auth_payload
    expect(JSON.parse(authPayload)).toEqual({ comp_no: 'ZS', usr: 'DG001', pwd: 'secret' })

    wrapper.unmount()
  })
})
