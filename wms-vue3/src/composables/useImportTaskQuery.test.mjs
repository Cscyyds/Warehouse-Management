import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import * as Vue from 'vue'

const output = ts.transpileModule(readFileSync(new URL('./useImportTaskQuery.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const exports = {}
new Function('require', 'exports', output)(name => name === 'vue' ? Vue : { importRequestError: error => error.message }, exports)
const { useImportTaskQuery } = exports
const flush = async () => { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve() }
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }

function harness() {
  const saved = Object.fromEntries(['document', 'window', 'localStorage', 'setTimeout', 'clearTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  const win = new EventTarget()
  let token = 'session-a', counter = 0
  const timers = new Map()
  Object.assign(globalThis, { document: doc, window: win, localStorage: { getItem: () => token }, setTimeout: (fn, delay) => { const id = ++counter; timers.set(id, { fn, delay }); return id }, clearTimeout: id => timers.delete(id) })
  const scope = Vue.effectScope()
  const key = Vue.ref('first'), enabled = Vue.ref(true), requests = []
  let query
  scope.run(() => { query = useImportTaskQuery({ key: () => key.value, enabled: () => enabled.value, interval: () => 2000, retryIntervalMs: 5000, maxConsecutiveFailures: 2,
    request: signal => { const request = { ...deferred(), signal }; requests.push(request); return request.promise },
  }) })
  return { query, key, enabled, requests, timers, doc, win, scope,
    setToken: value => { token = value },
    tick: () => { const first = timers.entries().next().value; assert.ok(first, 'expected timer'); timers.delete(first[0]); first[1].fn() },
    close: () => { scope.stop(); for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] } },
  }
}

test('切换任务丢弃迟到响应，轮询请求不重叠', async () => {
  const h = harness()
  try {
    h.key.value = 'second'; await flush()
    assert.equal(h.requests[0].signal.aborted, true)
    h.requests[0].resolve({ data: 'old' }); await flush(); assert.equal(h.query.data.value, null)
    h.requests[1].resolve({ data: 'new' }); await flush(); assert.equal(h.query.data.value, 'new')
    h.tick(); assert.equal(h.requests.length, 3); assert.equal(h.timers.size, 0)
    h.requests[2].resolve({ data: 'newer' }); await flush(); assert.equal(h.timers.size, 1)
  } finally { h.close() }
})

test('查询失败保留最近状态，连续失败后停止自动查询', async () => {
  const h = harness()
  try {
    h.requests[0].resolve({ data: 'last-good' }); await flush(); h.tick()
    h.requests[1].reject(new Error('断网')); await flush()
    assert.equal(h.query.data.value, 'last-good'); assert.equal(h.query.error.value, '断网')
    h.tick(); h.requests[2].reject(new Error('仍然断网')); await flush()
    assert.equal(h.timers.size, 0); assert.equal(h.query.data.value, 'last-good')
  } finally { h.close() }
})

test('无权限不重试，隐藏暂停，回到前台补查一次', async () => {
  const h = harness()
  try {
    h.requests[0].reject(Object.assign(new Error('无权限'), { response: { status: 403 } })); await flush(); assert.equal(h.timers.size, 0)
    h.doc.visibilityState = 'hidden'; h.doc.dispatchEvent(new Event('visibilitychange')); await flush()
    h.doc.visibilityState = 'visible'; h.doc.dispatchEvent(new Event('visibilitychange')); await flush()
    assert.equal(h.requests.length, 2)
    h.scope.stop(); assert.equal(h.requests[1].signal.aborted, true)
    h.requests[1].resolve({ data: 'disposed' }); await flush(); assert.equal(h.query.data.value, null)
  } finally { h.close() }
})

test('账号切换时清除旧会话结果并拒绝迟到响应', async () => {
  const h = harness()
  try {
    h.requests[0].resolve({ data: 'tenant-a' }); await flush(); h.tick()
    h.setToken('session-b')
    h.win.dispatchEvent(Object.assign(new Event('storage'), { key: 'token' }))
    h.requests[1].resolve({ data: 'tenant-a-late' }); await flush()
    assert.equal(h.query.data.value, null); assert.equal(h.timers.size, 0)
    await h.query.refresh(); assert.equal(h.requests.length, 2)
  } finally { h.close() }
})
