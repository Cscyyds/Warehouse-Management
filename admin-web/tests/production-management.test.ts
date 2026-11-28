import ElementPlus from 'element-plus'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryPlatformTenants } from '@/api/platformQueries'
import { queryTenantMode } from '@/api/tenantMode'
import ProductionManagementView from '@/views/ProductionManagementView.vue'
import ChannelCredentialTab from '@/views/production-management/ChannelCredentialTab.vue'
import type { ChannelItem } from '@/types/productionManagement'
import { listTenantCredentials, updateTenantCredential } from '@/api/productionManagement'

vi.mock('@/api/productionManagement', () => ({
  PRODUCTION_DOC_OPTIONS: [{ value: 'production-picking', label: '生产领料单' }],
  listTenantCredentials: vi.fn(),
  updateTenantCredential: vi.fn(),
  testTenantCredential: vi.fn(),
  deleteTenantCredential: vi.fn(),
  triggerProductionSync: vi.fn(),
  fetchProductionBills: vi.fn(),
  querySyncStatus: vi.fn(),
  querySyncLogs: vi.fn(),
}))

vi.mock('@/api/platformQueries', () => ({ queryPlatformTenants: vi.fn() }))
vi.mock('@/api/tenantMode', () => ({ queryTenantMode: vi.fn(), updateTenantMode: vi.fn() }))

describe('ProductionManagementView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(queryPlatformTenants).mockResolvedValue({ total: 1, tenant: [
      { tenant_code: 'tenant_001', tenant_name: '广州测试租户', tenant_mode: 'LOCAL', tenant_mode_revision: 1 },
    ] })
  })
  it('loads available tenants using the unified mode filter', async () => {
    const wrapper = mount(ProductionManagementView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    expect(queryPlatformTenants).toHaveBeenCalledWith({ page: 1, page_size: 20, keyword: undefined, tenant_mode: undefined })
    expect(wrapper.text()).toContain('广州测试租户')
    expect(wrapper.text()).toContain('本地')
    wrapper.unmount()
  })
  it('disables mode writes when the detail query fails', async () => {
    vi.mocked(queryTenantMode).mockRejectedValue(new Error('mode query failed'))
    const wrapper = mount(ProductionManagementView, { global: { plugins: [ElementPlus] }, attachTo: document.body })
    await flushPromises()
    const configure = wrapper.findAll('button').find(button => button.text().includes('配置'))!
    await configure.trigger('click')
    await flushPromises()
    expect(queryTenantMode).toHaveBeenCalledWith('tenant_001')
    const save = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('确认保存模式'))!
    expect(save.disabled).toBe(true)
    expect(document.body.textContent).toContain('模式信息尚未加载成功')
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
