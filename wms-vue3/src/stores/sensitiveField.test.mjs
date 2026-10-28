import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as Vue from 'vue'
import * as Pinia from 'pinia'
import { normalizeApiError } from '../utils/apiError.ts'
import { parseSensitivePath } from '../utils/sensitiveFields.ts'

const output = ts.transpileModule(readFileSync(new URL('./sensitiveField.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function mount() {
  const saved = ['window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  let token = 'session-a'
  globalThis.window = new EventTarget(); globalThis.localStorage = { getItem: () => token }
  const requests = [], exports = {}
  const imports = { vue: Vue, pinia: Pinia, '@/api/modules/sensitiveField': { getSensitiveRestrictions: path => { const request = { ...deferred(), path }; requests.push(request); return request.promise } }, '@/utils/apiError': { normalizeApiError }, '@/utils/sensitiveFields': { parseSensitivePath } }
  new Function('require', 'exports', output)(name => imports[name], exports)
  Pinia.setActivePinia(Pinia.createPinia())
  const store = exports.useSensitiveFieldStore()
  return { store, requests, token: value => { token = value }, close: () => { store.$dispose(); Pinia.setActivePinia(undefined); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] } } }
}
const ready = (path, fields = []) => ({ data: { interface_url: path, is_restricted: !!fields.length, restricted_fields: fields } })

test('同路径预判合并请求，内存短缓存可强制刷新', async () => {
  const h = mount()
  try {
    const first = h.store.load('/api/v1/tenant-products/detail'), second = h.store.load('/tenant-products/detail')
    assert.equal(h.requests.length, 1)
    h.requests[0].resolve(ready('/tenant-products/detail')); await Promise.all([first, second])
    await h.store.load('/tenant-products/detail'); assert.equal(h.requests.length, 1)
    const refreshed = h.store.load('/tenant-products/detail', true); assert.equal(h.requests.length, 2)
    h.requests[1].resolve(ready('/tenant-products/detail')); await refreshed
  } finally { h.close() }
})
test('切换账号后旧响应不得写回新会话缓存', async () => {
  const h = mount()
  try {
    const old = h.store.load('/a'); h.token('session-b'); const current = h.store.load('/a')
    h.requests[1].resolve(ready('/a')); await current
    h.requests[0].resolve(ready('/a', [{ field_id: 'p', field_label: '价格', restriction_type: 1, io_type: 'OUTPUT', param_name: 'price' }])); await old
    assert.deepEqual(h.store.entries.get('/a').fields, [])
  } finally { h.close() }
})
test('403清除已有放行缓存且不会无限重发预判', async () => {
  const h = mount()
  try {
    const first = h.store.load('/a'); h.requests[0].resolve(ready('/a')); await first
    const second = h.store.load('/b'); h.requests[1].reject({ response: { status: 403, data: { message: '无权限' } } }); await second
    assert.equal(h.store.entries.has('/a'), false)
    assert.equal(h.store.entries.get('/b').status, 'unknown')
    assert.equal(h.requests.length, 2)
  } finally { h.close() }
})

test('另一接口403或同会话失效不能解除已经确认的隐藏规则，重新预判成功才能放开', async () => {
  const h = mount()
  try {
    const hidden = [{ field_id: 'p', field_label: '价格', restriction_type: 1, io_type: 'OUTPUT', param_name: 'price' }]
    const first = h.store.load('/protected'); h.requests[0].resolve(ready('/protected', hidden)); await first
    const denied = h.store.load('/other'); h.requests[1].reject({ response: { status: 403 } }); await denied
    assert.equal(h.store.entries.get('/protected')?.status, 'unknown')
    assert.deepEqual(h.store.entries.get('/protected')?.fields, hidden)
    h.store.invalidate()
    assert.deepEqual(h.store.entries.get('/protected')?.fields, hidden)
    const refresh = h.store.load('/protected', true); h.requests[2].resolve(ready('/protected')); await refresh
    assert.deepEqual(h.store.entries.get('/protected').fields, [])
  } finally { h.close() }
})
test('非法字段路径不能被视为已确认权限', async () => {
  const h = mount()
  try {
    const request = h.store.load('/a'); h.requests[0].resolve(ready('/a', [{ param_name: 'items[0].price', restriction_type: 1, io_type: 'INPUT' }])); await request
    assert.equal(h.store.entries.get('/a').status, 'unknown')
  } finally { h.close() }
})
