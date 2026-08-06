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
  assert.equal(result.kind, 'business-action')
  assert.equal(result.pageId, 'warehouse.stock')
  assert.equal(result.actionId, 'inventory.search')
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
      assert.equal(result.kind, expectedPageId === 'warehouse.stock' || expectedPageId === 'delivery.task' ? 'business-action' : 'navigate')
      assert.equal(result.pageId, expectedPageId)
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

test('routes shipping wording to delivery tasks and selling-item wording to sales order details', () => {
  const cases = [
    ['我先看一下昨天出了什么货', 'delivery.task'],
    ['我想看昨天的出货情况', 'delivery.task'],
    ['昨天卖了什么货', 'sales.report.order-detail'],
    ['今天卖了什么东西', 'sales.report.order-detail'],
    ['昨天销售了哪些商品', 'sales.report.order-detail'],
    ['我昨天有什么货出库了', 'sales.order'],
  ]

  for (const [task, expectedPageId] of cases) {
    const results = Array.from({ length: 20 }, () => resolveDeterministicTaskIntent(task))
    for (const result of results) {
      assert.equal(result.kind, ['delivery.task', 'sales.report.order-detail'].includes(expectedPageId) ? 'business-action' : 'navigate')
      assert.equal(result.pageId, expectedPageId)
    }
  }
})

test('keeps aggregate sales questions on the product sales summary page', () => {
  const cases = [
    '哪些商品卖得最好',
    '统计今天各产品卖了多少',
    '查看产品销量排行',
    '汇总一下商品销售额',
  ]

  for (const task of cases) {
    const result = resolveDeterministicTaskIntent(task)
    assert.equal(result.kind, task.includes('今天') ? 'navigate' : 'business-action', task)
    assert.equal(result.pageId, 'sales.report.product-summary', task)
  }
})

test('uses supplier wording to keep purchase returns out of sales outbound routing', () => {
  const result = resolveDeterministicTaskIntent('我想看昨天退给供应商的货')
  assert.equal(result.kind, 'business-action')
  assert.equal(result.pageId, 'purchase.return')
  assert.equal(result.actionId, 'purchase-return.search')
})

test('defaults an unqualified return question to the purchase-return action', () => {
  const result = resolveDeterministicTaskIntent('我想看看最近有没有什么退货的情况')
  assert.equal(result.kind, 'business-action')
  assert.equal(result.pageId, 'purchase.return')
  assert.equal(result.actionId, 'purchase-return.search')
  assert.equal(result.args.createdStart, '2026-07-31')
  assert.equal(result.args.createdEnd, '2026-08-06')
})

test('recognizes colloquial purchase inbound item queries', () => {
  const result = resolveDeterministicTaskIntent('昨天入了什么货')
  assert.equal(result.kind, 'business-action')
  assert.equal(result.pageId, 'purchase.report.inbound-detail')
  assert.equal(result.actionId, 'purchase-inbound-detail.search')
})

test('routes a colloquial outbound overview request to sales orders', () => {
  const result = resolveDeterministicTaskIntent('我想看昨天的出库情况')
  assert.equal(result.kind, 'navigate')
  assert.equal(result.pageId, 'sales.order')
})

test('recognizes colloquial delivery task queries without confusing them with outbound goods', () => {
  const result = resolveDeterministicTaskIntent('昨天发了哪些配送单')
  assert.equal(result.kind, 'business-action')
  assert.equal(result.pageId, 'delivery.task')
  assert.equal(result.actionId, 'delivery-task.search')
})

test('treats broad logistics wording as a delivery-task request', () => {
  const result = resolveDeterministicTaskIntent('看一下物流')
  assert.equal(result.kind, 'navigate')
  assert.equal(result.pageId, 'delivery.task')
  assert.equal(result.mode, 'list')
})

test('keeps qualified logistics wording on its specific delivery page', () => {
  const cases = [
    ['我想查一下物流单号', 'delivery.logistics'],
    ['我想看一下物流公司', 'delivery.company'],
  ]

  for (const [task, expectedPageId] of cases) {
    const result = resolveDeterministicTaskIntent(task)
    const expectedKind = expectedPageId === 'warehouse.stock' || expectedPageId === 'delivery.task'
      ? 'business-action'
      : 'navigate'
    assert.equal(result.kind, expectedKind, task)
    assert.equal(result.pageId, expectedPageId, task)
  }
})

test('compiles the registered deterministic queries into page actions', () => {
  const cases = [
    ['查一下旺仔牛奶的产品资料', 'product.search', 'product.info'],
    ['旺仔牛奶还有多少库存', 'inventory.search', 'warehouse.stock'],
    ['查看昨天的配送任务', 'delivery-task.search', 'delivery.task'],
    ['查一下沃尔玛的供应商资料', 'supplier.search', 'purchase.supplier'],
    ['查看今天的采购入库单', 'purchase-inbound.search', 'purchase.inbound'],
    ['查看昨天的采购退货单', 'purchase-return.search', 'purchase.return'],
    ['帮我查一下员工信息', 'employee.search', 'system.personnel'],
    ['查看昨天的销售退货单', 'sales-return.search', 'sales.return'],
    ['昨天入了什么货', 'purchase-inbound-detail.search', 'purchase.report.inbound-detail'],
    ['昨天卖了什么货', 'sales-order-detail.search', 'sales.report.order-detail'],
    ['哪些商品卖得最好', 'product-sales-summary.search', 'sales.report.product-summary'],
    ['我们还欠供应商多少钱', 'supplier-balance.search', 'purchase.report.supplier-balance'],
  ]

  for (const [task, actionId, pageId] of cases) {
    const result = resolveDeterministicTaskIntent(task)
    assert.equal(result.kind, 'business-action', task)
    assert.equal(result.actionId, actionId, task)
    assert.equal(result.pageId, pageId, task)
  }
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
    const expectedKind = ['warehouse.stock', 'delivery.task', 'purchase.supplier', 'system.personnel', 'sales.return', 'purchase.report.supplier-balance', 'sales.report.product-summary'].includes(expectedPageId)
      ? 'business-action'
      : 'navigate'
    assert.equal(result.kind, expectedKind, task)
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
  assert.equal(result.kind, 'business-action')
  assert.equal(result.actionId, 'customer.search')
  assert.deepEqual(result.args, { customerName: '广州', page: 1 })
  assert.equal(result.contract.kind, 'business-action')
  assert.equal(result.contract.expectedPageId, 'customer.info.list')
  assert.deepEqual(result.contract.expectedActionIds, ['customer.search'])
})

test('compiles a generic customer-info query into one deterministic action', () => {
  const result = resolveDeterministicTaskIntent('查一下客户信息')
  assert.equal(result.kind, 'business-action')
  assert.equal(result.pageId, 'customer.info')
  assert.equal(result.agentPageId, 'customer.info.list')
  assert.equal(result.actionId, 'customer.search')
  assert.deepEqual(result.args, { page: 1 })
})

test('routes a supported sales-order query to its read action', () => {
  const result = resolveDeterministicTaskIntent('查询销售订单')
  assert.equal(result.kind, 'agent')
  assert.equal(result.contract.kind, 'business-action')
  assert.deepEqual(result.contract.expectedActionIds, ['sales-order.search'])
})

test('compiles a colloquial purchase query into the registered purchase-order action', () => {
  const result = resolveDeterministicTaskIntent('今天采购了什么')
  assert.equal(result.kind, 'business-action')
  assert.equal(result.pageId, 'purchase.order')
  assert.equal(result.agentPageId, 'purchase.order.list')
  assert.equal(result.actionId, 'purchase-order.search')
  assert.match(result.args.createdStart, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(result.args.createdStart, result.args.createdEnd)
})

test('routes an employee-info query to personnel via synonym expansion', () => {
  const result = resolveDeterministicTaskIntent('帮我查一下员工信息')
  assert.equal(result.kind, 'business-action')
  assert.equal(result.pageId, 'system.personnel')
  assert.equal(result.actionId, 'employee.search')
})

test('falls through to the LLM agent instead of hard-blocking when nothing matches', () => {
  // 空候选不再硬拦成 clarify("没有找到唯一匹配的业务页面")，直接交 LLM 兜底。
  const result = resolveDeterministicTaskIntent('帮我查一下公司门口的快递')
  assert.equal(result.kind, 'agent')
  assert.equal(result.contract.kind, 'open')
})

test('routes visit-record wording to the visit task page instead of entity ambiguity', () => {
  // "拜访记录" 不是"拜访任务/客户拜访"的子串，靠 customer.task.visit 的
  // synonyms 中"拜访记录/拜访"命中，避免被 buildAmbiguityGuidance 误判成
  // "外部实体+模糊意图"而强制澄清。
  const result = resolveDeterministicTaskIntent('我想看看拜访记录')
  assert.equal(result.kind, 'navigate')
  assert.equal(result.pageId, 'customer.task.visit')
  assert.equal(result.mode, 'list')
})
