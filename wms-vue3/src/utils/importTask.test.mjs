import test from 'node:test'
import assert from 'node:assert/strict'
import { IMPORT_STATUS_LABELS, importProgress, importProgressText, importStatusType, importSheets, importErrorPage, importRequestError, importFileUrl } from './importTask.ts'

const task = { status: 'VALIDATING', total_count: 100, processed_count: 100, success_count: 0, error_count: 2 }

test('all six statuses are labelled and writing is not completion', () => {
  assert.equal(Object.keys(IMPORT_STATUS_LABELS).length, 6)
  assert.equal(importProgress(task), 100)
  assert.equal(importProgressText(task), '已校验 100 / 100 行')
  assert.equal(importProgressText({ ...task, status: 'WRITING' }), '校验完成，正在写入')
  assert.equal(importProgressText({ ...task, status: 'FAILED_VALIDATION' }), '异常 2 行 · 全部未导入')
  assert.equal(importProgressText({ ...task, status: 'SUCCESS', success_count: 100 }), '已导入 100 行')
  assert.equal(importStatusType('FAILED_SYSTEM'), 'danger')
})

test('empty and out-of-range validation progress stays bounded', () => {
  assert.equal(importProgress({ ...task, total_count: 0 }), 0)
  assert.equal(importProgress({ ...task, processed_count: 120 }), 100)
  assert.equal(importProgress({ ...task, processed_count: -1 }), 0)
})

test('single sheet pagination uses error_total, not page length or valid_count', () => {
  const errors = [{ row: 51, name: 'A', reason: '错误' }]
  assert.deepEqual(importErrorPage({ errors, error_total: 99, valid_count: 400 }), { rows: errors, total: 99 })
})

test('double sheet pagination never adds both totals or flattens both pages', () => {
  for (const type of ['sales-order', 'purchase-order']) {
    const [main, item] = importSheets(type)
    const mainRows = [{ row: 2, name: '主单', reason: '错误' }]
    const itemRows = [{ row: 8, name: '明细', reason: '错误' }]
    const detail = { errors: { [main.key]: mainRows, [item.key]: itemRows }, [main.key]: { invalid_count: 1 }, [item.key]: { invalid_count: 151 } }
    assert.deepEqual(importErrorPage(detail, main.key), { rows: mainRows, total: 1 })
    assert.deepEqual(importErrorPage(detail, item.key), { rows: itemRows, total: 151 })
  }
  for (const type of ['employee', 'product', 'customer', 'supplier']) assert.deepEqual(importSheets(type), [])
})

test('errors preserve backend messages without treating transport failure as task failure', () => {
  assert.equal(importRequestError({ response: { data: { detail: '导入任务不存在或已删除' } } }), '导入任务不存在或已删除')
  assert.equal(importRequestError({ response: { data: { message: '缺少表头<br/>名称' } } }), '缺少表头\n名称')
  assert.equal(importRequestError(new Error('Network Error')), 'Network Error')
})

test('original file links only permit HTTP protocols', () => {
  assert.equal(importFileUrl('https://example.test/import.xlsx'), 'https://example.test/import.xlsx')
  for (const url of [null, '', 'javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'invalid']) assert.equal(importFileUrl(url), undefined)
})
