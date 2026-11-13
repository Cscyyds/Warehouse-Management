import assert from 'node:assert/strict'
import test from 'node:test'
import { decideIntentConfidence } from './intentConfidence.ts'

test('accepts a candidate above the threshold with a clear lead', () => {
  assert.equal(decideIntentConfidence([
    { score: 150, value: 'delivery.task' },
    { score: 90, value: 'delivery.logistics' },
  ]).kind, 'confident')
})

test('rejects weak substring-only matches', () => {
  assert.equal(decideIntentConfidence([
    { score: 24, value: 'customer.info' },
  ]).kind, 'insufficient')
})

test('requires clarification when the first and second candidates are too close', () => {
  assert.equal(decideIntentConfidence([
    { score: 150, value: 'purchase.order' },
    { score: 140, value: 'sales.order' },
  ]).kind, 'ambiguous')
})
