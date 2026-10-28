import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import { z } from 'zod'
import * as paths from '../../utils/sensitiveFields.ts'
import { createAmountSummary } from '../../composables/useTableSummary.ts'

const transpile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const moduleFrom = (code, imports) => { const exports = {}; new Function('require', 'exports', code)(name => imports[name], exports); return exports }
const { useTableSort } = moduleFrom(transpile(readFileSync(new URL('../../composables/useTableSort.ts', import.meta.url), 'utf8')), { vue: Vue })
const fieldsCode = transpile(readFileSync(new URL('../../composables/useSensitiveFields.ts', import.meta.url), 'utf8'))
const renderer = Vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
const tick = async () => { for (let i = 0; i < 10; i++) { await Promise.resolve(); await Vue.nextTick() } }

async function mount(file) {
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'); globalThis.localStorage = { getItem: () => 'session' }
  const slowMoving = file.includes('Unsold')
  let restricted = false, data = slowMoving ? { items: [{ product_id: 'p', amount: '12', warehouse_stock: '3' }], total: 1 } : { products: [{ product_id: 'p', factory_price: '0', min_sale_price: '0' }], total: 1 }
  const calls = []
  const store = Vue.reactive({ entries: new Map(), revision: 0, normalizePath: path => path, load: async path => {
    const state = { status: 'ready', fields: restricted ? [{ io_type: 'OUTPUT', restriction_type: 1, param_name: slowMoving ? 'items[].amount' : 'products[].factory_price' }] : [] }
    store.entries.set(path, state); return state
  } })
  const fields = moduleFrom(fieldsCode, { vue: Vue, '@/stores/sensitiveField': { useSensitiveFieldStore: () => store }, '@/utils/sensitiveFields': paths })
  const query = async args => { calls.push(args); return { data } }
  const api = { getProductCategoryTree: async () => ({ data: [] }), getProductList: query, searchProduct: query, getCombinedProducts: query, searchCombinedProducts: query, getSlowMovingProducts: query, searchSlowMovingProducts: query }
  const imports = {
    vue: Vue, zod: { z }, 'vue-router': { useRouter: () => ({ push() {} }) }, 'element-plus': { ElMessage: { warning() {} }, ElMessageBox: {} }, '@element-plus/icons-vue': {}, '@/api': api,
    '@/composables/useTableSkeleton': { useTableSkeleton: () => ({ initialLoading: Vue.ref(false), skeletonRows: Vue.ref([]) }) }, '@/composables/useTableSort': { useTableSort }, '@/composables/useSensitiveFields': fields,
    '@/composables/useTableSummary': { createAmountSummary },
    '@/stores/sensitiveField': { useSensitiveFieldStore: () => store }, '@/stores/permission': { usePermissionStore: () => ({ hasUrlPerm: () => true }) },
    '@/composables/useAgentPage': { useAgentPage() {} }, '@/utils/data': {}, '@/utils/date': {}, '@/config/importTemplates': { IMPORT_TEMPLATES: {} }, '@/utils/download': {}, '@/api/modules/batchImport': {}, '@/api/modules/productBatch': {},
  }
  const script = compileScript(parse(readFileSync(new URL(file, import.meta.url), 'utf8')).descriptor, { id: file }).content.replaceAll('import.meta.env.VITE_PRODUCT_BATCH_TOOLS_ENABLED', "'false'")
  const exports = {}; new Function('require', 'exports', transpile(script))(name => name.endsWith('.vue') ? {} : (assert.ok(name in imports, name), imports[name]), exports)
  exports.default.render = () => null
  const app = renderer.createApp(exports.default); app.config.warnHandler = () => {}; const vm = app.mount({}); await tick()
  return { s: vm.$.setupState, calls, restrict: value => { restricted = value }, setData: value => { data = value }, close() { app.unmount(); if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else delete globalThis.localStorage } }
}

test('滞销表按实际接口清除受限金额排序，合计不拼接缺失金额', async () => {
  const h = await mount('./ProductUnsold.vue')
  try {
    const columns = [{ property: 'product_name' }, { property: 'amount' }]
    assert.equal(h.s.getSummaries({ columns, data: [{ amount: '12' }, {}] })[1], '-')
    h.s.handleSortChange({ prop: 'amount', order: 'ascending' }); await tick()
    assert.equal(h.calls.at(-1).sort_by, 'amount')
    h.restrict(true); h.setData({ items: [{ product_id: 'p', warehouse_stock: '3' }], total: 1 })
    await h.s.loadData(); await tick()
    assert.equal(h.calls.at(-1).sort_by, undefined)
    assert.equal(h.s.getSummaries({ columns, data: h.s.tableData })[1], '')
    assert.equal(Object.hasOwn(h.s.tableData[0], 'amount'), false)
  } finally { h.close() }
})

for (const file of ['./ProductInfo.vue', './ProductCombined.vue']) {
  test(`${file}：角色变化后先清除价格排序再查询，返回缺键完整替换旧价格`, async () => {
    const h = await mount(file)
    try {
      h.s.handleSortChange({ prop: 'factory_price', order: 'ascending' }); await tick()
      assert.equal(h.calls.at(-1).sort_by, 'factory_price')
      h.restrict(true); h.setData({ products: [{ product_id: 'p', product_name: '受限' }], total: 1 })
      await h.s.loadData(); await tick()
      assert.equal(h.calls.at(-1).sort_by, undefined); assert.equal(h.s.sortBy, '')
      assert.equal(Object.hasOwn(h.s.tableData[0], 'factory_price'), false)
      assert.equal(h.s.productFields.canView('products[].factory_price'), false)
    } finally { h.close() }
  })
}
