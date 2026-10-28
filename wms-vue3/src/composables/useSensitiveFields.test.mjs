import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as Vue from 'vue'
import * as paths from '../utils/sensitiveFields.ts'
const transpile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
function moduleFrom(code, imports) { const exports = {}; new Function('require', 'exports', code)(name => imports[name], exports); return exports }
const { useTableSort } = moduleFrom(transpile('./useTableSort.ts'), { vue: Vue })
const output = transpile('./useSensitiveFields.ts')

test('受限排序在重新取数前清除；无变化的清除事件和受限列点击不重复查询', () => {
  let visible = true, calls = 0
  const sort = useTableSort(() => calls++, field => field !== 'factory_price' || visible)
  sort.handleSortChange({ prop: 'factory_price', order: 'ascending' }); assert.equal(calls, 1)
  visible = false; assert.equal(sort.clearRestrictedSort(), true); assert.equal(sort.sortBy.value, '')
  sort.handleSortChange({ prop: null, order: null }); sort.handleSortChange({ prop: 'factory_price', order: 'descending' })
  assert.equal(calls, 1); assert.equal(sort.sortOrder.value, '')
  sort.handleSortChange({ prop: 'product_name', order: 'descending' }); assert.equal(calls, 2)
})

test('搜索路径切换保留上一响应隐藏信息，新响应整体替换；会话变化停止展示', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let token = 'a'; globalThis.localStorage = { getItem: () => token }
  const store = Vue.reactive({ entries: new Map(), revision: 0, normalizePath: path => path, load: async path => { store.entries.set(path, { status: 'ready', fields: [] }) } })
  const hooks = {}, vue = { ...Vue, onActivated: fn => { hooks.activate = fn }, onDeactivated: fn => { hooks.deactivate = fn } }
  const { useSensitiveFields } = moduleFrom(output, { vue, '@/stores/sensitiveField': { useSensitiveFieldStore: () => store }, '@/utils/sensitiveFields': paths })
  const scope = Vue.effectScope(), path = Vue.ref('/list'); let fields
  try {
    scope.run(() => { fields = useSensitiveFields({ interfacePath: () => path.value }) })
    fields.setResponse({ restricted_sensitive_fields: [{ field_id: 'price', param_names: ['products[].factory_price'] }] })
    path.value = '/search'; await Vue.nextTick()
    assert.equal(fields.canView('products[].factory_price'), false)
    fields.setResponse({ products: [{ factory_price: '0' }] }); assert.equal(fields.canView('products[].factory_price'), true)
    hooks.deactivate(); store.revision++; await Vue.nextTick()
    token = 'b'; store.revision++; await Vue.nextTick()
    assert.equal(fields.canView('products[].factory_price'), false); assert.equal(fields.confirmed.value, false)
  } finally { scope.stop(); if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage }
})
