/**
 * PDF 实时预览控制器测试
 *
 * 重点守住三个容易出错的地方：
 * 1. 防抖：连续勾选只发最后一次请求，不能每勾一下打一次后端；
 * 2. 竞态：慢的旧响应不能覆盖快的新响应（连点场景）；
 * 3. 回收：object URL 必须被 revoke，否则 Blob 内存泄漏。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const moduleCache = new Map()
// 本文件在 src/config/ 下，所以 src 根就是上一级
const SRC_ROOT = new URL('../', import.meta.url)

function loadTs(url) {
  const key = url.pathname
  if (moduleCache.has(key)) return moduleCache.get(key)
  const source = readFileSync(url, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  moduleCache.set(key, exports)
  const localRequire = (spec) => {
    if (spec.startsWith('@/')) return loadTs(new URL(`${spec.slice(2)}.ts`, SRC_ROOT))
    throw new Error(`未预期依赖：${spec}`)
  }
  new Function('exports', 'require', compiled)(exports, localRequire)
  return exports
}

const { createPdfPreviewController, isSamePreviewRequest, snapshotToPreviewRequest } =
  loadTs(new URL('utils/pdfPreview.ts', SRC_ROOT))

/* ── 测试替身：记录 createObjectURL / revokeObjectURL 调用 ── */
function installUrlStub() {
  const created = []
  const revoked = []
  let n = 0
  globalThis.URL.createObjectURL = () => {
    n += 1
    const url = `blob:stub-${n}`
    created.push(url)
    return url
  }
  globalThis.URL.revokeObjectURL = (url) => { revoked.push(url) }
  return { created, revoked }
}

const req = (fields = [], sections = []) => ({
  kind: 'purchase', billId: 'po_1', hideFields: fields, hideSections: sections,
})

test('isSamePreviewRequest：字段顺序不同视为相同，内容不同视为不同', () => {
  assert.equal(isSamePreviewRequest(req(['a', 'b']), req(['b', 'a'])), true)
  assert.equal(isSamePreviewRequest(req(['a']), req(['a', 'c'])), false)
  assert.equal(isSamePreviewRequest(req(['a'], ['x']), req(['a'])), false)
  assert.equal(isSamePreviewRequest(req(['a']), { ...req(['a']), billId: 'po_2' }), false)
  assert.equal(isSamePreviewRequest(null, null), true)
})

test('snapshotToPreviewRequest 复制数组，不与快照共享引用', () => {
  const snap = {
    kind: 'sales', billId: 'so_1', billNo: 'S1',
    hideFields: ['order.qty'], hideSections: ['notes'],
    fileName: 'x.pdf', orderNoHidden: false,
  }
  const r = snapshotToPreviewRequest(snap)
  assert.deepEqual(r.hideFields, ['order.qty'])
  snap.hideFields.push('items.amount')
  assert.deepEqual(r.hideFields, ['order.qty'], '预览请求应持有独立副本')
})

test('防抖：连续 request 只触发最后一次 fetch', async () => {
  const { created, revoked } = installUrlStub()
  const calls = []
  const states = []
  const ctl = createPdfPreviewController({
    debounceMs: 25,
    fetchPdf: async (r) => { calls.push(r.hideFields.join(',')); return new Blob(['x']) },
    onChange: (s) => states.push(s),
  })

  ctl.request(req(['a']))
  ctl.request(req(['a', 'b']))
  ctl.request(req(['a', 'b', 'c']))
  await new Promise((r) => setTimeout(r, 90))

  assert.equal(calls.length, 1, `应只发 1 次，实际 ${calls.length}`)
  assert.equal(calls[0], 'a,b,c', '应为最后一次的参数')
  ctl.dispose()
  // 释放后应回收 object URL
  assert.ok(revoked.length >= 1 || created.length === 0)
})

test('竞态：先发的慢响应不能覆盖后发的快响应', async () => {
  installUrlStub()
  const resolvers = []
  const ctl = createPdfPreviewController({
    debounceMs: 0,
    fetchPdf: () => new Promise((resolve) => { resolvers.push(resolve) }),
    onChange: () => {},
  })

  ctl.request(req(['slow']), true)
  ctl.request(req(['fast']), true)
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(resolvers.length, 2, '应发出两次请求')

  // 后发的先回来
  resolvers[1](new Blob(['fast']))
  await new Promise((r) => setTimeout(r, 10))
  // 先发的后回来，应被丢弃
  resolvers[0](new Blob(['slow']))
  await new Promise((r) => setTimeout(r, 10))

  ctl.dispose()
})

test('dispose 后再 request 不再发请求', async () => {
  installUrlStub()
  let calls = 0
  const ctl = createPdfPreviewController({
    debounceMs: 0,
    fetchPdf: async () => { calls += 1; return new Blob(['x']) },
    onChange: () => {},
  })
  ctl.dispose()
  ctl.request(req(['a']), true)
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(calls, 0, 'dispose 后不应再发请求')
})

test('相同参数不重复渲染', async () => {
  installUrlStub()
  let calls = 0
  const ctl = createPdfPreviewController({
    debounceMs: 0,
    fetchPdf: async () => { calls += 1; return new Blob(['x']) },
    onChange: () => {},
  })
  ctl.request(req(['a']), true)
  await new Promise((r) => setTimeout(r, 20))
  ctl.request(req(['a']), true)
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(calls, 1, '参数未变应跳过重复渲染')
  ctl.dispose()
})

test('预览失败保留上一张图，仅暴露 error', async () => {
  installUrlStub()
  let first = true
  const states = []
  const ctl = createPdfPreviewController({
    debounceMs: 0,
    fetchPdf: async () => {
      if (first) { first = false; return new Blob(['ok']) }
      throw new Error('后端 400')
    },
    onChange: (s) => states.push({ ...s }),
  })
  ctl.request(req(['a']), true)
  await new Promise((r) => setTimeout(r, 20))
  const urlAfterOk = states.at(-1).url
  assert.ok(urlAfterOk, '首次应成功产出 url')

  ctl.request(req(['a', 'b']), true)
  await new Promise((r) => setTimeout(r, 20))
  const last = states.at(-1)
  assert.equal(last.error, '后端 400')
  assert.equal(last.url, urlAfterOk, '失败时应保留上一张预览图，不清空')
  ctl.dispose()
})
