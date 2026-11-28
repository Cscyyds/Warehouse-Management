import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveOutboundTrace, hasOutboundTrace } from './mergePackageOutboundTrace.ts'

test('详情成功而列表失败时仍有真实出库追溯', () => {
  for (const type of ['PRODUCTION_OUT', 'NATIVE_PROD_OUT', 'SALES_OUT']) {
    const trace = resolveOutboundTrace({ biz_item_id: 'i1', outbound_type: type, outbound_doc_no: 'D1' }, null)
    assert.equal(trace.outbound_doc_no, 'D1')
    assert.equal(hasOutboundTrace(trace), true)
  }
})
test('只有旧详情完全缺少字段时，整组回退列表；两者失败无追溯', () => {
  const list = { outbound_type: 'SALES_OUT', outbound_doc_no: 'S1' }
  assert.equal(resolveOutboundTrace({}, list), list)
  assert.equal(resolveOutboundTrace(null, list), list)
  assert.equal(hasOutboundTrace(resolveOutboundTrace(null, null)), false)
  assert.equal(hasOutboundTrace({ biz_item_id: 'missing-document-item' }), true)
})
test('详情显式空值保持权威，不能复活列表旧来源', () => {
  const trace = resolveOutboundTrace({ outbound_type: null, outbound_doc_no: null }, { outbound_type: 'SALES_OUT', outbound_doc_no: 'STALE' })
  assert.equal(trace.outbound_doc_no, null)
  assert.equal(hasOutboundTrace(trace), false)
  assert.equal(resolveOutboundTrace({ outbound_type: 'SALES_OUT', outbound_doc_no: '' }, { outbound_doc_no: 'STALE' }).outbound_doc_no, '')
})
test('列表单位只能补充同一来源，不能拼接另一单据或同单其他明细', () => {
  const detail = { biz_item_id: 'i1', outbound_type: 'PRODUCTION_OUT', outbound_doc_id: 'd1', outbound_doc_no: null }
  const list = { ...detail, outbound_doc_no: '旧单号', outbound_partner_name: '同来源单位' }
  assert.equal(resolveOutboundTrace(detail, list).outbound_partner_name, '同来源单位')
  assert.equal(resolveOutboundTrace(detail, list).outbound_doc_no, null)
  for (const changed of [{ biz_item_id: 'i2' }, { outbound_doc_id: 'd2' }, { outbound_type: 'SALES_OUT' }]) {
    assert.equal(resolveOutboundTrace(detail, { ...list, ...changed }).outbound_partner_name, undefined)
  }
})
