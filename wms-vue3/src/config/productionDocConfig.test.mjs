import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// 执行真实配置模块；避免仅在源码中查找字段却未验证具体单据的列。
const source = readFileSync(new URL('./productionDocConfig.ts', import.meta.url), 'utf8')
const exports = {}
new Function('exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(exports)
const docs = exports.PRODUCTION_DOC_CONFIG_MAP

test('成品缴库明细有可见长度列，按每行原值显示而不取表头', () => {
  const column = docs['finished-goods-stockin'].itemColumns.find(c => c.prop === 'prd_mark')
  assert.ok(column)
  assert.equal(column.label, '长度')
  assert.ok(column.width > 0 || column.minWidth > 0)
  const items = [{ prd_mark: '2500mm' }, { prd_mark: '3m' }]
  assert.deepEqual(items.map(row => row[column.prop]), ['2500mm', '3m'])
  assert.equal(docs['finished-goods-stockin'].headerColumns.some(c => c.prop === 'prd_mark'), false)
})

test('三类生产领退补表头与明细各自展示长度', () => {
  for (const key of ['production-picking', 'production-return', 'production-supplement']) {
    assert.equal(docs[key].headerColumns.filter(c => c.prop === 'prd_mark').length, 1, key)
    assert.equal(docs[key].itemColumns.filter(c => c.prop === 'prd_mark').length, 1, key)
  }
})

test('13类生产单据的长度列无遗漏或重复', () => {
  assert.equal(Object.keys(docs).length, 13)
  for (const doc of Object.values(docs)) {
    assert.equal(doc.itemColumns.filter(c => c.prop === 'prd_mark').length, 1, doc.docKey)
  }
})
