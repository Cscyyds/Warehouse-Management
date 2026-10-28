import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAmountSummary } from './useTableSummary.ts'
const columns = [{ type: 'selection' }, { property: 'name' }, { property: 'amount' }]
test('金额合计要求每行完整，缺键/空白/非法值不会按零参与计算', () => {
  const summary = createAmountSummary(['amount'])
  for (const row of [{}, { amount: null }, { amount: '' }, { amount: 'bad' }, { amount: Infinity }]) assert.equal(summary({ columns, data: [{ amount: '10' }, row] })[2], '-')
  assert.equal(summary({ columns, data: [{ amount: '0' }, { amount: '10.50' }] })[2], '¥10.50')
})
test('指标未授权时合计留空，零值和空列表不会误判为被隐藏', () => {
  assert.equal(createAmountSummary(['amount'], () => false)({ columns, data: [{ amount: '12' }] })[2], '')
  assert.equal(createAmountSummary(['amount'])({ columns, data: [] })[2], '¥0.00')
})
