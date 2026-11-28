import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { fetchAllPages } from '../api/utils/fetchAllPages.ts'

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const script = file => parse(read(file)).descriptor.scriptSetup.content
function evaluate(code, dependencies, names) {
  const ast = ts.createSourceFile('component.ts', code, ts.ScriptTarget.Latest, true)
  const body = ast.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(ast)).join('\n')
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  return new Function(...Object.keys(dependencies), `${js}\nreturn { ${names.join(', ')} }`)(...Object.values(dependencies))
}
function functions(file, names, dependencies) {
  const ast = ts.createSourceFile('component.ts', script(file), ts.ScriptTarget.Latest, true)
  const body = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name.text)).map(node => node.getText(ast)).join('\n')
  return evaluate(body, dependencies, names)
}
function storage() {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}
const computed = getter => ({ get value() { return getter() } })
const ref = value => ({ value })
const purchaseFile = '../views/purchase/CreatePaymentAction.vue'
const salesFile = '../views/sales/CreateReceiptAction.vue'
const purchase = { purchase_order_id: 'po1', supplier_id: 's1', supplier_name: '旧名称', order_no: 'PO1', is_audited: 1, payment_method_value: 'CASH', payable_amount: '1000.00', remark: '采购备注' }
const payable = { purchase_order_id: 'po1', supplier_id: 's1', supplier_name: '供应商甲', order_no: 'PO1', payment_method: 'CASH', payment_method_display: '现金', pending_payable_amount: '120.25', payable_amount: '1000.00' }
function paymentHarness({ form = {}, rows = [payable], search, permitted = true, disabled = false, tianxin = false } = {}) {
  const sessionStorage = storage(), routes = [], warnings = [], errors = [], queries = [], deactivate = []
  const props = { formData: { ...purchase, ...form }, editId: 'po1', disabled }
  const state = evaluate(script(purchaseFile), {
    defineProps: () => props, ref, computed,
    useRouter: () => ({ push: async route => { routes.push(route) } }),
    usePermissionStore: () => ({ hasUrlPerm: () => permitted }),
    useTradeModeStore: () => ({ isTianxin: tianxin }),
    ElMessage: { warning: text => warnings.push(text) }, showErrorDialog: text => errors.push(text),
    onDeactivated: fn => deactivate.push(fn), onUnmounted: () => {}, sessionStorage, fetchAllPages,
    buildSearchParams: values => ({ search_field: JSON.stringify(Object.keys(values)), search_value: JSON.stringify(values) }),
    searchUnpaidOrdersForSupplier: async query => {
      queries.push(query)
      return search ? search(query) : { data: { list: rows, total: rows.length, page_size: 100 } }
    },
  }, ['handleCreatePayment', 'creating'])
  return { ...state, sessionStorage, routes, warnings, errors, queries, deactivate, props }
}

test('采购创建普通付款单继承供应商、业务ID、最新待付金额和备注，不使用应付总额', async () => {
  const h = paymentHarness({ rows: [{ ...payable, purchase_order_id: 'po-other' }, payable] })
  await h.handleCreatePayment()
  const preset = JSON.parse(h.sessionStorage.getItem('presetData:paymentOrder'))
  assert.deepEqual(h.routes, [{ path: '/common/add', query: { type: 'paymentOrder' } }])
  assert.equal(preset.supplier_id_label, '供应商甲')
  assert.equal(preset.supplier_name, '供应商甲')
  assert.equal(preset.remark, '采购备注')
  assert.deepEqual(preset.items, [{ purchase_order_id: 'po1', order_no: 'PO1', payment_method_display: '现金', pending_payable_amount: '120.25', payment_amount: '120.25', remark: '' }])
  assert.equal(preset.payment_method, undefined)
  assert.deepEqual(JSON.parse(h.queries[0].search_value), { order_no: 'PO1' })
})

test('月结采购分流并继承月结付款页面实际需要的首条明细字段和显示标签', async () => {
  const h = paymentHarness({ form: { payment_method_value: '', payment_method: '月结' } })
  await h.handleCreatePayment()
  const preset = JSON.parse(h.sessionStorage.getItem('presetData:monthlyPaymentOrder'))
  assert.equal(h.queries[0].settlement_type, 'MONTHLY')
  assert.equal(h.routes[0].query.type, 'monthlyPaymentOrder')
  assert.equal(preset.purchase_order_id, 'po1')
  assert.equal(preset.purchase_order_id_label, 'PO1')
  assert.equal(preset.order_no, 'PO1')
  assert.equal(preset.initial_payment_amount, '120.25')
  assert.equal(preset.supplier_id, 's1')
})

test('挂账和预付款采购沿用普通付款单，允许后端判定未采购的预付款单可支付', async () => {
  for (const method of ['CREDIT', 'PREPAYMENT']) {
    const h = paymentHarness({ form: { payment_method_value: method, purchase_status: 0 } })
    await h.handleCreatePayment()
    assert.equal(h.routes[0].query.type, 'paymentOrder')
    assert.equal(h.queries[0].settlement_type, 'OTHER')
  }
})

test('模糊搜索被限制分页时仍精确定位当前采购订单', async () => {
  const h = paymentHarness({ search: async ({ page }) => ({ data: { page_size: 1, total: 2, list: [page === 1 ? { ...payable, purchase_order_id: 'other' } : payable] } }) })
  await h.handleCreatePayment()
  assert.equal(h.queries.length, 2)
  assert.equal(JSON.parse(h.sessionStorage.getItem('presetData:paymentOrder')).items[0].purchase_order_id, 'po1')
})

test('未审核、缺字段、禁用、无权限和天心模式不能发起创建', async () => {
  for (const options of [{ form: { is_audited: 0 } }, { form: { supplier_id: '' } }, { form: { payment_method_value: 'UNKNOWN' } }, { disabled: true }, { permitted: false }, { tianxin: true }]) {
    const h = paymentHarness(options)
    await h.handleCreatePayment()
    assert.equal(h.queries.length, 0)
    assert.equal(h.routes.length, 0)
  }
})

test('查不到、已付清、无效余额、串供应商和接口失败时不写入预填或跳转', async () => {
  for (const options of [{ rows: [] }, { rows: [{ ...payable, pending_payable_amount: '0' }] }, { rows: [{ ...payable, pending_payable_amount: 'bad' }] }, { rows: [{ ...payable, supplier_id: 'other' }] }, { search: async () => { throw new Error('请求失败') } }]) {
    const h = paymentHarness(options)
    await h.handleCreatePayment()
    assert.equal(h.routes.length, 0)
    assert.equal(h.sessionStorage.getItem('presetData:paymentOrder'), null)
    assert.equal(h.creating.value, false)
    assert.equal(h.warnings.length + h.errors.length, 1)
  }
})

test('重复点击只查询一次，离开源页面后迟到的响应不会跳转', async () => {
  let resolve
  const h = paymentHarness({ search: () => new Promise(done => { resolve = done }) })
  const pending = h.handleCreatePayment()
  await h.handleCreatePayment()
  assert.equal(h.queries.length, 1)
  h.deactivate[0]()
  resolve({ data: { list: [payable], total: 1 } })
  await pending
  assert.equal(h.routes.length, 0)
})

function salesHarness(readonly = false, method = 'CASH') {
  const sessionStorage = storage(), routes = []
  const props = { formData: { sales_order_id: 'so1', sales_order_no: 'SO1', customer_id: 'c1', customer_name: '客户甲', customer_remark: '主单备注', settlement_method_value: method, receivable_amount: '200.00', settlement_bank_id: 'bank1', audit_status: 1 }, dynamicTableData: { items: [{ product_id: 'p1', product_code: 'P1', product_name: '产品', specification: '规格', color: '红', unit_id: 'u1', unit_name: '件', qty: '2.5', line_remark: '明细备注' }] }, isReadonly: readonly, editId: 'so1' }
  const actions = evaluate(script(salesFile), {
    defineProps: () => props, useRouter: () => ({ push: route => routes.push(route) }),
    computed, usePermissionStore: () => ({ hasUrlPerm: () => true }),
    ElMessage: { warning: () => {} }, showErrorDialog: () => {}, confirmAction: async () => {},
    ensureSalesOrderAudited: fd => fd.audit_status === 1, sessionStorage,
  }, ['handleCommand', 'handleCreateOrder'])
  return { ...actions, sessionStorage, routes, props }
}

test('销售查看和编辑创建订货单均继承客户、规格颜色、单位、数量、主单及明细备注', async () => {
  for (const readonly of [true, false]) {
    const h = salesHarness(readonly)
    await h.handleCreateOrder()
    const data = JSON.parse(h.sessionStorage.getItem('customerOrderPrefillFromSales'))
    const editor = {}
    functions('../views/sales/CustomerOrderCreate.vue', ['loadPrefill'], { prefill: true, sessionStorage: h.sessionStorage, editor }).loadPrefill()
    assert.equal(editor.customerId, 'c1')
    assert.equal(editor.customerName, '客户甲')
    assert.equal(editor.remark, '主单备注')
    assert.equal(editor.items[0].qty, 2.5)
    for (const field of ['specification', 'color', 'unit_id', 'unit_name', 'line_remark']) assert.equal(editor.items[0][field], h.props.dynamicTableData.items[0][field])
    assert.equal(h.routes[0].query.soReadonly, readonly ? '1' : undefined)
    assert.equal(!!h.sessionStorage.getItem('salesOrderEditRestore:salesOrder:so1'), !readonly)
    assert.equal(data.customer_id, 'c1')
  }
})

test('销售创建收款单按四种结算方式继承字段，月结和预收在缓存页也能再次消费预填', () => {
  for (const [method, type] of [['CASH', 'collectionReceipt'], ['MONTHLY', 'monthlyReceiptOrder'], ['CREDIT', 'otherReceipt'], ['PREPAYMENT', 'precollectionOrder']]) {
    const h = salesHarness(true, method)
    h.handleCommand('receipt')
    const preset = JSON.parse(h.sessionStorage.getItem(`presetData:${type}`))
    assert.equal(preset.bank_account_id, 'bank1')
    assert.equal(preset.remark, '主单备注')
    if (type !== 'precollectionOrder') assert.equal(preset.customer_id, 'c1')
    if (type === 'collectionReceipt') {
      assert.equal(preset.items[0].sales_order_id, 'so1')
      assert.equal(preset.items[0].collection_amount, '200.00')
    }
    if (['monthlyReceiptOrder', 'precollectionOrder'].includes(type)) {
      const form = {}, items = ref([])
      const file = type === 'monthlyReceiptOrder' ? 'MonthlyReceiptOrderAdd' : 'PrecollectionOrderAdd'
      const consumer = functions(`../views/finance/${file}.vue`, ['applySalesPreset'], { form, items, sessionStorage: h.sessionStorage })
      consumer.applySalesPreset()
      assert.equal(form.bank_account_id, 'bank1')
      assert.equal(items.value.length, 1)
      h.props.formData.customer_id = 'c2'
      h.props.formData.settlement_bank_id = ''
      h.props.formData.customer_remark = ''
      h.handleCommand('receipt')
      consumer.applySalesPreset()
      assert.equal(form.bank_account_id, '')
      assert.equal(form.remark, '')
      assert.equal(type === 'monthlyReceiptOrder' ? form.customer_id : items.value[0].customer_id, 'c2')
    }
  }
})

test('从销售查看创建订货单后返回仍为只读详情', () => {
  const routes = []
  const actions = functions('../views/sales/CustomerOrderCreate.vue', ['returnToSalesOrder'], { sourceQuery: { soId: 'so1', soReadonly: '1' }, router: { push: route => routes.push(route) } })
  actions.returnToSalesOrder()
  assert.deepEqual(routes, [{ path: '/common/add', query: { type: 'salesOrder', id: 'so1', mode: 'edit', readonly: '1' } }])
})

test('销售和采购只读详情显式开放下游操作，保存重置仍留在只读门禁内', () => {
  const source = read('./formConfigs.ts')
  const ast = ts.createSourceFile('formConfigs.ts', source, ts.ScriptTarget.Latest, true)
  const actions = []
  function visit(node) {
    if (ts.isPropertyAssignment(node) && ['salesOrder', 'purchaseOrder'].includes(node.name.getText(ast))) {
      const extra = node.initializer.properties.find(item => item.name?.getText(ast) === 'extraActions')
      actions.push(...new Function(ts.transpileModule(`return (${extra.initializer.getText(ast)})`, {}).outputText)())
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.deepEqual(actions.map(action => action.key), ['createReceipt', 'createPayment'])
  for (const action of actions) {
    assert.equal(action.showInReadonly, true)
    assert.equal(action.show({ isEdit: true, isReadonly: true }), true)
    assert.equal(action.show({ isEdit: false, isReadonly: false }), false)
  }
  const template = parse(read('../views/common/AddTemplate.vue')).descriptor.template.ast
  let found = false
  function walk(node, ancestors = []) {
    const directives = node.props?.filter(prop => prop.type === 7) || []
    if (directives.some(prop => prop.name === 'for' && prop.exp?.content.includes('visibleHeaderExtraActions'))) {
      found = true
      assert.equal(ancestors.some(parent => parent.props?.some(prop => prop.name === 'if' && prop.exp?.content === '!isReadonly')), false)
    }
    if (node.tag === 'el-button' && node.props?.some(prop => prop.name === 'on' && ['handleReset', 'handleSubmit'].includes(prop.exp?.content))) {
      assert.equal(ancestors.some(parent => parent.props?.some(prop => prop.name === 'if' && prop.exp?.content === '!isReadonly')), true)
    }
    for (const child of node.children || []) walk(child, [...ancestors, node])
  }
  walk(template)
  assert.equal(found, true)
})

test('销售创建入口保留审核门禁并在详情加载期间禁用', () => {
  for (const change of [{ audit_status: 0 }, { audit_status: 2 }]) {
    const h = salesHarness(true)
    Object.assign(h.props.formData, change)
    h.handleCommand('receipt')
    assert.equal(h.routes.length, 0)
  }
  const h = salesHarness(true)
  h.props.disabled = true
  h.handleCommand('receipt')
  assert.equal(h.routes.length, 0)
})
