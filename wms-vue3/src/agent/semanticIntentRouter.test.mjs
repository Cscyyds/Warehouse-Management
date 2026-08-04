import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveDeterministicTaskIntent } from './semanticIntentRouter.ts'

test('routes an explicit sales-order navigation deterministically', () => {
  const results = Array.from({ length: 20 }, () =>
    resolveDeterministicTaskIntent('帮我定位到销售订单'),
  )

  for (const result of results) {
    assert.equal(result.kind, 'navigate')
    assert.equal(result.pageId, 'sales.order')
    assert.equal(result.mode, 'list')
  }
})

test('routes explicit creation to create mode', () => {
  const result = resolveDeterministicTaskIntent('新增销售订单')
  assert.equal(result.kind, 'navigate')
  assert.equal(result.pageId, 'sales.order')
  assert.equal(result.mode, 'create')
})

test('uses semantic keywords for a clear inventory page request', () => {
  const result = resolveDeterministicTaskIntent('我想看库存')
  assert.equal(result.kind, 'navigate')
  assert.equal(result.pageId, 'warehouse.stock')
})

test('routes the four verified colloquial smoke-test expressions deterministically', () => {
  const cases = [
    ['仓库里现在还有什么货', 'warehouse.stock'],
    ['看看公海里的客户', 'customer.public'],
    ['查一下给供应商的付款单', 'finance.payment-order'],
    ['今天有哪些货要送', 'delivery.task'],
  ]

  for (const [task, expectedPageId] of cases) {
    const results = Array.from({ length: 20 }, () => resolveDeterministicTaskIntent(task))
    for (const result of results) {
      assert.equal(result.kind, 'navigate')
      assert.equal(result.pageId, expectedPageId)
      assert.equal(result.mode, 'list')
    }
  }
})

test('keeps supplier prepayments out of ordinary supplier payment routing', () => {
  const result = resolveDeterministicTaskIntent('我想看给供应商付的预付款')
  assert.equal(result.kind, 'navigate')
  assert.equal(result.pageId, 'finance.prepayment')
})

test('routes a broad finance request to the finance top navigation', () => {
  const result = resolveDeterministicTaskIntent('我想看一下财务情况')
  assert.equal(result.kind, 'navigate-section')
  assert.equal(result.section, 'finance')
  assert.equal(result.sectionTitle, '财务管理')
})

test('routes recent-finance-overview wording to the finance top navigation', () => {
  const results = Array.from({ length: 20 }, () =>
    resolveDeterministicTaskIntent('帮我查一下最近的财务情况'),
  )

  for (const result of results) {
    assert.equal(result.kind, 'navigate-section')
    assert.equal(result.section, 'finance')
  }
})

test('keeps an explicit finance page request on page-level navigation', () => {
  const result = resolveDeterministicTaskIntent('我想查看收款单')
  assert.equal(result.kind, 'navigate')
  assert.equal(result.pageId, 'finance.transfer')
})

test('routes colloquial outbound-goods wording to the sales-order page only', () => {
  const tasks = ['我昨天有什么货出库了', '我想看一下昨天出了什么货']
  for (const task of tasks) {
    const results = Array.from({ length: 20 }, () => resolveDeterministicTaskIntent(task))
    for (const result of results) {
      assert.equal(result.kind, 'navigate')
      assert.equal(result.pageId, 'sales.order')
      assert.equal(result.mode, 'list')
    }
  }
})

test('uses supplier wording to keep purchase returns out of sales outbound routing', () => {
  const result = resolveDeterministicTaskIntent('我想看昨天退给供应商的货')
  assert.equal(result.kind, 'navigate')
  assert.equal(result.pageId, 'purchase.return')
})

test('recognizes colloquial purchase inbound item queries', () => {
  const result = resolveDeterministicTaskIntent('昨天入了什么货')
  assert.equal(result.kind, 'navigate')
  assert.equal(result.pageId, 'purchase.report.inbound-detail')
})

test('routes a colloquial outbound overview request to sales orders', () => {
  const result = resolveDeterministicTaskIntent('我想看昨天的出库情况')
  assert.equal(result.kind, 'navigate')
  assert.equal(result.pageId, 'sales.order')
})

test('recognizes colloquial delivery task queries without confusing them with outbound goods', () => {
  const result = resolveDeterministicTaskIntent('昨天发了哪些配送单')
  assert.equal(result.kind, 'navigate')
  assert.equal(result.pageId, 'delivery.task')
})

test('routes representative colloquial requests across the whole WMS catalog', () => {
  const cases = [
    ['回到工作台', 'dashboard.overview'],
    ['我想看员工资料', 'system.personnel'],
    ['现在谁在线', 'system.online'],
    ['看看待分配的客户', 'customer.public'],
    ['客户还有多少授信额度', 'customer.finance.credit'],
    ['哪些货卖不动', 'product.unsold'],
    ['仓库里现在还有多少货', 'warehouse.stock'],
    ['我想看供货商资料', 'purchase.supplier'],
    ['我们还欠供应商多少钱', 'purchase.report.supplier-balance'],
    ['我想看采购订单', 'purchase.order'],
    ['客户把货退回来了', 'sales.return'],
    ['哪些商品卖得最好', 'sales.report.product-summary'],
    ['这个客户买过什么货', 'sales.report.customer-order-detail'],
    ['今天要送哪些订单', 'delivery.task'],
    ['我想查一下快递单号', 'delivery.logistics'],
    ['我想看公司银行卡', 'finance.bank-account'],
    ['我想看收到的货款', 'finance.transfer'],
    ['我想看给供应商付的预付款', 'finance.prepayment'],
  ]

  for (const [task, expectedPageId] of cases) {
    const result = resolveDeterministicTaskIntent(task)
    assert.equal(result.kind, 'navigate', task)
    assert.equal(result.pageId, expectedPageId, task)
  }
})

test('routes recent-new-customer wording to newly developed customers', () => {
  const results = Array.from({ length: 20 }, () =>
    resolveDeterministicTaskIntent('最近有哪些新客户'),
  )

  for (const result of results) {
    assert.equal(result.kind, 'navigate')
    assert.equal(result.pageId, 'customer.new')
    assert.equal(result.mode, 'list')
  }
})

test('routes a supported customer query to its registered action contract', () => {
  const result = resolveDeterministicTaskIntent('帮我查一下广州的客户信息')
  assert.equal(result.kind, 'agent')
  assert.equal(result.contract.kind, 'business-action')
  assert.equal(result.contract.expectedPageId, 'customer.info')
  assert.deepEqual(result.contract.expectedActionIds, ['customer.search'])
})

test('routes a supported sales-order query to its read action', () => {
  const result = resolveDeterministicTaskIntent('查询销售订单')
  assert.equal(result.kind, 'agent')
  assert.equal(result.contract.kind, 'business-action')
  assert.deepEqual(result.contract.expectedActionIds, ['sales-order.search'])
})
