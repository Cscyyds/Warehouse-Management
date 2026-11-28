import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const output = ts.transpileModule(readFileSync(new URL('./productBatch.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const calls = [], exports = {}
new Function('require', 'exports', output)(() => ({ postBinary: (url, data) => { calls.push({ url, data }); return Promise.resolve({}) }, post() {}, toMultipart: x => x }), exports)
test('空选中或只有空ID不退化成全量导出', () => {
  assert.throws(() => exports.exportProductData([]), /勾选/)
  assert.throws(() => exports.exportProductData([' ', '']), /勾选/)
  assert.equal(calls.length, 0)
})
test('选中去重并使用POST JSON，全量明确使用空对象', async () => {
  await exports.exportProductData(['p1', ' p1 ', 'p2'])
  await exports.exportProductData(undefined, true)
  assert.deepEqual(calls, [{ url: '/api/v1/tenant-products/export', data: { product_ids: ['p1', 'p2'] } }, { url: '/api/v1/tenant-products/positions/export', data: {} }])
})
