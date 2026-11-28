import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
function script(file) { return parse(readFileSync(new URL(file, import.meta.url), 'utf8')).descriptor.scriptSetup.content }
function getFunction(file, name, imports) {
  const ast = ts.createSourceFile('component.ts', script(file), ts.ScriptTarget.Latest, true)
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  const code = ts.transpileModule(fn.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function(...Object.keys(imports), `${code};return ${name}`)(...Object.values(imports))
}
test('月结收款选单回填真实待收金额，不回退订单全额、不伪造零值', () => {
  const items = { value: [] }
  const select = getFunction('../views/finance/MonthlyReceiptOrderAdd.vue', 'onSalesOrdersConfirmed', { items })
  select([{ sales_order_id: 's1', sales_order_no: 'SO1', receivable_amount: '400.00', pending_receivable_amount: '370.00' }, { sales_order_id: 's2', receivable_amount: '20', pending_receivable_amount: '0.00' }])
  assert.equal(items.value[0].order_amount, '400.00')
  assert.equal(items.value[0].pending_receivable_amount, '370.00')
  assert.equal(items.value[1].pending_receivable_amount, '0.00')
})
test('月结收款新增明细采用剩余应收额，保存后重新获取详情', async () => {
  const calls = []; let refreshed = 0
  const select = getFunction('../views/finance/MonthlyReceiptItemDialog.vue', 'onSalesOrderConfirmed', { submitting: { value: false }, props: { order: { monthly_receipt_id: 'mr1' } }, addMonthlyReceiptItems: async (...args) => calls.push(args), ElMessage: { success() {} }, loadDetail: async () => refreshed++, emit() {} })
  await select({ sales_order_id: 'so1', receivable_amount: '400.00', pending_receivable_amount: '370.00' })
  assert.deepEqual(calls[0], ['mr1', [{ sales_order_id: 'so1', receipt_amount: '370.00' }]])
  assert.equal(refreshed, 1)
})
test('月结付款缺少待付金额时不自动用订单全额付款，零值不被覆盖', async () => {
  const calls = []
  const select = getFunction('../views/finance/MonthlyPaymentItemDialog.vue', 'onPurchaseOrderConfirmed', { submitting: { value: false }, props: { order: { monthly_payment_id: 'mp1' } }, addMonthlyPaymentItems: async (...args) => calls.push(args), ElMessage: { success() {} }, loadDetail: async () => {}, emit() {} })
  await select([{ purchase_order_id: 'po1', payable_amount: '400.00', pending_payable_amount: '370.00' }, { purchase_order_id: 'po2', payable_amount: '400.00', pending_payable_amount: 0 }])
  assert.equal(calls[0][1][0].payment_amount, '370.00')
  assert.equal(calls[0][1][1].payment_amount, 0)
})
test('月结付款选单列表和搜索均锁定MONTHLY，重置不会切回OTHER', async () => {
  const calls = [], filter = { order_no: '', settlement_type: 'OTHER' }, props = { monthlyOnly: true, supplierId: 's1' }
  const imports = { props, filter, clearPaginationTotal() {}, list: { value: [] }, pagination: { page: 1, pageSize: 20, total: 0 }, withMinLoading: fn => fn(), buildSearchParams: () => filter.order_no ? { search_field: 'order_no', search_value: 'PO1' } : {}, getUnpaidOrdersForSupplier: async args => { calls.push(args); return { data: { list: [] } } }, searchUnpaidOrdersForSupplier: async args => { calls.push(args); return { data: { list: [] } } } }
  const load = getFunction('../views/finance/UnpaidOrderSelectDialog.vue', 'loadData', imports)
  await load(); filter.order_no = 'PO1'; await load()
  assert.ok(calls.every(call => call.settlement_type === 'MONTHLY'))
  getFunction('../views/finance/UnpaidOrderSelectDialog.vue', 'handleReset', { props, filter, handleSearch() {} })()
  assert.equal(filter.settlement_type, 'MONTHLY')
})
test('月结付款首条明细只在新增时填写；编辑主单不再要求空首条明细', () => {
  const source = readFileSync(new URL('./formConfigs.ts', import.meta.url), 'utf8'), ast = ts.createSourceFile('formConfigs.ts', source, ts.ScriptTarget.Latest, true)
  let scene
  const walk = n => { if (ts.isPropertyAssignment(n) && n.name.getText(ast) === 'monthlyPaymentOrder') scene = n.initializer; ts.forEachChild(n, walk) }; walk(ast)
  const tabs = scene.properties.find(n => n.name?.getText(ast) === 'tabs').initializer.getText(ast)
  const fields = new Function(ts.transpileModule(`return (${tabs})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)()[0].fields
  for (const key of ['purchase_order_id', 'initial_payment_amount']) assert.equal(fields.find(f => f.key === key).hiddenInEdit, true)
})
