import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalBoxLength, isValidBoxLength, boxLengthDisplay, boxLengthEditValue, boxLengthUpdate } from './plasticBoxLength.ts'

test('六位小数和十二位整数全程保留，超过精度与非法输入均不被静默修正', () => {
  assert.equal(canonicalBoxLength('000999999999999.12345600'), '999999999999.123456')
  assert.equal(isValidBoxLength('999999999999.123456'), true)
  for (const value of ['1000000000000', '1.1234567', '-1', 'NaN', 'Infinity', '1e3', '2,5']) {
    assert.equal(isValidBoxLength(value), false, value)
    assert.throws(() => boxLengthUpdate({ spec_length: value }), /指定长度/)
  }
})

test('有库存或缺少辅助单位的盒只编辑名称备注时不附带长度更新', () => {
  for (const value of ['2.123456', '999999999999.123456', null]) {
    assert.deepEqual(boxLengthUpdate({ spec_length: value, __spec_length_snapshot: value,
      box_stock_qty: 20, product_assist_unit_code: '', product_binding_valid: false }), {})
  }
  assert.deepEqual(boxLengthUpdate({ spec_length: '2.500000', __spec_length_snapshot: 2.5 }), {})
  assert.deepEqual(boxLengthUpdate({ spec_length: '', __spec_length_snapshot: '0.00' }), {})
})

test('真正修改长度时发送十进制值、识别时的单位与配置修订号', () => {
  assert.deepEqual(boxLengthUpdate({ spec_length: '2.123456', __spec_length_snapshot: '2',
    product_assist_unit_code: 'mm', length_revision: 7 }), {
    spec_length: '2.123456', expected_length_revision: '7', expected_length_unit: 'mm',
  })
  assert.throws(() => boxLengthUpdate({ spec_length: '2.5', product_assist_unit_code: '' }), /辅助计量/)
})

test('最大精度编辑值读取快照文本，兼容数值字段的浮点损失不会进入表单', () => {
  const value = boxLengthEditValue({ spec_length: 999999999999.123456, spec_length_text: '999999999999.123456,mm' })
  assert.equal(value, '999999999999.123456')
  assert.deepEqual(boxLengthUpdate({ spec_length: value, __spec_length_snapshot: value }), {})
})

test('解除指定长度不依赖产品当前辅助单位，仍携带版本以检测并发变更', () => {
  assert.deepEqual(boxLengthUpdate({ spec_length: '', __spec_length_snapshot: '2.5', length_revision: 0 }),
    { spec_length: '0', expected_length_revision: '0' })
})

test('快照文本包含原单位，旧值显式按兼容米展示，新版缺失快照不伪装成未指定', () => {
  assert.equal(boxLengthDisplay({ spec_length: 2500, spec_length_text: '2500,mm', length_version: 1 }), '2500,mm')
  assert.equal(boxLengthDisplay({ spec_length: '2.123456' }), '2.123456,m')
  assert.equal(boxLengthDisplay({ spec_length: 0, length_version: 1, length_status: 4 }), '未指定')
  for (const length_status of [0, 1, 3]) {
    assert.equal(boxLengthDisplay({ spec_length: 0, length_version: 1, length_status }), '配置异常')
  }
})
