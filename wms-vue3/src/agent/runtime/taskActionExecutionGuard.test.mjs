import assert from 'node:assert/strict'
import test from 'node:test'
import {
  actionExecutionFingerprint,
  clearTaskActionCompletion,
  clearTaskActions,
  getTaskActionCompletion,
  recordTaskActionCompletion,
  releaseTaskAction,
  reserveTaskAction,
} from './taskActionExecutionGuard.ts'

test('blocks the same action and arguments from running twice in one task', () => {
  const fingerprint = actionExecutionFingerprint('customer.search', { page: 1 })
  assert.equal(reserveTaskAction('task-1', fingerprint), true)
  assert.equal(reserveTaskAction('task-1', fingerprint), false)
  assert.equal(reserveTaskAction('task-2', fingerprint), true)
  clearTaskActions('task-1')
  clearTaskActions('task-2')
})

test('allows a failed action reservation to be released for a retry', () => {
  const fingerprint = actionExecutionFingerprint('customer.search', { customerName: '广州' })
  assert.equal(reserveTaskAction('task-retry', fingerprint), true)
  releaseTaskAction('task-retry', fingerprint)
  assert.equal(reserveTaskAction('task-retry', fingerprint), true)
  clearTaskActions('task-retry')
})

test('retains the first completed action result until the task lifecycle consumes it', () => {
  const fingerprint = actionExecutionFingerprint('customer.search', { customerName: '沃尔玛' })
  recordTaskActionCompletion('task-complete', fingerprint, '查询完成')

  assert.deepEqual(getTaskActionCompletion('task-complete'), {
    fingerprint,
    message: '查询完成',
  })

  clearTaskActionCompletion('task-complete')
  assert.equal(getTaskActionCompletion('task-complete'), undefined)
})
