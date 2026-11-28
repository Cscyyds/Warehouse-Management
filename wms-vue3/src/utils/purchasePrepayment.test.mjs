import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPurchasePrepayment, requiredPurchasePrepayment } from './purchasePrepayment.ts'

test('采购预付方式识别标准值与当前中文选项，不套用销售比例默认值', () => {
  assert.equal(isPurchasePrepayment('PREPAYMENT'), true)
  assert.equal(isPurchasePrepayment('预付款使用'), true)
  for (const value of ['CASH', '现结', 'MONTHLY', undefined]) assert.equal(isPurchasePrepayment(value), false)
})
test('默认全额、部分比例与边界不改变应付总额', () => {
  assert.equal(requiredPurchasePrepayment('123.45', 100), '123.45')
  assert.equal(requiredPurchasePrepayment('123.45', 40), '49.38')
  assert.equal(requiredPurchasePrepayment('100.00', 1), '1.00')
  assert.equal(requiredPurchasePrepayment('0.00', 100), '0.00')
  for (const ratio of [0, 101, 1.5, '', null, undefined, NaN]) assert.equal(requiredPurchasePrepayment('100.00', ratio), '-')
})
test('采购门槛采用后端 HALF_EVEN，半分两侧与大金额保持精度', () => {
  assert.equal(requiredPurchasePrepayment('0.01', 50), '0.00')
  assert.equal(requiredPurchasePrepayment('0.03', 50), '0.02')
  assert.equal(requiredPurchasePrepayment('0.05', 50), '0.02')
  assert.equal(requiredPurchasePrepayment('1.01', 50), '0.50')
  assert.equal(requiredPurchasePrepayment('99999999999999.99', 50), '50000000000000.00')
  for (const amount of [undefined, '', 'NaN', -1, '1.001']) assert.equal(requiredPurchasePrepayment(amount, 50), '-')
})
