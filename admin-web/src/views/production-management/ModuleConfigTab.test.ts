import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ModuleConfigTab from './ModuleConfigTab.vue'
import { ApiError } from '@/api/http'
import type { ChannelItem, ProductionConfigDetail } from '@/types/productionManagement'

const { updateProductionConfig } = vi.hoisted(() => ({
  updateProductionConfig: vi.fn(),
}))

vi.mock('@/api/productionManagement', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/productionManagement')>(),
  updateProductionConfig,
  deleteProductionConfig: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

const select = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
})
const option = defineComponent({
  props: ['value', 'label'],
  template: '<option :value="value">{{ label }}</option>',
})
const button = defineComponent({ template: '<button><slot /></button>' })

const channels: ChannelItem[] = [
  { channel_code: 'TIANXIN', channel_name: '天心', available: true, supported_doc_count: 13, credential_fields: [] },
  { channel_code: 'WMS_NATIVE', channel_name: '自研', available: true, supported_doc_count: 3, credential_fields: [] },
]

const syncValues = {
  sync_interval_seconds: 600,
  sync_window_days: 7,
  initial_backfill_days: 365,
  reconcile_days: 90,
}
const config: ProductionConfigDetail = {
  config_id: 'test_config',
  enabled: 1,
  channel_code: 'TIANXIN',
  remark: '保留备注',
  ...syncValues,
}

function mountConfig() {
  return mount(ModuleConfigTab, {
    props: { tenantId: 'test_tenant', channels, config, enabled: true, detailLoaded: true },
    global: {
      stubs: {
        ElForm: { template: '<form><slot /></form>' },
        ElFormItem: { props: ['label'], template: '<div>{{ label }}<slot /></div>' },
        ElSelect: select,
        ElOption: option,
        ElButton: button,
        ElSwitch: true,
        ElInput: true,
        ElInputNumber: true,
        ElDialog: true,
        ElAlert: { props: ['title'], template: '<div>{{ title }}<slot /></div>' },
        ElCheckbox: true,
      },
    },
  })
}

describe('生产模块渠道配置', () => {
  beforeEach(() => {
    updateProductionConfig.mockReset()
    updateProductionConfig.mockResolvedValue({ created: false, warnings: [] })
  })

  it('切换到自研时隐藏同步参数并从保存请求移除天心旧值', async () => {
    const wrapper = mountConfig()
    await wrapper.get('select').setValue('WMS_NATIVE')
    await wrapper.findAll('button').find(item => item.text().includes('保存'))!.trigger('click')

    expect(updateProductionConfig).toHaveBeenCalledExactlyOnceWith({
      tenant_id: 'test_tenant',
      enabled: 1,
      channel_code: 'WMS_NATIVE',
      remark: '保留备注',
    })
    expect(wrapper.text()).not.toContain('同步间隔')
  })

  it('显示渠道切换的阻断类型和数量，筛掉数量为零的任务', async () => {
    updateProductionConfig.mockRejectedValueOnce(new ApiError('更新租户生产模块配置失败', 409, {
      error_code: 'PRODUCTION_CHANNEL_CHANGE_BLOCKED',
      blocking_counts: { 'production-picking': 12, 'finished-goods-stockin': 11, uncertain_erp_tasks: 0 },
    }))
    const wrapper = mountConfig()
    await wrapper.get('select').setValue('WMS_NATIVE')
    await wrapper.findAll('button').find(item => item.text().includes('保存'))!.trigger('click')

    expect(wrapper.text()).toContain('生产渠道暂无法切换')
    expect(wrapper.text()).toContain('生产领料单（12）')
    expect(wrapper.text()).toContain('成品缴库单（11）')
    expect(wrapper.text()).not.toContain('ERP 操作任务')

    await wrapper.get('select').setValue('TIANXIN')
    expect(wrapper.text()).not.toContain('生产渠道暂无法切换')
  })

  it('保存天心渠道时继续传递四项同步参数', async () => {
    const wrapper = mountConfig()
    await wrapper.get('select').setValue('WMS_NATIVE')
    await wrapper.get('select').setValue('TIANXIN')
    await wrapper.findAll('button').find(item => item.text().includes('保存'))!.trigger('click')

    expect(updateProductionConfig).toHaveBeenCalledExactlyOnceWith({
      tenant_id: 'test_tenant',
      enabled: 1,
      channel_code: 'TIANXIN',
      remark: '保留备注',
      ...syncValues,
    })
    expect(wrapper.text()).toContain('同步间隔')
  })
})
