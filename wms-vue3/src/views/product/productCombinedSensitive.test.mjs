import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import * as paths from '../../utils/sensitiveFields.ts'
import * as prices from '../../utils/componentPrices.ts'

const transpile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const compile = file => transpile(compileScript(parse(readFileSync(new URL(file, import.meta.url), 'utf8')).descriptor, { id: file }).content)
const moduleFrom = (code, imports) => { const exports = {}; new Function('require', 'exports', code)(name => imports[name], exports); return exports }
const renderer = Vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
const tick = async () => { for (let i = 0; i < 8; i++) { await Promise.resolve(); await Vue.nextTick() } }
const tree = () => [{ component_id: 'c1', component_product_id: 'child', num: 1, unit_price: '12', remark: '旧', components: [{ component_id: 'deep', component_product_id: 'deep', num: 2, unit_price: '4', components: [] }] }]

async function mount(options = {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'); globalThis.localStorage = { getItem: key => key === 'token' ? 'session' : null, setItem() {} }
  let restriction = options.restriction ?? '', session = 'session'
  globalThis.localStorage.getItem = key => key === 'token' ? session : null
  const calls = [], errors = []
  const store = Vue.reactive({ entries: new Map(), revision: 0, normalizePath: path => path, load: async path => {
    const fields = path.endsWith('/preview') && restriction === 'hidden' ? [{ io_type: 'OUTPUT', restriction_type: 1, param_name: 'components[].unit_price' }] : path.endsWith('/update') && restriction === 'readonly' ? [{ io_type: 'INPUT', restriction_type: 2, param_name: 'items[].unit_price' }] : []
    const state = { status: 'ready', fields }; store.entries.set(path, state); return state
  } })
  const fields = moduleFrom(transpile(readFileSync(new URL('../../composables/useSensitiveFields.ts', import.meta.url), 'utf8')), { vue: Vue, '@/stores/sensitiveField': { useSensitiveFieldStore: () => store }, '@/utils/sensitiveFields': paths })
  const api = {
    previewComponentTree: async id => ({ data: { product_id: id, product_code: 'P1', product_name: '组合', is_combined: 1, components: tree() } }),
    getProductDetail: async () => ({ data: { min_sale_price: '2' } }),
    bindProductComponents: async (...args) => { calls.push({ name: 'create', args }); if (options.changeSessionAfterCreate) session = 'other' },
    updateProductComponents: async (...args) => { calls.push({ name: 'update', args }); if (options.failUpdate) throw Object.assign(new Error('更新失败'), { response: { status: 400 } }) },
    deleteProductComponent: async (...args) => calls.push({ name: 'delete', args }), updateProduct: async () => {},
  }
  const route = Vue.reactive({ params: { id: 'p1' }, fullPath: '/product/combined/p1' })
  const imports = { vue: Vue, 'vue-router': { useRoute: () => route, useRouter: () => ({ back() {}, push() {} }) }, 'element-plus': { ElMessage: { success() {}, warning: value => errors.push(value), error: value => errors.push(value), info() {} }, ElMessageBox: { confirm: options.confirm ?? (async () => true) } }, '@element-plus/icons-vue': {}, '@/api': api, '@/utils/data': {}, '@/composables/useSensitiveFields': fields, '@/utils/componentPrices': prices, '@/utils/sensitiveFields': paths }
  const module = {}; new Function('require', 'exports', compile('./ProductCombinedDetail.vue'))(name => name.endsWith('.vue') ? {} : (assert.ok(name in imports, name), imports[name]), module)
  module.default.render = () => null; const app = renderer.createApp(module.default); app.config.warnHandler = () => {}; const vm = app.mount({}); await tick()
  return { s: vm.$.setupState, calls, errors, route, restrict: value => { restriction = value }, deactivate() { vm.$.da.forEach(hook => hook()) }, close() { app.unmount(); if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage } }
}

test('解除一项绑定保留其他行未保存草稿，不用整页重拉清空草稿', async () => {
  const h = await mount()
  try {
    h.s.onProductsPicked([{ product_id: 'new', min_sale_price: '5' }]); await tick()
    h.s.rows[1].remark = '其他未保存备注'
    await h.s.handleRemove(h.s.rows[0], 0)
    assert.deepEqual(h.calls.map(call => call.name), ['delete'])
    assert.equal(h.s.rows.length, 1); assert.equal(h.s.rows[0].component_product_id, 'new')
    assert.equal(h.s.rows[0].remark, '其他未保存备注'); assert.equal(h.s.dirtyRowCount, 1)
  } finally { h.close() }
})

test('解除确认等待中防重复，页面失活后确认不再执行后台删除', async () => {
  let confirm, confirmations = 0
  const confirmation = new Promise(resolve => { confirm = resolve })
  const h = await mount({ confirm: () => { confirmations++; return confirmation } })
  try {
    const pending = h.s.handleRemove(h.s.rows[0], 0); await tick()
    const duplicate = h.s.handleRemove(h.s.rows[0], 0); await tick()
    h.deactivate(); confirm(true); await Promise.all([pending, duplicate])
    assert.equal(confirmations, 1)
    assert.deepEqual(h.calls, [])
  } finally { h.close() }
})

test('组合新增绑定后切换登录不继续写入已有绑定，并阻止旧草稿重试', async () => {
  const h = await mount({ changeSessionAfterCreate: true })
  try {
    h.s.onProductsPicked([{ product_id: 'new', min_sale_price: '5' }]); await tick()
    h.s.rows[0].remark = '改动'; h.s.markDirty(h.s.rows[0]); await h.s.handleSave()
    assert.deepEqual(h.calls.map(call => call.name), ['create']); assert.equal(h.s.needsReload, true)
  } finally { h.close() }
})

test('组合详情隐藏价格贯穿所有层级，数量和备注编辑不验证或回传缺失价格', async () => {
  const h = await mount({ restriction: 'hidden' })
  try {
    assert.equal(h.s.showUnitPrice, false); assert.equal(Object.hasOwn(h.s.rows[0], 'unit_price'), false)
    assert.equal(Object.hasOwn(h.s.safeTreeRows[0].components[0], 'unit_price'), false)
    const row = h.s.rows[0]; row.num = 3; row.remark = '新'; h.s.markDirty(row)
    await h.s.handleSave()
    assert.deepEqual(h.calls, [{ name: 'update', args: [[{ component_id: 'c1', num: 3, remark: '新' }]] }])
    await h.s.handleRemove(h.s.rows[0], 0); assert.equal(h.calls.length, 1)
  } finally { h.close() }
})

test('组合单价只读时保留原值，纯备注更新省略数量和单价', async () => {
  const h = await mount({ restriction: 'readonly' })
  try {
    assert.equal(h.s.showUnitPrice, true); assert.equal(h.s.canEditUnitPrice, false); assert.equal(h.s.rows[0].unit_price, '12')
    h.s.rows[0].remark = ''; h.s.markDirty(h.s.rows[0]); await h.s.handleSave()
    assert.deepEqual(h.calls[0].args[0], [{ component_id: 'c1', remark: '' }])
  } finally { h.close() }
})

test('保存前权限收紧禁止新增绑定，固定标签主键不跟随其他组合路由变化', async () => {
  const h = await mount()
  try {
    h.s.onProductsPicked([{ product_id: 'new', min_sale_price: '5' }]); await tick()
    h.restrict('hidden'); await h.s.handleSave(); assert.deepEqual(h.calls, [])
    h.route.params.id = 'other'; await tick(); assert.equal(h.s.productId, 'p1')
  } finally { h.close() }
})

test('新增成功后更新失败保留草稿并阻止重复新增', async () => {
  const h = await mount({ failUpdate: true })
  try {
    h.s.onProductsPicked([{ product_id: 'new', min_sale_price: '5' }]); await tick()
    h.s.rows[0].remark = '新'; h.s.markDirty(h.s.rows[0]); await h.s.handleSave()
    assert.equal(h.s.needsReload, true); assert.deepEqual(h.calls.map(call => call.name), ['create', 'update'])
    await h.s.handleSave(); assert.equal(h.calls.length, 2)
  } finally { h.close() }
})

test('图形缺价保持未知、零价正常显示；缺任一价格时不显示金额合计', () => {
  const imports = { vue: { ...Vue, onMounted() {}, onBeforeUnmount() {} }, '@/utils/componentPrices': prices }
  const module = moduleFrom(compile('./ComboStructureGraph.vue'), imports); module.default.render = () => null
  const app = renderer.createApp(module.default, { root: { product_id: 'p' }, nodes: [{ ...tree()[0], unit_price: '0', components: [{ component_product_id: 'missing', num: 1 }] }], pricesVisible: true })
  app.config.warnHandler = () => {}; const vm = app.mount({}), s = vm.$.setupState
  try {
    s.rootNode = s.buildRoot(); s.computeStats()
    assert.equal(s.rootNode.children[0].price, 0); assert.match(s.nodeHtml(s.rootNode.children[0]), /cbn-price/)
    assert.equal(s.rootNode.children[0].children[0].price, null)
    assert.equal(s.statsList.some(item => item.k === '子项金额合计'), false)
    assert.doesNotMatch(s.nodeHtml(s.rootNode.children[0].children[0]), /cbn-price/)
  } finally { app.unmount() }
})

test('递归清理结构价格保留原树与数量，非法价格不被转换为0', () => {
  const source = tree(), safe = prices.omitComponentPrices(source)
  assert.equal(Object.hasOwn(safe[0], 'unit_price'), false); assert.equal(Object.hasOwn(safe[0].components[0], 'unit_price'), false)
  assert.equal(source[0].components[0].unit_price, '4'); assert.equal(safe[0].components[0].num, 2)
  assert.equal(prices.componentPriceValue('bad'), null); assert.equal(prices.componentPriceValue('0'), 0)
})
