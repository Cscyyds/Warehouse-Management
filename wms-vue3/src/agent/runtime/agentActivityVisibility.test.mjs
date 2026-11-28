import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldDisplayAgentActivity } from './agentActivityVisibility.ts'

test('keeps model retries in the background while preserving user-facing activities', () => {
  assert.equal(shouldDisplayAgentActivity('retrying'), false)

  for (const activityType of ['thinking', 'executing', 'executed', 'error']) {
    assert.equal(shouldDisplayAgentActivity(activityType), true, activityType)
  }
})
