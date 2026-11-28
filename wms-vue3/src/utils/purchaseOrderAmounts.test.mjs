import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computePurchaseOrderAmounts,
  lineAmountOf,
  lineDiscountText,
  lineGiftTotalOf,
  lineGrossText,
  linePayableText,
  moneyText,
  roundHalfUp2,
  toAmountNumber,
} from './purchaseOrderAmounts.ts'

test('roundHalfUp2 与后端 Decimal ROUND_HALF_UP 一致，不出现 toFixed 的向下偏', () => {
  // toFixed 的经典坑：1.005 在二进制里是 1.00499999…，toFixed 给 1.00，Python 给 1.01
  assert.equal(roundHalfUp2(1.005), 1.01)
  assert.equal(roundHalfUp2(2.675), 2.68)
  assert.equal(roundHalfUp2(0.125), 0.13)
  assert.equal(roundHalfUp2(10.994), 10.99)
  assert.equal(roundHalfUp2(10.995), 11)
  assert.equal(roundHalfUp2(-1.005), -1.01)
  assert.equal(roundHalfUp2(0), 0)
  for (const bad of [NaN, Infinity, -Infinity]) assert.equal(roundHalfUp2(bad), 0)
  // 1.005 的 toFixed 行为确实与后端不一致（记录差异，防止有人改成 toFixed）
  assert.equal((1.005).toFixed(2), '1.00')
})

test('toAmountNumber 与 moneyText 对空值/脏值按 0 处理', () => {
  for (const value of [null, undefined, '', '  ', 'abc', NaN, Infinity]) assert.equal(toAmountNumber(value), 0, String(value))
  assert.equal(toAmountNumber('12.345'), 12.345)
  assert.equal(toAmountNumber(12), 12)
  assert.equal(moneyText(null), '0.00')
  assert.equal(moneyText('7.005'), '7.01')
})

test('单行金额按 round(单价×数量,2) 逐行舍入，与后端同序', () => {
  // 21.23 × 5.6789 = 120.563047 → 120.56（数量保留 4 位小数不丢精度）
  assert.equal(lineAmountOf({ purchase_price: '21.23', qty: '5.6789' }), 120.56)
  assert.equal(lineAmountOf({ purchase_price: '0.1', qty: '3' }), 0.3)
  assert.equal(lineAmountOf({ purchase_price: '10', qty: '' }), 0)
  assert.equal(lineAmountOf({ purchase_price: '', qty: '5' }), 0)
  // 缺少字段本身（敏感裁剪）→ null，用于区别于「空串按 0 算」
  assert.equal(lineAmountOf({ qty: '5' }), null)
  assert.equal(lineAmountOf({ purchase_price: '3' }), null)
  assert.equal(lineAmountOf(null), null)
})

test('逐行舍入再求和，不等于先求和再舍入', () => {
  // 每行 1.005 × 1：逐行 = 1.01 × 3 = 3.03；先求和 = round(3.015) = 3.02
  const rows = [1, 2, 3].map(() => ({ purchase_price: '1.005', qty: '1' }))
  const result = computePurchaseOrderAmounts(rows, 0)
  assert.equal(result.orderAmountText, '3.03')
})

test('订单金额 = Σ 行金额；应付 = 订单金额 − 赠送 − 预付款', () => {
  const items = [
    { purchase_price: '21.23', qty: '5', line_use_gift_amount: '1.5' },
    { purchase_price: '10.5', qty: '2', line_use_gift_amount: '0.5' },
  ]
  const result = computePurchaseOrderAmounts(items, '20')
  // 106.15 + 21.00 = 127.15；127.15 − 2.00 − 20.00 = 105.15
  assert.equal(result.orderAmountText, '127.15')
  assert.equal(result.giftAmountText, '2.00')
  assert.equal(result.payableAmountText, '105.15')
  assert.equal(result.negative, false)
  assert.equal(result.redacted, false)
})

test('预付款按 max(值,0) 清洗，与后端 cash_prepayment 一致', () => {
  const items = [{ purchase_price: '100', qty: '1' }]
  assert.equal(computePurchaseOrderAmounts(items, '-50').payableAmountText, '100.00')
  assert.equal(computePurchaseOrderAmounts(items, 0).payableAmountText, '100.00')
  assert.equal(computePurchaseOrderAmounts(items, '30').payableAmountText, '70.00')
})

test('扣减超过订单金额时应付显示 0.00 并置 negative 标记', () => {
  const items = [{ purchase_price: '100', qty: '1', line_use_gift_amount: '80' }]
  const result = computePurchaseOrderAmounts(items, '30')
  assert.equal(result.orderAmountText, '100.00')
  assert.equal(result.payableAmountText, '0.00')
  assert.equal(result.negative, true)
  // 恰好抵完不算负数
  assert.equal(computePurchaseOrderAmounts(items, '20').negative, false)
  assert.equal(computePurchaseOrderAmounts(items, '20').payableAmountText, '0.00')
})

test('明细被敏感裁剪时沿用后端原值，不会把真实金额清成 0.00', () => {
  // 角色被限制「采购单价」后，后端详情不再下发 purchase_price
  const items = [{ qty: '5', amount: '106.15', payable_amount: '106.15' }]
  const result = computePurchaseOrderAmounts(items, 0, { order: '106.15', payable: '106.15' })
  assert.equal(result.redacted, true)
  assert.equal(result.orderAmountText, '106.15')
  assert.equal(result.payableAmountText, '106.15')
  // 部分行缺字段同样整体降级
  const mixed = [{ purchase_price: '10', qty: '1' }, { qty: '2' }]
  assert.equal(computePurchaseOrderAmounts(mixed, 0, { order: '88.88' }).orderAmountText, '88.88')
})

test('空明细与新表单：订单金额与应付金额都是 0.00，不带出 fallback', () => {
  for (const items of [[], null, undefined, 'oops']) {
    const result = computePurchaseOrderAmounts(items, '')
    assert.equal(result.orderAmountText, '0.00')
    assert.equal(result.payableAmountText, '0.00')
    assert.equal(result.redacted, false)
  }
})

test('编辑态兜底：明细为空但主单有金额时保留后端值，不清成 0.00', () => {
  // 详情接口失败降级为列表行数据 → items 为空，但主单 order_amount/payable_amount 仍有值
  const result = computePurchaseOrderAmounts([], 0, { order: '127.15', payable: '105.15' }, { allowFallback: true })
  assert.equal(result.orderAmountText, '127.15')
  assert.equal(result.payableAmountText, '105.15')
  assert.equal(result.redacted, true)
  // 新增态不传 allowFallback：空明细就是 0.00
  assert.equal(computePurchaseOrderAmounts([], 0, { order: '127.15' }).orderAmountText, '0.00')
})

test('Σ行赠送金额按行累加后两位舍入', () => {
  assert.equal(lineGiftTotalOf([{ line_use_gift_amount: '0.005' }, { line_use_gift_amount: '0.005' }]), 0.01)
  assert.equal(lineGiftTotalOf([{ line_use_gift_amount: '1' }, { line_use_gift_amount: null }]), 1)
  assert.equal(lineGiftTotalOf(undefined), 0)
})

test('明细三列：总原价实时按单价×数量，不看后端快照', () => {
  // 编辑态：后端快照 amount 是 100.00，用户把数量从 10 改成 20
  assert.equal(lineGrossText({ purchase_price: '10', qty: '20', amount: '100.00' }), '200.00')
  assert.equal(lineGrossText({ purchase_price: '21.23', qty: '5.6789', amount: '120.56' }), '120.56')
  // 敏感裁剪（无字段）时退回后端快照
  assert.equal(lineGrossText({ qty: '5', amount: '120.55' }), '120.55')
})

test('明细总应支付价：未改动时沿用后端分摊值，改动后按新金额现算', () => {
  // 未改动：行金额与后端快照一致 → 沿用 payable_amount（保住历史分摊差异）
  assert.equal(linePayableText({ purchase_price: '10', qty: '10', amount: '100.00', payable_amount: '99.50' }), '99.50')
  // 已改动：数量 10 → 20，快照 100.00 失效 → 按 200.00 现算
  assert.equal(linePayableText({ purchase_price: '10', qty: '20', amount: '100.00', payable_amount: '99.50' }), '200.00')
  // 新加行没有快照
  assert.equal(linePayableText({ purchase_price: '3.33', qty: '3' }), '9.99')
  // 敏感裁剪退回后端值
  assert.equal(linePayableText({ qty: '2', payable_amount: '20.00' }), '20.00')
})

test('明细总优惠金额 = 总原价 − 总应支付价，三列自洽', () => {
  const unchanged = { purchase_price: '10', qty: '10', amount: '100.00', payable_amount: '99.50' }
  assert.equal(lineDiscountText(unchanged), '0.50')
  const changed = { purchase_price: '10', qty: '20', amount: '100.00', payable_amount: '99.50' }
  assert.equal(lineDiscountText(changed), '0.00')
  // 敏感裁剪：退回后端 amount − payable_amount
  assert.equal(lineDiscountText({ qty: '2', amount: '100.00', payable_amount: '99.50' }), '0.50')
  assert.equal(lineDiscountText({ qty: '2' }), '0.00')
})
