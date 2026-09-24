import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as Vue from 'vue'

const require = createRequire(import.meta.url)
const Router = require('vue-router')
const Pinia = require('pinia')
const root = new URL('../../', import.meta.url)
const layout = readFileSync(new URL('layout/MainLayout.vue', root), 'utf8')
const included = [...layout.match(/const cachedPageNames = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1])
const A = '/production/finished-goods-stockin'
const B = '/production/production-picking'

function evaluate(source, imports) {
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const exports = {}
  new Function('require', 'exports', output)(name => {
    assert.ok(name in imports, `Unmocked dependency: ${name}`)
    return imports[name]
  }, exports)
  return exports
}

function hostNode(type) {
  return { type, children: [], parent: null }
}

const renderer = Vue.createRenderer({
  createElement: hostNode,
  createText: text => ({ ...hostNode('text'), text }),
  createComment: hostNode,
  setText(node, text) { node.text = text },
  setElementText(node, text) { node.text = text },
  patchProp() {},
  parentNode: node => node.parent,
  nextSibling(node) {
    const children = node.parent?.children || []
    return children[children.indexOf(node) + 1] || null
  },
  insert(node, parent, anchor) {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
    node.parent = parent
  },
  remove(node) {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
    node.parent = null
  },
})

async function harness(t, initial = A) {
  const requests = []
  const records = []
  const imports = {
    vue: Vue,
    pinia: Pinia,
    'vue-router': Router,
    'element-plus': { ElMessage: { success() {}, error() {}, warning() {}, info() {} }, ElMessageBox: {} },
    '@element-plus/icons-vue': {},
    '@/views/common/ListTemplate.vue': {},
    './components/WmsStatusBatchDialog.vue': {},
    './components/SyncSettingsCard.vue': {},
    '@/config/productionDocConfig': { PRODUCTION_DOC_CONFIGS: [], PRODUCTION_DOC_CONFIG_MAP: {} },
    '@/api/modules/printTask': {
      BIZ_TYPE_PRODUCTION_BILL_LABEL: 'PRODUCTION_BILL_LABEL',
      PRINT_TASK_SOURCE_PRODUCTION_BILL_PRINT: 'PRODUCTION_BILL_PRINT',
      createPrintTasks: () => assert.fail('Cache navigation must not create print tasks'),
    },
    '@/utils/download': {
      downloadPdf: () => assert.fail('Cache navigation must not download PDFs'),
    },
    '@/api/modules/production': {
      PRODUCTION_DOCS: [],
      isBillLockSupported: () => true,
      listProductionBills: async (...args) => {
        requests.push(['list', ...args])
        return { data: { bills: [{ wms_bill_id: args[0] }], total: 100, page_size: 20 } }
      },
      searchProductionBills: async (...args) => {
        requests.push(['search', ...args])
        return { data: { bills: [{ wms_bill_id: args[0] }], total: 100, page_size: 20 } }
      },
      getProductionBillDetail: async (...args) => {
        requests.push(['detail', ...args])
        return { data: { bill: { wms_bill_id: args[1] }, items: [], item_total: 240 } }
      },
      listProductionItems: async (...args) => {
        requests.push(['items', ...args])
        return { data: { items: [], total: 240, page: args[2], page_size: args[3] } }
      },
      getProductionOverview: async () => ({ data: { docs: [] } }),
      listUnboundProducts: async () => ({ data: { items: [], total: 0 } }),
    },
  }
  imports['@/composables/useTableSort'] = evaluate(readFileSync(new URL('composables/useTableSort.ts', root), 'utf8'), imports)
  const { useTabStore } = evaluate(readFileSync(new URL('stores/tab.ts', root), 'utf8'), imports)
  function component(name) {
    const file = new URL(`views/production/${name}.vue`, root)
    const filename = fileURLToPath(file)
    const descriptor = parse(readFileSync(file, 'utf8'), { filename }).descriptor
    const result = evaluate(compileScript(descriptor, { id: name }).content, imports).default
    const setup = result.setup
    result.setup = (props, context) => {
      const path = Router.useRoute().fullPath
      const state = setup(props, context)
      records.push({ path, state })
      return state
    }
    result.render = () => Vue.h('div')
    return result
  }
  const list = component('ProductionBillList')
  const router = Router.createRouter({
    history: Router.createMemoryHistory(),
    routes: [
      { path: A, component: list, meta: { docKey: 'finished-goods-stockin' } },
      { path: B, component: list, meta: { docKey: 'production-picking' } },
      { path: '/production/:docKey/detail/:billId', component: component('ProductionBillDetail') },
      { path: '/production/overview', component: component('ProductionOverview') },
      { path: '/production/unbound-products', component: component('UnboundProducts') },
      { path: '/outside', component: { render: () => Vue.h('div') } },
    ],
  })
  const pinia = Pinia.createPinia()
  const tabs = useTabStore(pinia)
  const app = renderer.createApp({
    render: () => Vue.h(Router.RouterView, null, {
      default: ({ Component, route }) => Vue.h(Vue.KeepAlive, { include: included, max: 30 }, () => (
        Component ? Vue.cloneVNode(Component, { key: `${route.fullPath}-0-${tabs.remountTicks[route.fullPath] || 0}` }) : null
      )),
    }),
  })
  app.use(pinia)
  app.use(router)
  async function settle() {
    for (let i = 0; i < 4; i++) await Vue.nextTick()
  }
  async function go(path) {
    tabs.addTab(path, path)
    await router.push(path)
    await settle()
  }
  await go(initial)
  app.mount(hostNode('root'))
  await settle()
  t.after(() => app.unmount())
  return { go, tabs, requests, records, state: path => records.filter(r => r.path === path).at(-1).state }
}

test('production components are included without removing existing page caches', () => {
  for (const name of ['ProductInfo', 'AddTemplate', 'ProductDocSplit', 'ProductionOverview', 'UnboundProducts', 'ProductionBillList', 'ProductionBillDetail']) {
    assert.ok(included.includes(name), `Missing cache: ${name}`)
  }
  assert.match(layout, /:max="30"/)
  assert.match(layout, /route\.fullPath.*remountTick.*tabStore\.remountTicks\[route\.fullPath\]/)
})

test('list tabs preserve filters, dates, sorting, pagination and data without background route reloads', async t => {
  const h = await harness(t)
  const a = h.state(A)
  a.keyword.value = 'retain-A'
  a.dateRange.value = ['2026-09-01', '2026-09-23']
  a.pagination.page = 3
  a.handleSortChange({ prop: 'erp_bill_no', order: 'descending' })
  await Vue.nextTick()
  const rows = a.tableData.value
  const count = h.requests.length
  await h.go(B)
  assert.equal(Vue.unref(a.docKey), 'finished-goods-stockin')
  assert.equal(a.keyword.value, 'retain-A')
  assert.equal(h.requests.length, count + 1)
  h.state(B).keyword.value = 'retain-B'
  await h.go(A)
  assert.equal(h.state(A), a)
  assert.equal(a.keyword.value, 'retain-A')
  assert.equal(a.pagination.page, 3)
  assert.deepEqual(a.dateRange.value, ['2026-09-01', '2026-09-23'])
  assert.equal(a.sortParams.sort_by, 'erp_bill_no')
  assert.equal(a.sortParams.sort_order, 'DESC')
  assert.equal(a.tableData.value, rows)
  assert.equal(h.requests.length, count + 1)
  await h.go('/outside')
  await h.go(B)
  assert.equal(h.state(B).keyword.value, 'retain-B')
  assert.equal(h.requests.length, count + 1)
  await h.state(B).loadData()
  assert.deepEqual(h.requests.at(-1).slice(0, 3), ['search', 'production-picking', 'retain-B'])
})

test('different details keep their original document identity and selection while inactive', async t => {
  const one = `${A}/detail/bill-A`
  const two = `${B}/detail/bill-B`
  const h = await harness(t, one)
  const a = h.state(one)
  a.itemKeyword.value = 'retain-item'
  a.selected.value = [{ wms_item_id: 'item-A' }]
  a.includeDeleted.value = true
  a.itemsPage.value = 4
  await h.go(two)
  assert.equal(Vue.unref(a.docKey), 'finished-goods-stockin')
  assert.equal(Vue.unref(a.billId), 'bill-A')
  await a.loadItemsPage(4)
  assert.deepEqual(h.requests.at(-1), ['items', 'finished-goods-stockin', 'bill-A', 4, 20])
  const count = h.requests.length
  await h.go(one)
  assert.equal(h.state(one), a)
  assert.equal(a.itemKeyword.value, 'retain-item')
  assert.deepEqual(a.selectedIds.value, ['item-A'])
  assert.equal(a.includeDeleted.value, true)
  assert.equal(a.itemsPage.value, 4)
  assert.equal(h.requests.length, count)
})

test('closing one or all other tabs invalidates only their instances', async t => {
  const h = await harness(t)
  h.state(A).keyword.value = 'discard-A'
  await h.go(B)
  h.state(B).keyword.value = 'keep-B'
  h.tabs.closeOtherTabs(B)
  await h.go(A)
  assert.equal(h.state(A).keyword.value, '')
  await h.go(B)
  assert.equal(h.state(B).keyword.value, 'keep-B')
  h.tabs.closeTab(A)
  await h.go(A)
  assert.equal(h.records.filter(r => r.path === A).length, 3)
})

test('overview and query-specific unbound tabs keep independent instances', async t => {
  const overview = '/production/overview'
  const first = '/production/unbound-products?doc_key=finished-goods-stockin'
  const second = '/production/unbound-products?doc_key=production-picking'
  const h = await harness(t, overview)
  const o = h.state(overview)
  await h.go(first)
  h.state(first).keyword.value = 'product-A'
  h.state(first).pagination.page = 3
  await h.go(second)
  assert.equal(h.state(second).docKey.value, 'production-picking')
  await h.go(first)
  assert.equal(h.state(first).keyword.value, 'product-A')
  assert.equal(h.state(first).pagination.page, 3)
  assert.equal(h.state(first).docKey.value, 'finished-goods-stockin')
  await h.go(overview)
  assert.equal(h.state(overview), o)
})
