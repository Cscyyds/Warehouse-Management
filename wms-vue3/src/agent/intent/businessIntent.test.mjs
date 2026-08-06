import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLocalBusinessIntent } from './businessIntent.ts'

const now = new Date('2026-08-06T10:30:00+08:00')

test('normalizes today purchase wording into a structured purchase-order query', () => {
  const intent = resolveLocalBusinessIntent('今天采购了什么', now)
  assert.equal(intent?.intent, 'purchase_order.query')
  assert.equal(intent?.operation, 'query')
  assert.deepEqual(intent?.slots, {
    timeExpression: '今天',
    createdStart: '2026-08-06',
    createdEnd: '2026-08-06',
  })
  assert.ok((intent?.confidence ?? 0) >= 0.85)
})

test('normalizes yesterday purchase wording with a deterministic date range', () => {
  const intent = resolveLocalBusinessIntent('昨天采购了什么', now)
  assert.equal(intent?.slots.createdStart, '2026-08-05')
  assert.equal(intent?.slots.createdEnd, '2026-08-05')
})

test('does not guess a page for a broad purchase-module request', () => {
  assert.equal(resolveLocalBusinessIntent('看一下采购', now), null)
})

test('normalizes explicit purchase inbound and purchase return wording', () => {
  const inbound = resolveLocalBusinessIntent('查看今天的采购入库单', now)
  assert.equal(inbound?.intent, 'purchase_inbound.query')
  assert.equal(inbound?.slots.createdStart, '2026-08-06')

  const purchaseReturn = resolveLocalBusinessIntent('查看昨天的采购退货单', now)
  assert.equal(purchaseReturn?.intent, 'purchase_return.query')
  assert.equal(purchaseReturn?.slots.createdStart, '2026-08-05')
})

test('defaults an unqualified return question to purchase returns', () => {
  const intent = resolveLocalBusinessIntent('我想看看最近有没有什么退货的情况', now)
  assert.equal(intent?.intent, 'purchase_return.query')
  assert.equal(intent?.slots.createdStart, '2026-07-31')
  assert.equal(intent?.slots.createdEnd, '2026-08-06')
  assert.deepEqual(intent?.requestedFields, ['purchase_returns'])
})

test('normalizes an explicit customer-info query without using the model', () => {
  const intent = resolveLocalBusinessIntent('查一下客户信息', now)
  assert.equal(intent?.intent, 'customer.query')
  assert.equal(intent?.operation, 'query')
  assert.deepEqual(intent?.slots, {})
  assert.ok((intent?.confidence ?? 0) >= 0.85)
})

test('normalizes a named product-info query', () => {
  const intent = resolveLocalBusinessIntent('查一下旺仔牛奶的产品资料', now)
  assert.equal(intent?.intent, 'product.query')
  assert.equal(intent?.slots.productName, '旺仔牛奶')
})

test('normalizes named and generic supplier-info queries', () => {
  const named = resolveLocalBusinessIntent('查一下沃尔玛的供应商资料', now)
  assert.equal(named?.intent, 'supplier.query')
  assert.equal(named?.slots.supplierName, '沃尔玛')

  const generic = resolveLocalBusinessIntent('我想看供货商资料', now)
  assert.equal(generic?.intent, 'supplier.query')
  assert.equal(generic?.slots.supplierName, undefined)
})

test('normalizes employee, sales-return and inbound-detail queries', () => {
  const employee = resolveLocalBusinessIntent('帮我查一下张三的员工信息', now)
  assert.equal(employee?.intent, 'employee.query')
  assert.equal(employee?.slots.employeeName, '张三')

  const salesReturn = resolveLocalBusinessIntent('查看昨天的销售退货单', now)
  assert.equal(salesReturn?.intent, 'sales_return.query')
  assert.equal(salesReturn?.slots.createdStart, '2026-08-05')

  const inboundDetail = resolveLocalBusinessIntent('昨天入了什么货', now)
  assert.equal(inboundDetail?.intent, 'purchase_inbound_detail.query')
  assert.equal(inboundDetail?.slots.createdStart, '2026-08-05')
})

test('separates sales detail, sales ranking and supplier balance queries', () => {
  const detail = resolveLocalBusinessIntent('昨天卖了什么货', now)
  assert.equal(detail?.intent, 'sales_order_detail.query')
  assert.equal(detail?.slots.createdStart, '2026-08-05')

  const ranking = resolveLocalBusinessIntent('哪些商品卖得最好', now)
  assert.equal(ranking?.intent, 'product_sales_summary.query')
  assert.equal(ranking?.slots.salesRankBy, 'quantity')

  const balance = resolveLocalBusinessIntent('查一下沃尔玛的供应商余额', now)
  assert.equal(balance?.intent, 'supplier_balance.query')
  assert.equal(balance?.slots.supplierName, '沃尔玛')
})

test('normalizes a colloquial inventory query', () => {
  const intent = resolveLocalBusinessIntent('旺仔牛奶还有多少库存', now)
  assert.equal(intent?.intent, 'inventory.query')
  assert.equal(intent?.slots.inventoryKeyword, '旺仔牛奶')
})

test('keeps stock-check wording out of ordinary inventory search', () => {
  assert.equal(resolveLocalBusinessIntent('查看库存盘点', now), null)
})

test('normalizes yesterday shipping into a delivery-task date query', () => {
  const intent = resolveLocalBusinessIntent('我先看一下昨天出了什么货', now)
  assert.equal(intent?.intent, 'delivery_task.query')
  assert.equal(intent?.slots.createdStart, '2026-08-05')
  assert.equal(intent?.slots.createdEnd, '2026-08-05')
})
