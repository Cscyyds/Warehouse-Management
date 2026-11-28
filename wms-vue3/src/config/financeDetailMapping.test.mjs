import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('./formConfigs.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('formConfigs.ts', source, ts.ScriptTarget.Latest, true)
const scenes = {}
function visit(node) {
  if (ts.isPropertyAssignment(node) && ['paymentOrder', 'collectionReceipt'].includes(node.name.getText(ast))) scenes[node.name.getText(ast)] = node.initializer
  ts.forEachChild(node, visit)
}
visit(ast)
function evaluate(scene, name, dependencies = {}) {
  const node = scenes[scene].properties.find(p => p.name?.getText(ast) === name)
  const js = ts.transpileModule(`return (${node.initializer.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function(...Object.keys(dependencies), js)(...Object.values(dependencies))
}
const labels = method => ({ CASH: '现金', TRANSFER: '银行转账' })[method] || method
const dependencies = { normalizeUploadDetailFiles: () => ({}), paymentMethodLabel: labels }
test('付款编辑按采购订单快照映射结算方式和待付金额，保留本次付款额及明细ID', async () => {
  const data = { payment_method: 'TRANSFER', items: [{ payment_item_id: 'pyi1', purchase_order_id: 'po1', order_amount: '400.00', payment_amount: '30.00', po_payment_method: 'CASH' }] }
  const load = evaluate('paymentOrder', 'loadDetail', { ...dependencies, getPaymentOrderDetail: async () => ({ data }) })
  const detail = await load('py1')
  assert.equal(detail.payment_method, '银行转账')
  assert.equal(detail.items[0].payment_method_display, '现金')
  assert.equal(detail.items[0].pending_payable_amount, '400.00')
  assert.equal(detail.items[0].payment_amount, '30.00')
  assert.equal(detail.items[0].payment_item_id, 'pyi1')
  assert.equal(Object.hasOwn(data.items[0], 'pending_payable_amount'), false)
})
test('付款明细零金额正常保留，未知结算枚举原样显示，缺失金额不伪造零', async () => {
  for (const [method, amount, label] of [['MONTHLY', '0.00', '月结'], ['CREDIT', '12', '挂账'], ['PREPAYMENT', '20', '预存款'], ['NEW_MODE', undefined, 'NEW_MODE']]) {
    const load = evaluate('paymentOrder', 'loadDetail', { ...dependencies, getPaymentOrderDetail: async () => ({ data: { items: [{ po_payment_method: method, order_amount: amount }] } }) })
    const detail = await load('py1')
    assert.equal(detail.items[0].pending_payable_amount, amount)
    assert.equal(detail.items[0].payment_method_display, label)
  }
})
test('收款编辑直接使用后端应收金额，保留本次收款和已有明细ID', async () => {
  const load = evaluate('collectionReceipt', 'loadDetail', { ...dependencies, getCollectionReceiptDetail: async () => ({ data: { collection_method: 'CASH', items: [{ receipt_item_id: 'ri1', order_amount: '400.00', receivable_amount: '370.00', collection_amount: '30.00' }] } }) })
  const detail = await load('r1')
  assert.equal(detail.items[0].receivable_amount, '370.00')
  assert.equal(detail.items[0].collection_amount, '30.00')
  assert.equal(detail.items[0].receipt_item_id, 'ri1')
})
test('收付款参考字段只读，本次收付款金额仍可编辑且提交不带参考字段', async () => {
  for (const [scene, reference, amount, create] of [['paymentOrder', ['order_no', 'payment_method_display', 'pending_payable_amount'], 'payment_amount', 'createPaymentOrder'], ['collectionReceipt', ['order_no', 'receivable_amount'], 'collection_amount', 'createCollectionReceipt']]) {
    const columns = evaluate(scene, 'tabs')[0].fields.find(f => f.key === 'items').columns
    for (const key of reference) assert.equal(columns.find(c => c.key === key).type, 'display')
    assert.equal(columns.find(c => c.key === amount).type, 'input')
    let payload
    const submit = evaluate(scene, 'submitCreate', { formatDate: x => x, [create]: async p => { payload = p } })
    await submit({ items: [{ purchase_order_id: 'po1', sales_order_id: 'so1', [amount]: '30.00', pending_payable_amount: '400.00', payment_method_display: '现金', receivable_amount: '370.00' }] })
    const item = JSON.parse(payload.items)[0]
    assert.equal(item[amount], '30.00')
    for (const key of reference) assert.equal(Object.hasOwn(item, key), false)
  }
})
