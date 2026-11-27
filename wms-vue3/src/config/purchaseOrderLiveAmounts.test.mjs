/**
 * 端到端复现 AddTemplate 的实时计算链路（不依赖浏览器）。
 *
 * 复刻 AddTemplate.vue 的三段关键逻辑：
 *   1. initFormDefaults：formData[items] 与 dynamicTableData[items] 是**同一数组引用**
 *   2. recalcComputedFields：遍历 tabs → fields，对 type='computed' 且有 compute 的字段重算回写
 *   3. watch(formData, recalcComputedFields, { deep: true })
 * 然后按用户操作顺序（选产品加行 → 填单价 → 填数量 → 改数量 → 删行 → 改预付款）断言金额变化。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reactive, watch, nextTick } from 'vue'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { computePurchaseOrderAmounts, lineDiscountText, lineGrossText, linePayableText } from '../utils/purchaseOrderAmounts.ts'

// ── 从真实配置中取出 purchaseOrder 的「订单信息」页字段（避免与 formConfigs 产生 import 副作用）──
const source = readFileSync(new URL('../config/formConfigs.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('formConfigs.ts', source, ts.ScriptTarget.Latest, true)
let purchaseOrder
function walk(node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'purchaseOrder') purchaseOrder = node.initializer
  ts.forEachChild(node, walk)
}
walk(ast)
assert.ok(purchaseOrder, '未找到 purchaseOrder 配置')

const tabsSource = purchaseOrder.properties.find(n => n.name?.getText(ast) === 'tabs').initializer.getText(ast)
// compute 内引用了模块级函数，注入同名参数（与 formConfigs.ts 顶部的 import 一一对应）
const tabs = new Function(
  'sumLineGiftAmount', 'computePurchaseOrderAmounts', 'lineGrossText', 'linePayableText', 'lineDiscountText',
  ts.transpileModule(`return (${tabsSource})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
)(
  (items) => {
    if (!Array.isArray(items)) return '0.00'
    const total = items.reduce((s, r) => s + (Number(r?.line_use_gift_amount) || 0), 0)
    return total.toFixed(2)
  },
  computePurchaseOrderAmounts,
  lineGrossText,
  linePayableText,
  lineDiscountText,
)
const fields = tabs[0].fields
const field = key => fields.find(f => f.key === key)

/** 复刻 AddTemplate 的 computed 重算 + 深度监听 */
function mountForm(initial = {}) {
  const dynamicTableData = reactive({})
  const formData = reactive({})
  // initFormDefaults：明细数组与 formData 共享同一引用
  fields.forEach(f => {
    if (f.type === 'dynamic-table') {
      dynamicTableData[f.key] = []
      formData[f.key] = dynamicTableData[f.key]
    } else if (f.defaultValue !== undefined) {
      formData[f.key] = f.defaultValue
    } else if (!['section'].includes(f.type)) {
      formData[f.key] = ''
    }
  })
  Object.assign(formData, initial)
  if (initial.items) {
    dynamicTableData.items = initial.items
    formData.items = dynamicTableData.items
  }

  let recalcCount = 0
  function recalcComputedFields() {
    recalcCount++
    tabs.forEach(tab => tab.fields.forEach(f => {
      if (f.type === 'computed' && typeof f.compute === 'function') {
        try { formData[f.key] = f.compute(formData) } catch { /* 与组件同口径 */ }
      }
    }))
  }
  watch(formData, recalcComputedFields, { deep: true })
  recalcComputedFields()
  return { formData, dynamicTableData, recalc: () => recalcCount }
}

const money = async (ctx) => {
  await nextTick()
  await nextTick()
  return { order: ctx.formData.order_amount, payable: ctx.formData.payable_amount }
}

test('必填的两个金额字段确实是 computed 且各自带 compute', () => {
  for (const key of ['order_amount', 'payable_amount']) {
    assert.equal(field(key).type, 'computed', key)
    assert.equal(typeof field(key).compute, 'function', `${key} 必须带 compute，否则永远是默认值 0.00`)
  }
})

test('填完采购单价和采购数量后，订单金额/应付金额立即更新（新增态主流程）', async () => {
  const ctx = mountForm()
  assert.deepEqual(await money(ctx), { order: '0.00', payable: '0.00' })

  // 产品弹窗选中产品 → push 一行（qty 默认 1）
  ctx.dynamicTableData.items.push({ product_id: 'prd_1', product_name: 'A', qty: '1', purchase_price: '' })
  await nextTick()
  assert.deepEqual(await money(ctx), { order: '0.00', payable: '0.00' })

  // 用户填写采购单价
  ctx.dynamicTableData.items[0].purchase_price = '12.5'
  assert.deepEqual(await money(ctx), { order: '12.50', payable: '12.50' })

  // 用户填写采购数量
  ctx.dynamicTableData.items[0].qty = '4'
  assert.deepEqual(await money(ctx), { order: '50.00', payable: '50.00' })
})

test('多行明细逐行舍入后汇总，改任意一行立即联动', async () => {
  const ctx = mountForm()
  ctx.dynamicTableData.items.push(
    { product_id: 'p1', qty: '3', purchase_price: '1.005' },
    { product_id: 'p2', qty: '2', purchase_price: '10.5' },
  )
  // 逐行：1.005×3=3.015→3.02；10.5×2=21.00 → 24.02（若先求和会是 24.01）
  assert.deepEqual(await money(ctx), { order: '24.02', payable: '24.02' })

  // 改第 2 行的数量：10.5 × 4 = 42.00 → 45.02
  ctx.dynamicTableData.items[1].qty = '4'
  assert.deepEqual(await money(ctx), { order: '45.02', payable: '45.02' })

  // 改第 1 行的单价：2.005×3=6.015→6.02 → 48.02
  ctx.dynamicTableData.items[0].purchase_price = '2.005'
  assert.deepEqual(await money(ctx), { order: '48.02', payable: '48.02' })
})

test('删行后金额回退；清空数量按 0 计', async () => {
  const ctx = mountForm()
  ctx.dynamicTableData.items.push(
    { product_id: 'p1', qty: '2', purchase_price: '10' },
    { product_id: 'p2', qty: '5', purchase_price: '4' },
  )
  assert.deepEqual(await money(ctx), { order: '40.00', payable: '40.00' })

  ctx.dynamicTableData.items.splice(1, 1)
  assert.deepEqual(await money(ctx), { order: '20.00', payable: '20.00' })

  ctx.dynamicTableData.items[0].qty = ''
  assert.deepEqual(await money(ctx), { order: '0.00', payable: '0.00' })
})

test('行赠送与使用预付款实时扣减应付金额；超额时应付 0.00 并触发提示', async () => {
  const ctx = mountForm()
  ctx.dynamicTableData.items.push(
    { product_id: 'p1', qty: '1', purchase_price: '100', line_use_gift_amount: '5' },
  )
  assert.deepEqual(await money(ctx), { order: '100.00', payable: '95.00' })

  // 使用预付款：el-input-number 写入 number
  ctx.formData.use_prepayment_amount = 30
  assert.deepEqual(await money(ctx), { order: '100.00', payable: '65.00' })

  // 行赠送改成 80 → 100 − 80 − 30 = −10 → 展示 0.00，且主单赠送合计同步为 80.00
  ctx.dynamicTableData.items[0].line_use_gift_amount = '80'
  assert.deepEqual(await money(ctx), { order: '100.00', payable: '0.00' })
  assert.equal(ctx.formData.use_gift_amount, '80.00')
  // 提示文案生效（hint 为函数，接收当前 formData）
  const hint = field('payable_amount').hint(ctx.formData)
  assert.match(hint, /已超过订单金额/)
  assert.match(hint, /80\.00/)
})

test('编辑态回显后端金额；未改明细时不被前端改写', async () => {
  const ctx = mountForm({
    items: [
      { purchase_order_item_id: 'poi_1', qty: '5', purchase_price: '21.23', amount: '106.15', payable_amount: '106.15', line_use_gift_amount: '0' },
      { purchase_order_item_id: 'poi_2', qty: '2', purchase_price: '10.5', amount: '21.00', payable_amount: '21.00', line_use_gift_amount: '0' },
    ],
    use_prepayment_amount: 20,
  })
  assert.deepEqual(await money(ctx), { order: '127.15', payable: '107.15' })

  // 用户改第 1 行数量 5 → 6：106.15→127.38，订单金额 148.38
  ctx.dynamicTableData.items[0].qty = '6'
  assert.deepEqual(await money(ctx), { order: '148.38', payable: '128.38' })
})

test('明细行缺少采购单价（敏感权限裁剪）时保留后端金额，不清成 0.00', async () => {
  const ctx = mountForm({
    items: [{ purchase_order_item_id: 'poi_1', qty: '5', amount: '106.15', payable_amount: '106.15' }],
    order_amount: '106.15',
    payable_amount: '106.15',
  })
  assert.deepEqual(await money(ctx), { order: '106.15', payable: '106.15' })
})

test('明细行金额三列随单价/数量实时变化', async () => {
  const col = (key) => field('items').columns.find(c => c.key === key)
  // 编辑态快照：amount 100.00 是用户改动前的值
  const row = reactive({ purchase_price: '10', qty: '10', amount: '100.00', payable_amount: '99.50' })
  assert.equal(col('line_total_amount').compute(row), '100.00')
  assert.equal(col('line_payable_total').compute(row), '99.50')
  assert.equal(col('line_gift_total').compute(row), '0.50')

  // 用户把数量改成 20
  row.qty = '20'
  assert.equal(col('line_total_amount').compute(row), '200.00')
  assert.equal(col('line_payable_total').compute(row), '200.00')
  assert.equal(col('line_gift_total').compute(row), '0.00')
  // 主单订单金额与该行总原价保持一致口径
  const amounts = computePurchaseOrderAmounts([row], 0)
  assert.equal(amounts.orderAmountText, '200.00')
})

test('提交时 computed 字段会被过滤，不会回传后端（订单金额/应付金额/赠送合计）', async () => {
  // 复刻 handleSubmit 的过滤逻辑
  const ctx = mountForm()
  ctx.dynamicTableData.items.push({ product_id: 'p1', qty: '2', purchase_price: '10' })
  await nextTick()
  const computedKeys = new Set()
  tabs.forEach(tab => tab.fields.forEach(f => { if (f.type === 'computed') computedKeys.add(f.key) }))
  const submitData = {}
  Object.entries(ctx.formData).forEach(([k, v]) => {
    if (!k.endsWith('_label') && !computedKeys.has(k)) submitData[k] = v
  })
  for (const key of ['order_amount', 'payable_amount', 'use_gift_amount', 'supplier_prepayment_balance', 'supplier_gift_balance']) {
    assert.equal(computedKeys.has(key), true, `${key} 应被识别为 computed`)
    assert.equal(Object.hasOwn(submitData, key), false, `${key} 不应进入提交数据`)
  }
})
