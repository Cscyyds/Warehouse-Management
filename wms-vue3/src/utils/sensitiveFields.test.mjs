import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clearSensitivePaths, omitSensitivePaths, sensitivePathCovers, responseSensitiveRestrictions } from './sensitiveFields.ts'

test('嵌套数组受限参数被省略，行主键及未受限字段保留，原始对象不变', () => {
  const source = { items: [{ id: 'a', sale_price: '0', remark: '说明', products: [{ id: 'p', amount: '1' }] }] }
  const value = omitSensitivePaths(source, ['items[].sale_price', 'items[].products[].amount'])
  assert.deepEqual(value, { items: [{ id: 'a', remark: '说明', products: [{ id: 'p' }] }] })
  assert.equal(source.items[0].sale_price, '0')
  assert.equal(source.items[0].products[0].amount, '1')
})

test('支持数组根路径，金额与同名后缀不相互误伤', () => {
  assert.deepEqual(omitSensitivePaths([{ total_sales_amount: '1', total_amount: '2' }], ['[].total_sales_amount']), [{ total_amount: '2' }])
  assert.equal(sensitivePathCovers('items[].amount', 'items[].tax_amount'), false)
  assert.equal(sensitivePathCovers('items[].price', 'items[].price.amount'), true)
})

test('非法及原型路径拒绝处理，防止静默漏删或改变原型', () => {
  for (const path of ['items[0].price', '__proto__.price', 'items..price']) assert.throws(() => omitSensitivePaths({}, [path]))
})

test('只消费响应明确返回的限制元信息，不把空数组当作受限证据', () => {
  assert.deepEqual(responseSensitiveRestrictions([]), [])
  assert.deepEqual(responseSensitiveRestrictions({ restricted_sensitive_fields: [{ field_id: 'cost', field_label: '成本', param_names: ['items[].cost'] }] }), [{ field_id: 'cost', field_label: '成本', param_names: ['items[].cost'] }])
})

test('清理表单敏感值保持弹窗持有的明细行身份和非受限值', () => {
  const row = { id: 's1', price: '12', remark: '原' }, draft = { suppliers: [row] }
  clearSensitivePaths(draft, ['suppliers[].price'])
  assert.equal(draft.suppliers[0], row); assert.deepEqual(row, { id: 's1', remark: '原' })
  row.remark = '通过弹窗更新'; assert.equal(draft.suppliers[0].remark, '通过弹窗更新')
})
