import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as apiError from './apiError.ts'
import * as binary from './binaryDownload.ts'

function harness() {
  const errors = [], saved = [], success = [], exports = {}
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { saved.push(this.download) }, remove() {} }) }
  const imports = { 'element-plus': { ElMessage: { error: message => errors.push(message), success: message => success.push(message) } }, './apiError': apiError, './binaryDownload': binary }
  const source = ts.transpileModule(readFileSync(new URL('./download.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  new Function('require', 'exports', source)(name => imports[name], exports)
  return { ...exports, errors, saved, success, close() { if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor); else delete globalThis.document } }
}

test('PDF预判放行后服务端仍可403，包装Blob错误按中文展示且不下载', async () => {
  const h = harness()
  try {
    const error = Object.assign(new Error('Request failed with status code 403'), { response: { status: 403, data: new Blob([JSON.stringify({ data: { message: '当前角色无权限查看，禁止导出打印', blocked_fields: [{ field_label: '采购单价' }] } })], { type: 'application/json' }) } })
    await assert.rejects(h.downloadPdf({ request: async () => { throw error }, fileName: '订单.pdf' }))
    assert.match(h.errors[0], /采购单价/); assert.deepEqual(h.saved, []); assert.deepEqual(h.success, [])
  } finally { h.close() }
})

test('HTTP200 JSON不保存为PDF，正常PDF仍可下载；不要求旧调用方传新选项', async () => {
  const h = harness()
  try {
    await assert.rejects(h.downloadPdf({ request: async () => new Blob([JSON.stringify({ detail: { message: '无权打印' } })], { type: 'application/json' }), fileName: '错误.pdf' }), /无权打印/)
    assert.deepEqual(h.saved, [])
    await h.downloadPdf({ request: async () => new Blob(['%PDF-1.4\n']), fileName: '正常.pdf' })
    assert.deepEqual(h.saved, ['正常.pdf']); assert.equal(h.success.length, 1)
  } finally { h.close() }
})

test('PDF请求等待期间切换页面或登录，不保存迟到的文件或弹旧结果', async () => {
  const h = harness()
  let resolve, current = true
  try {
    const pending = h.downloadPdf({ request: () => new Promise(done => { resolve = done }), fileName: '旧会话.pdf', isCurrent: () => current })
    current = false; resolve(new Blob(['%PDF-1.4\n'])); await pending
    assert.deepEqual(h.saved, []); assert.deepEqual(h.success, []); assert.deepEqual(h.errors, [])
  } finally { h.close() }
})
