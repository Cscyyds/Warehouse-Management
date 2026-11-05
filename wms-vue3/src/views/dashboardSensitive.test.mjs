import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import * as paths from '../utils/sensitiveFields.ts'

const transpile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const moduleFrom = (code, imports) => { const exports = {}; new Function('require', 'exports', code)(name => name.endsWith('.vue') ? {} : (assert.ok(name in imports, name), imports[name]), exports); return exports }
const code = file => transpile(compileScript(parse(readFileSync(new URL(file, import.meta.url), 'utf8')).descriptor, { id: file }).content)
const renderer = Vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
const tick = async () => { for (let i = 0; i < 10; i++) { await Promise.resolve(); await Vue.nextTick() } }
function mount(component, props = {}) { component.render = () => null; const app = renderer.createApp(component, props); app.config.warnHandler = () => {}; return { app, s: app.mount({}).$.setupState } }

test('库存预警比率缺键不显示断货，明确null与真实0保持后端含义', () => {
  const saved = ['requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {}
  const module = moduleFrom(code('../components/dashboard/StockAlertCard.vue'), { vue: Vue, '@element-plus/icons-vue': {} })
  const h = mount(module.default, { items: [] })
  try {
    assert.equal(h.s.hasRatio({ product_id: 'hidden' }), false); assert.equal(h.s.percentText({}), '-')
    assert.equal(h.s.percentText({ stock_ratio: null }), '断货'); assert.equal(h.s.percentText({ stock_ratio: '0' }), '0%')
    assert.equal(h.s.hasRatio({ stock_ratio: 'bad' }), false)
  } finally { h.app.unmount(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] } }
})

async function dashboard(query) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'); globalThis.localStorage = { getItem: () => 'session' }
  const store = Vue.reactive({ entries: new Map(), revision: 0, normalizePath: path => path, load: async path => { const state = { status: 'ready', fields: [{ io_type: 'OUTPUT', restriction_type: 1, param_name: 'items[].stock_ratio' }] }; store.entries.set(path, state); return state } })
  const fields = moduleFrom(transpile(readFileSync(new URL('../composables/useSensitiveFields.ts', import.meta.url), 'utf8')), { vue: Vue, '@/stores/sensitiveField': { useSensitiveFieldStore: () => store }, '@/utils/sensitiveFields': paths })
  const module = moduleFrom(code('./Dashboard.vue'), { vue: Vue, '@/api/modules/dashboard': { getDashboardOverview: async () => ({ data: {} }) }, '@/api/modules/product': { getStockWarningProducts: query }, '@/stores/permission': { usePermissionStore: () => ({ hasUrlPerm: () => true }) }, '@/config/tradeDocConfig': { TRADE_DOC_LIST_PATH: {}, TRADE_SHARED_PAGES: {} }, '@/composables/useSensitiveFields': fields })
  const h = mount(module.default); await tick()
  return { ...h, close() { h.app.unmount(); if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage } }
}

test('仪表盘按预警真实接口删除受限比率，不传播到卡片', async () => {
  const h = await dashboard(async () => ({ data: { total: 1, items: [{ product_id: 'p', stock_ratio: '0.25' }] } }))
  try { assert.equal(h.s.stockWarning.status, 'ready'); assert.equal(h.s.stockWarning.total, 1); assert.equal(Object.hasOwn(h.s.stockWarning.items[0], 'stock_ratio'), false) } finally { h.close() }
})

test('预警加载失败保留未知状态和占位计数，不报零预警或库存充足', async () => {
  const h = await dashboard(async () => { throw new Error('网络错误') })
  try { assert.equal(h.s.stockWarning.status, 'error'); assert.equal(h.s.stockWarning.total, null); assert.equal(h.s.heroStats.find(item => item.label === '库存预警').value, '--') } finally { h.close() }
})
