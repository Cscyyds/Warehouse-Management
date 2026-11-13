import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import * as paths from '../../utils/sensitiveFields.ts'
import * as policyUtils from '../../utils/sensitiveForm.ts'
import { sensitiveFormBindings } from '../../config/sensitivePageBindings.ts'

function compile(source) { return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText }
const componentCode = compile(compileScript(parse(readFileSync(new URL('./AddTemplate.vue', import.meta.url), 'utf8')).descriptor, { id: 'add-sensitive-test' }).content)
const policyCode = compile(readFileSync(new URL('../../composables/useSensitiveForm.ts', import.meta.url), 'utf8'))
const fieldsCode = compile(readFileSync(new URL('../../composables/useSensitiveFields.ts', import.meta.url), 'utf8'))
const tick = async () => { for (let i = 0; i < 8; i++) { await Promise.resolve(); await Vue.nextTick() } }
const renderer = Vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })

async function mount(options = {}) {
  const saved = ['document', 'localStorage', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  const cache = new Map(Object.entries(options.cache ?? {}))
  globalThis.document = new EventTarget()
  globalThis.localStorage = { getItem: () => 'session' }
  globalThis.sessionStorage = { getItem: key => cache.get(key) ?? null, removeItem: key => cache.delete(key), setItem: (key, value) => cache.set(key, value) }
  const errors = [], writes = [], routes = [], fields = [
    { key: 'remark', label: '备注', type: 'input' },
    { key: 'factory_price', label: '出厂价', type: 'number', required: true, defaultValue: 0 },
    { key: 'min_sale_price', label: '最低价', type: 'number', required: true },
    { key: 'gross_profit_ctrl_rate', label: '毛利率', type: 'computed', compute: fd => fd.factory_price == null ? undefined : '100.00' },
    { key: 'sale_prices', type: 'dynamic-table', columns: [{ key: 'sale_price', type: 'input', required: true }, { key: 'remark', type: 'input' }] },
  ]
  const binding = sensitiveFormBindings.productInfo
  const endpoints = [...new Set([binding.detail, ...Object.values(binding.fields).flatMap(field => field.input ? [field.input.interfacePath] : [])])]
  const store = Vue.reactive({ entries: new Map(endpoints.map(path => [path, { status: 'ready', fields: [] }])), revision: 0, normalizePath: path => path, load: async path => store.entries.get(path) })
  const policyImports = { vue: Vue, '@/config/sensitivePageBindings': { sensitiveFormBindings }, '@/stores/sensitiveField': { useSensitiveFieldStore: () => store }, '@/utils/sensitiveForm': policyUtils, '@/utils/sensitiveFields': paths }
  const policyExports = {}; new Function('require', 'exports', policyCode)(name => policyImports[name], policyExports)
  const fieldsExports = {}; new Function('require', 'exports', fieldsCode)(name => policyImports[name], fieldsExports)
  let detail = { product_id: 'p1', remark: '原', factory_price: '0', min_sale_price: '10', gross_profit_ctrl_rate: '100', sale_prices: [{ sale_price_id: 'sp', customer_type_id: 'ct', sale_price: '12', remark: '旧' }] }
  const config = { type: options.type ?? 'productInfo', title: '产品', tabs: [{ fields }], loadDetail: async () => { if (options.failLoad) throw new Error('详情失败'); return detail }, submitUpdate: async (...args) => { writes.push(args); if (options.write) await options.write(...args) } }
  const route = Vue.reactive({ path: '/common/add', fullPath: '/common/add?type=productInfo&id=p1&mode=edit', query: { type: 'productInfo', id: 'p1', mode: 'edit' } })
  const imports = {
    vue: Vue, 'vue-router': { useRoute: () => route, useRouter: () => ({ push: async path => routes.push(path), back: () => routes.push('back') }) },
    'element-plus': { ElMessage: { warning: message => errors.push(message), error: message => errors.push(message), success() {} }, ElMessageBox: { confirm: async () => true } },
    '@element-plus/icons-vue': {}, '@/config/formConfigs': { getSceneConfig: type => type === 'productInfo' ? config : undefined },
    '@/composables/useSensitiveForm': policyExports, '@/composables/useSensitiveFields': fieldsExports, '@/utils/sensitiveFields': paths,
    '@/utils/data': {}, '@/utils/regionCity': { regionMode: Vue.ref('division') }, '@/api': options.api ?? {},
    '@/composables/useBreakpoint': { useBreakpoint: () => ({ isTabletDown: Vue.ref(false) }) }, '@/composables/useAgentPage': { useAgentPage() {} },
    '@/agent/formPageIdentity': {}, '@/stores/tab': { useTabStore: () => ({ invalidateTab() {}, addTab() {} }) },
  }
  const exports = {}; new Function('require', 'exports', componentCode)(name => name.endsWith('.vue') ? {} : (assert.ok(name in imports, name), imports[name]), exports)
  const component = exports.default; component.render = () => null
  const app = renderer.createApp(component); app.config.warnHandler = () => {}
  const vm = app.mount({}); await tick()
  return { s: vm.$.setupState, vm, store, writes, errors, route, fields, setDetail: value => { detail = value },
    close() { app.unmount(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] } },
  }
}

test('真实表单替换缺键详情，隐藏价格不恢复默认零、不参与必填或毛利计算', async () => {
  const h = await mount()
  try {
    assert.equal(h.s.formData.factory_price, '0')
    h.setDetail({ product_id: 'p1', remark: '新', sale_prices: [{ sale_price_id: 'sp', customer_type_id: 'ct', remark: '保留' }], restricted_sensitive_fields: [{ field_id: 'price', param_names: ['factory_price', 'min_sale_price', 'sale_prices[].sale_price'] }] })
    await h.s.loadEditData(); await tick()
    assert.equal(Object.hasOwn(h.s.formData, 'factory_price'), false)
    assert.equal(Object.hasOwn(h.s.formData, 'gross_profit_ctrl_rate'), false)
    assert.deepEqual(h.s.getFieldRules(h.fields[1]), [])
    assert.deepEqual(h.s.visibleTableColumns(h.fields[4]).map(col => col.key), ['remark'])
    h.s.handleReset(); await tick(); assert.equal(Object.hasOwn(h.s.formData, 'factory_price'), false)
    assert.equal(h.s.canMutateTable('sale_prices'), false)
    h.s.addDynamicRow('sale_prices', h.fields[4]); assert.equal(h.s.dynamicTableData.sale_prices.length, 1)
    await h.s.handleSubmit()
    assert.equal(h.writes.length, 1); assert.equal(Object.hasOwn(h.writes[0][1], 'factory_price'), false)
    assert.equal(h.writes[0][1].sale_prices[0].sale_price_id, 'sp')
  } finally { h.close() }
})

test('详情失败不回退带价格的列表缓存，也不能保存空白编辑页', async () => {
  const h = await mount({ failLoad: true, cache: { 'editData:productInfo': JSON.stringify({ product_id: 'p1', factory_price: '999' }) } })
  try { assert.equal(h.s.detailLoaded, false); assert.notEqual(h.s.formData.factory_price, '999'); await h.s.handleSubmit(); assert.equal(h.writes.length, 0) } finally { h.close() }
})

test('切换其他表单路由不改变本标签的业务类型和主键，离开后不提交', async () => {
  const h = await mount()
  try {
    h.route.query = { type: 'supplier', id: 'other', mode: 'edit' }; h.route.fullPath = '/common/add?type=supplier&id=other'; await tick()
    assert.equal(h.s.config.type, 'productInfo'); assert.equal(h.s.editId, 'p1')
    await h.s.handleSubmit(); assert.equal(h.writes.length, 0)
  } finally { h.close() }
})

test('保存防重复覆盖校验等待期；部分保存失败后禁止用旧快照重试', async () => {
  let release; const wait = new Promise(resolve => { release = resolve })
  const h = await mount({ write: async () => { throw Object.assign(new Error('关联删除失败'), { partialSave: true }) } })
  try {
    h.s.formRefs[0] = { validate: () => wait, clearValidate() {} }
    const first = h.s.handleSubmit(); await tick()
    await h.s.handleSubmit(); assert.equal(h.writes.length, 0)
    release(); await first; assert.equal(h.writes.length, 1); assert.equal(h.s.needsReload, true)
    await h.s.handleSubmit(); assert.equal(h.writes.length, 1)
  } finally { h.close() }
})

test('采购预填尊重本次详情删除提示或失败，不回退旧选择列表价格', async () => {
  const h = await mount({ type: 'purchaseOrder', api: { getProductDetail: async () => ({ data: { suppliers: [{ supplier_id: 's1' }], restricted_sensitive_fields: [{ field_id: 'preset', param_names: ['suppliers[].preset_purchase_price'] }] } }) } })
  try {
    h.s.formData.supplier_id = 's1'
    assert.equal(await h.s.resolvePresetPurchasePrice({ product_id: 'p1', preset_purchase_price: '999' }), '')
  } finally { h.close() }
})

test('采购预填异步返回不覆盖等待期间手动输入的单价', async () => {
  let release
  const response = new Promise(resolve => { release = resolve })
  const h = await mount({ type: 'purchaseOrder', api: { getProductDetail: () => response } })
  try {
    h.s.formData.supplier_id = 's1'
    const row = { product_id: 'p1', purchase_price: '' }
    const pending = h.s.applyPresetPurchasePrice(row, { product_id: 'p1' }); await tick()
    row.purchase_price = '25'
    release({ data: { suppliers: [{ supplier_id: 's1', preset_purchase_price: '8' }] } }); await pending
    assert.equal(row.purchase_price, '25'); assert.equal(Object.hasOwn(row, '_preset_price'), false)
  } finally { h.close() }
})

test('产品编辑重置恢复已加载快照和关联明细，不能重置成挂载前的空白默认值', async () => {
  const h = await mount()
  try {
    h.s.formRefs[0] = { resetFields() { h.s.formData.factory_price = 0; h.s.formData.remark = '' }, clearValidate() {} }
    h.s.formData.remark = '草稿'; h.s.dynamicTableData.sale_prices.splice(0)
    h.s.handleReset(); await tick()
    assert.equal(h.s.formData.remark, '原')
    assert.equal(h.s.formData.factory_price, '0')
    assert.equal(h.s.dynamicTableData.sale_prices.length, 1)
  } finally { h.close() }
})
