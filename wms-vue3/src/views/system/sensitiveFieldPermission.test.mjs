import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import * as drafts from '../../utils/sensitivePermissionDraft.ts'

const { descriptor } = parse(readFileSync(new URL('./SensitiveFieldPermission.vue', import.meta.url), 'utf8'))
const compiled = compileScript(descriptor, { id: 'sensitive-permission-test' })
const output = ts.transpileModule(compiled.content, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const renderer = Vue.createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null,
})
const tick = async () => { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const field = id => ({ field_id: id, field_label: id, is_derived: false, derived_from_field_labels: [], view_interfaces: [], update_interfaces: [] })
const tree = [{ module: 'PRODUCT', module_name: '产品', fields: [field('price')] }, { module: 'SALES', module_name: '销售', fields: [field('amount')] }]

async function mount(overrides = {}) {
  const saved = ['window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  globalThis.window = new EventTarget(); globalThis.localStorage = { getItem: () => 'test-session' }
  const writes = [], errors = [], callbacks = {}, confirmations = []
  let persisted = overrides.initialPermissions ?? []
  const api = {
    getSensitiveFieldTree: async () => ({ data: { tree } }),
    getRoleSensitivePermissions: async id => ({ data: { role_id: id, permissions: persisted } }),
    saveRoleSensitivePermissions: async (id, payload) => { persisted = payload; writes.push({ id, payload }) },
    getDerivedSensitiveFields: async id => ({ data: { field_id: id, derived_fields: [] } }),
    ...overrides,
  }
  const imports = {
    vue: Vue,
    'vue-router': { useRoute: () => ({ query: {} }), onBeforeRouteLeave: fn => { callbacks.leave = fn } },
    'element-plus': { ElMessage: { success() {} }, ElMessageBox: { confirm: async message => { confirmations.push(message); return overrides.confirm ? overrides.confirm(message) : true } } },
    '@/views/common/ListTemplate.vue': {}, '@/views/common/SensitiveImpactList.vue': {},
    '@/api/modules/role': { getRoleList: async () => ({ data: { role: [{ role_code: 'r1', role_name: '角色一' }], total: 1 } }), getRoleDetail: async () => ({ data: { role: [] } }) },
    '@/api/utils/fetchAllPages': { fetchAllPages: ({ fetchPage }) => fetchPage({ page: 1, page_size: 100 }) },
    '@/api/modules/sensitiveField': api,
    '@/utils/sensitivePermissionDraft': drafts,
    '@/utils/importTask': { importRequestError: error => error.message ?? String(error) },
    '@/stores/permission': { usePermissionStore: () => ({ hasUrlPerm: () => true }) },
    '@/stores/sensitiveField': { useSensitiveFieldStore: () => ({ invalidate() {} }) },
  }
  const exports = {}
  new Function('require', 'exports', output)(name => { assert.ok(name in imports, name); return imports[name] }, exports)
  const component = exports.default
  component.render = () => null
  const app = renderer.createApp(component)
  app.config.warnHandler = message => errors.push(message)
  const vm = app.mount({})
  await tick()
  return { state: vm.$.setupState, writes, callbacks, confirmations,
    close: () => { app.unmount(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] } },
  }
}

test('模块筛选后的保存仍发送完整限制集合和角色编码', async () => {
  const h = await mount()
  try {
    await h.state.selectRole('r1')
    h.state.draft.price = 1; h.state.draft.amount = 2; h.state.moduleFilter = 'PRODUCT'
    assert.equal(h.state.filtered.length, 1)
    assert.equal(await h.state.save(), true)
    assert.deepEqual(h.writes, [{ id: 'r1', payload: [{ field_id: 'price', restriction_type: 1 }, { field_id: 'amount', restriction_type: 2 }] }])
    assert.equal(h.state.changes.count, 0)
  } finally { h.close() }
})

test('快速切换角色时迟到响应不会覆盖当前角色草稿', async () => {
  const requests = new Map()
  const h = await mount({ getRoleSensitivePermissions: id => { const request = deferred(); requests.set(id, request); return request.promise } })
  try {
    const first = h.state.selectRole('r1'); await tick()
    const second = h.state.selectRole('r2'); await tick()
    requests.get('r2').resolve({ data: { role_id: 'r2', permissions: [{ field_id: 'amount', restriction_type: 2 }] } }); await second
    requests.get('r1').resolve({ data: { role_id: 'r1', permissions: [{ field_id: 'price', restriction_type: 1 }] } }); await first
    assert.equal(h.state.roleId, 'r2'); assert.deepEqual({ ...h.state.draft }, { amount: 2 })
  } finally { h.close() }
})

test('角色配置不完整时不将其当作空限制提交', async () => {
  const h = await mount({ getRoleSensitivePermissions: async id => ({ data: { role_id: id } }) })
  try {
    await h.state.selectRole('r1'); h.state.draft.price = 1
    assert.equal(h.state.ready, false); assert.equal(await h.state.save(), false); assert.equal(h.writes.length, 0)
  } finally { h.close() }
})

test('保存前发现他人修改时停止写入，保留本地草稿', async () => {
  let calls = 0
  const h = await mount({ getRoleSensitivePermissions: async id => ({ data: { role_id: id, permissions: ++calls === 1 ? [] : [{ field_id: 'amount', restriction_type: 2 }] } }) })
  try {
    await h.state.selectRole('r1'); h.state.draft.price = 1
    assert.equal(await h.state.save(), false); assert.equal(h.writes.length, 0)
    assert.equal(h.state.draft.price, 1); assert.match(h.state.error, /其他人修改/)
  } finally { h.close() }
})

test('清空全部确认一次，显式提交空数组并回查', async () => {
  const h = await mount({ initialPermissions: [{ field_id: 'price', restriction_type: 1 }] })
  try {
    await h.state.selectRole('r1'); await h.state.clearAll()
    assert.equal(h.confirmations.length, 1)
    assert.deepEqual(h.writes, [{ id: 'r1', payload: [] }])
    assert.equal(h.state.changes.count, 0)
  } finally { h.close() }
})

test('树外既有配置必须核对移除后才允许保存', async () => {
  const h = await mount({ initialPermissions: [{ field_id: 'unavailable', field_label: '停用价格', restriction_type: 1 }] })
  try {
    await h.state.selectRole('r1')
    assert.equal(await h.state.save(), false); assert.equal(h.writes.length, 0)
    await h.state.removeUnavailable(); await h.state.save()
    assert.equal(h.confirmations.length, 2)
    assert.deepEqual(h.writes, [{ id: 'r1', payload: [] }])
  } finally { h.close() }
})

test('清空确认期间不切换角色，确认只作用于发起操作的角色', async () => {
  const confirmation = deferred()
  const h = await mount({ initialPermissions: [{ field_id: 'price', restriction_type: 1 }], confirm: () => confirmation.promise })
  try {
    await h.state.selectRole('r1')
    const pending = h.state.clearAll(); await tick()
    await h.state.selectRole('r2')
    assert.equal(h.state.roleId, 'r1')
    confirmation.resolve(true); await pending
    assert.deepEqual(h.writes, [{ id: 'r1', payload: [] }])
  } finally { h.close() }
})
