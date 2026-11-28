import test from 'node:test'
import assert from 'node:assert/strict'
import { IMPORT_STATUS_LABELS, importProgress, importProgressText, importStatusType, importSheets, importErrorPage, importRequestError, importFileUrl, importResultStats, importSuccessText, isImportTaskFinished } from './importTask.ts'

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


const resultTask = (type, stats) => ({ task_type: type, status: 'SUCCESS', success_count: 100, result_stats: stats })

test('批量更新使用实际分类统计，零更新和全无变化属于正常完成', () => {
  const value = resultTask('PRODUCT_UPDATE', { updated_count: 0, unchanged_count: '100' })
  assert.equal(importSuccessText(value), '实际更新 0 个产品，无变化跳过 100 个产品')
  assert.equal(importProgressText(value), importSuccessText(value))
})

test('供应商和定价的首次新增与恢复计数独立，未知统计不显示', () => {
  const value = resultTask('PRODUCT_SUPPLIER', { created_count: 1, revived_count: 2, updated_count: 3, unchanged_count: 4, secret: 99 })
  assert.equal(importSuccessText(value), '首次新增 1，恢复绑定 2，实际更新 3，无变化 4')
  assert.equal(importResultStats({ ...value, task_type: 'PRODUCT_SALE_PRICE' })[1].label, '恢复定价')
})

test('旧维护任务缺少统计时不把 success_count 称为实际修改量', () => {
  assert.equal(importSuccessText(resultTask('PRODUCT_UPDATE')), '处理完成；此任务未提供分类统计')
  assert.equal(importSuccessText(resultTask('PRODUCT')), '已导入 100 行')
  assert.deepEqual(importResultStats(resultTask('PRODUCT_UPDATE', { updated_count: -1, unchanged_count: null })), [])
})

test('状态终态优先，系统错误不凭状态承诺回滚', () => {
  assert.equal(isImportTaskFinished({ status: 'SUCCESS', is_finished: false }), true)
  assert.equal(isImportTaskFinished({ status: 'VALIDATING', is_finished: false }), false)
  assert.equal(importProgressText({ status: 'FAILED_SYSTEM' }), '后台处理未完成，请查看失败原因')
})

test('上传界面保留后端具体限制，不以通用操作失败覆盖', () => {
  assert.equal(importRequestError({ response: { data: { message: '操作失败', data: { message: '无权修改销售价格' } } } }), '无权修改销售价格')
})
