import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyAgentCompletion } from './agentCompletionState.ts'

test('renders an unfulfilled completion as incomplete rather than error', () => {
  assert.deepEqual(classifyAgentCompletion(false, false), {
    messageKind: 'incomplete',
    status: 'incomplete',
    activityText: '任务需要进一步明确',
  })
})

test('keeps technical failures red', () => {
  assert.deepEqual(classifyAgentCompletion(false, true), {
    messageKind: 'error',
    status: 'error',
    activityText: '任务执行失败',
  })
})

test('keeps verified success green', () => {
  assert.deepEqual(classifyAgentCompletion(true, false), {
    messageKind: 'result',
    status: 'success',
    activityText: '任务已完成',
  })
})
