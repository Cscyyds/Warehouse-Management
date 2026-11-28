import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import Panel from './TenantSimpleModePanel.vue'
import { ApiError } from '@/api/http'
import type { TenantSimpleMode } from '@/api/platformSimpleMode'

const mocks = vi.hoisted(() => ({ query: vi.fn(), update: vi.fn(), confirm: vi.fn(), success: vi.fn() }))
vi.mock('@/api/platformSimpleMode', () => ({ queryTenantSimpleMode: mocks.query, updateTenantSimpleMode: mocks.update }))
vi.mock('element-plus', () => ({ ElMessageBox: { confirm: mocks.confirm }, ElMessage: { success: mocks.success } }))

const toggle = defineComponent({ props: ['modelValue', 'disabled', 'beforeChange'], template: '<button role="switch" :aria-checked="String(modelValue)" :disabled="disabled" @click="beforeChange()">开关</button>' })
const button = defineComponent({ template: '<button><slot /></button>' })
const state = (extra: Partial<TenantSimpleMode> = {}): TenantSimpleMode => ({ tenant_id: 'tenant', enabled: 0, revision: 6, can_disable: true,
  disable_blockers: [], stock_by_product: [], in_progress_request_count: 0, unfinished_task_count: 0, ...extra })
const render = () => mount(Panel, { props: { tenantId: 'tenant', tenantName: '测试租客' }, global: {
  directives: { loading: () => {} }, stubs: { ElSwitch: toggle, ElButton: button, ElAlert: { props: ['title'], template: '<div>{{ title }}<slot /></div>' } },
} })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.query.mockResolvedValue(state())
  mocks.confirm.mockResolvedValue('confirm')
})

it('确认后提交当前租户和版本，成功后以后端状态显示', async () => {
  mocks.update.mockResolvedValue(state({ enabled: 1, revision: 7 }))
  const wrapper = render(); await flushPromises()
  await wrapper.get('[role="switch"]').trigger('click'); await flushPromises()
  expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ tenant_id: 'tenant', enabled: 1, expected_revision: 6 })
  expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('true')
  wrapper.unmount()
})

it('取消不提交，关闭阻断时保留开关并显示中文原因和精确数量', async () => {
  mocks.confirm.mockRejectedValueOnce('cancel')
  const wrapper = render(); await flushPromises()
  await wrapper.get('[role="switch"]').trigger('click'); await flushPromises()
  expect(mocks.update).not.toHaveBeenCalled()
  wrapper.unmount()
  mocks.query.mockResolvedValue(state({ enabled: 1, can_disable: false, disable_blockers: [{ error_code: 'SIMPLE_STOCK_REMAINS', stock_qty: '0.0001', product_id: 'p', place_type: 'PLASTIC_BOX', place_id: 'box' }] }))
  const blocked = render(); await flushPromises()
  await blocked.get('[role="switch"]').trigger('click'); await flushPromises()
  expect(blocked.text()).toContain('无条码库存未清空')
  expect(blocked.text()).toContain('0.0001')
  expect(blocked.get('[role="switch"]').attributes('aria-checked')).toBe('true')
  expect(mocks.update).not.toHaveBeenCalled()
  blocked.unmount()
})

it('服务端关闭失败时提取阻断明细，失败后不乐观翻转', async () => {
  mocks.query.mockResolvedValue(state({ enabled: 1 }))
  mocks.update.mockRejectedValue(new ApiError('不能关闭', 409, { error_code: 'SIMPLE_MODE_CLOSE_BLOCKED', blockers: [{ error_code: 'SIMPLE_TASK_UNFINISHED', target_id: 'task-1' }] }))
  const wrapper = render(); await flushPromises()
  await wrapper.get('[role="switch"]').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('简易任务尚未完成')
  expect(wrapper.text()).toContain('task-1')
  expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('true')
  wrapper.unmount()
})

it('版本冲突只刷新，不自动重试写入，下次操作使用新版本', async () => {
  mocks.query.mockResolvedValueOnce(state()).mockResolvedValue(state({ revision: 9 }))
  mocks.update.mockRejectedValueOnce(new ApiError('版本冲突', 409, { error_code: 'VERSION_CONFLICT' })).mockResolvedValue(state({ enabled: 1, revision: 10 }))
  const wrapper = render(); await flushPromises()
  await wrapper.get('[role="switch"]').trigger('click'); await flushPromises()
  expect(mocks.update).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('配置已被更新')
  await wrapper.get('[role="switch"]').trigger('click'); await flushPromises()
  expect(mocks.update).toHaveBeenLastCalledWith({ tenant_id: 'tenant', enabled: 1, expected_revision: 9 })
  wrapper.unmount()
})

it('切换租户后丢弃旧查询响应', async () => {
  let resolveOld!: (data: TenantSimpleMode) => void
  mocks.query.mockReturnValueOnce(new Promise<TenantSimpleMode>(resolve => { resolveOld = resolve })).mockResolvedValue(state({ tenant_id: 'other', enabled: 1 }))
  const wrapper = render()
  await wrapper.setProps({ tenantId: 'other' }); await flushPromises()
  resolveOld(state()); await flushPromises()
  expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('true')
  wrapper.unmount()
})

it('确认期间切换租户不会对旧租户提交，查询失败时禁止操作', async () => {
  let confirm!: (value: string) => void
  mocks.confirm.mockReturnValue(new Promise(resolve => { confirm = resolve }))
  const wrapper = render(); await flushPromises()
  await wrapper.get('[role="switch"]').trigger('click')
  mocks.query.mockRejectedValue(new Error('查询失败'))
  await wrapper.setProps({ tenantId: 'other' }); await flushPromises()
  confirm('confirm'); await flushPromises()
  expect(mocks.update).not.toHaveBeenCalled()
  expect(wrapper.get('[role="switch"]').attributes('disabled')).toBeDefined()
  expect(wrapper.text()).toContain('查询失败')
  wrapper.unmount()
})
