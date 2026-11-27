import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveInboundTraces } from './mergePackageInboundTraces.ts'

test('detail and list trace arrays are preserved with detail taking priority', () => {
  const detail = [{ inbound_type: 'PURCHASE_IN', inbound_biz_item_id: '1' }, { inbound_type: 'SALES_RETURN', inbound_biz_item_id: '2' }]
  const list = [{ inbound_type: 'OTHER_IN', inbound_biz_item_id: '3' }]
  assert.deepEqual(resolveInboundTraces({ inbound_traces: detail }, { inbound_traces: list }), detail)
  assert.deepEqual(resolveInboundTraces({ inbound_traces: [] }, { inbound_traces: list }), list)
})

test('legacy fields fall back individually and order-only records remain visible', () => {
  const [trace] = resolveInboundTraces({ inbound_type: 'PURCHASE_IN', inbound_doc_no: null }, { inbound_doc_no: 'IN-1', inbound_order_no: 'PO-1' })
  assert.equal(trace.inbound_type, 'PURCHASE_IN')
  assert.equal(trace.inbound_doc_no, 'IN-1')
  assert.equal(trace.inbound_order_no, 'PO-1')
  assert.equal(resolveInboundTraces(null, { inbound_order_no: 'PO-2' })[0].inbound_order_no, 'PO-2')
  assert.deepEqual(resolveInboundTraces(null, null), [])
})
