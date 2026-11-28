import assert from 'node:assert/strict'
import test from 'node:test'
import {
  beginTaskExecution,
  clearTaskExecution,
  recordTaskActionSuccess,
  recordTaskNavigationSuccess,
  verifyTaskCompletion,
} from './taskExecutionLedger.ts'

test('rejects navigation completion without matching evidence', () => {
  beginTaskExecution('task-nav', {
    kind: 'navigation',
    expectedPageId: 'sales.order',
    expectedMode: 'list',
  })

  const missing = verifyTaskCompletion('task-nav', {
    success: true,
    text: '已到达销售订单页面。',
  })
  assert.equal(missing.success, false)
  assert.match(missing.text, /未检测到/)

  recordTaskNavigationSuccess('task-nav', 'purchase.order', 'list')
  assert.equal(verifyTaskCompletion('task-nav', { success: true, text: '已到达。' }).success, false)

  recordTaskNavigationSuccess('task-nav', 'sales.order', 'list')
  assert.equal(verifyTaskCompletion('task-nav', { success: true, text: '已到达销售订单页面。' }).success, true)
  clearTaskExecution('task-nav')
})

test('rejects a business-action completion without the expected action', () => {
  beginTaskExecution('task-action', {
    kind: 'business-action',
    expectedPageId: 'customer.info.list',
    expectedActionIds: ['customer.search'],
  })

  recordTaskActionSuccess('task-action', 'sales-order.search', 'sales.order.list')
  assert.equal(verifyTaskCompletion('task-action', { success: true, text: '查询完成。' }).success, false)

  recordTaskActionSuccess('task-action', 'customer.search', 'customer.info.list')
  assert.equal(verifyTaskCompletion('task-action', { success: true, text: '客户查询完成。' }).success, true)
  clearTaskExecution('task-action')
})

test('rejects the expected action when it ran on a different registered page', () => {
  beginTaskExecution('task-action-page', {
    kind: 'business-action',
    expectedPageId: 'purchase.order.list',
    expectedActionIds: ['purchase-order.search'],
  })

  recordTaskActionSuccess('task-action-page', 'purchase-order.search', 'sales.order.list')
  assert.equal(
    verifyTaskCompletion('task-action-page', { success: true, text: '采购订单查询完成。' }).success,
    false,
  )

  recordTaskActionSuccess('task-action-page', 'purchase-order.search', 'purchase.order.list')
  assert.equal(
    verifyTaskCompletion('task-action-page', { success: true, text: '采购订单查询完成。' }).success,
    true,
  )
  clearTaskExecution('task-action-page')
})

test('downgrades an unsupported navigation claim in an open task', () => {
  beginTaskExecution('task-open', { kind: 'open' })
  const result = verifyTaskCompletion('task-open', {
    success: true,
    text: '已经为您打开产品库存页面。',
  })
  assert.equal(result.success, false)
  assert.match(result.text, /没有实际完成页面导航/)
  clearTaskExecution('task-open')
})

test('preserves an explicitly incomplete result', () => {
  beginTaskExecution('task-incomplete', { kind: 'open' })
  const result = verifyTaskCompletion('task-incomplete', {
    success: false,
    text: '请告诉我具体需要查看哪个财务页面。',
  })
  assert.deepEqual(result, {
    success: false,
    text: '请告诉我具体需要查看哪个财务页面。',
  })
  clearTaskExecution('task-incomplete')
})
