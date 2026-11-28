import assert from 'node:assert/strict'
import test from 'node:test'
import { parseWmsToolOutcome, serializeWmsToolOutcome } from './toolOutcome.ts'

test('round-trips a structured WMS tool outcome', () => {
  const serialized = serializeWmsToolOutcome({
    ok: true,
    severity: 'success',
    code: 'navigation_completed',
    message: '已进入销售订单页面。',
    pageId: 'sales.order',
  })

  assert.deepEqual(parseWmsToolOutcome(serialized), {
    marker: 'wms-tool-outcome',
    ok: true,
    severity: 'success',
    code: 'navigation_completed',
    message: '已进入销售订单页面。',
    pageId: 'sales.order',
  })
})

test('ignores ordinary PageAgent tool output', () => {
  assert.equal(parseWmsToolOutcome('Task completed'), undefined)
  assert.equal(parseWmsToolOutcome('{"ok":true}'), undefined)
})
