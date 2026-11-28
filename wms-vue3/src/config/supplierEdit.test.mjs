import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { sensitiveFormBindings } from './sensitivePageBindings.ts'
import { createSensitiveFormPolicy, missingFormFields } from '../utils/sensitiveForm.ts'
import { responseSensitiveRestrictions } from '../utils/sensitiveFields.ts'

const source = readFileSync(new URL('./formConfigs.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('formConfigs.ts', source, ts.ScriptTarget.Latest, true)
let config
function walk(node) { if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'purchaseSupplier') config = node.initializer; ts.forEachChild(node, walk) }
walk(ast)
const tabsSource = config.properties.find(node => node.name?.getText(ast) === 'tabs').initializer.getText(ast)
const fields = new Function(ts.transpileModule(`return (${tabsSource})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)()[0].fields
const field = key => fields.find(item => item.key === key)

test('supplier required fields and monthly positive integer validation', async () => {
  const { default: imported } = await import('async-validator')
  const Schema = imported.default || imported
  for (const key of ['supplier_name', 'external_code', 'short_name', 'supplier_type_id', 'area_id', 'detail_address', 'phone1', 'email', 'principal_phone', 'business_contact', 'contact_phone', 'bank_account', 'purchaser_user_id', 'is_monthly_settlement', 'credit_amount', 'gift_amount']) assert.equal(field(key).required, true, key)
  for (const key of ['monthly_days', 'settlement_day']) {
    assert.equal(field(key).visible({ is_monthly_settlement: 0 }), false)
    assert.equal(field(key).visible({ is_monthly_settlement: '1' }), true)
    const validator = new Schema({ [key]: [{ required: true }, ...field(key).rules] })
    for (const value of [null, undefined, '', 0, -1, 1.5]) await assert.rejects(validator.validate({ [key]: value }))
    for (const value of [1, 30, '15']) await validator.validate({ [key]: value })
  }
  for (const key of ['supplier_name', 'short_name', 'bank_account']) {
    const validator = new Schema({ [key]: [{ required: true }, ...field(key).rules] })
    await assert.rejects(validator.validate({ [key]: '   ' }))
  }
  for (const key of ['credit_amount', 'gift_amount']) {
    assert.equal(field(key).defaultValue, 0)
    const validator = new Schema({ [key]: [{ required: true }, ...field(key).rules] })
    await validator.validate({ [key]: '0.00' })
    await validator.validate({ [key]: 0 })
    await assert.rejects(validator.validate({ [key]: -1 }))
  }
})

test('create and update send monthly values and clear them for non-monthly settlement', async () => {
  for (const method of ['submitCreate', 'submitUpdate']) {
    let payload
    const submit = callback(method, [method === 'submitCreate' ? 'createSupplier' : 'updateSupplier'], [async data => { payload = data }])
    const run = data => method === 'submitCreate' ? submit(data) : submit('s1', data)
    await run({ is_monthly_settlement: 1, monthly_days: 30, settlement_day: 15 })
    assert.equal(payload.monthly_days, 30); assert.equal(payload.settlement_day, 15)
    await run({ is_monthly_settlement: 0, monthly_days: 30, settlement_day: 15 })
    assert.equal(payload.monthly_days, 0); assert.equal(payload.settlement_day, 0)
    if (method === 'submitUpdate') {
      await run({ phone1: '123' })
      assert.equal(payload.monthly_days, undefined); assert.equal(payload.settlement_day, undefined)
    }
  }
})
function callback(key, names, values) {
  const declaration = config.properties.find(node => node.name?.getText(ast) === key).initializer.getText(ast)
  const code = ts.transpileModule(`const fn = ${declaration}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function(...names, `${code}; return fn`)(...values)
}
test('供应商数组详情展平时保留原始路径提示，隐藏金额不恢复默认值且允许修改联系方式', async () => {
  const metadata = [{ field_id: 'credit', param_names: ['supplier[].credit_amount', 'supplier[].gift_amount'] }]
  const load = callback('loadDetail', ['getSupplierDetail', 'normalizeUploadDetailFiles'], [async () => ({ data: { supplier: [{ supplier_id: 's1', supplier_name: '供应商', phone1: '123' }], restricted_sensitive_fields: metadata } }), () => ({})])
  const data = await load('s1'), binding = sensitiveFormBindings.purchaseSupplier
  assert.deepEqual(data.restricted_sensitive_fields, metadata)
  const p = createSensitiveFormPolicy(binding, new Map([[binding.detail, { status: 'ready', fields: [] }]]), responseSensitiveRestrictions(data).flatMap(item => item.param_names), missingFormFields(data, binding))
  assert.equal(p.visible('credit_amount'), false); assert.equal(p.visible('gift_amount'), false); assert.equal(p.editable('phone1'), true)
  assert.deepEqual(p.sanitizeDraft({ ...data, phone1: '456', credit_amount: 0, gift_amount: 0 }).phone1, '456')
  assert.equal(Object.hasOwn(p.sanitizeDraft({ ...data, gift_amount: 0 }), 'gift_amount'), false)
})
test('供应商资料更新仅传联系方式等资料，不回传余额，不将缺少状态转换为NaN或0', async () => {
  let payload
  const update = callback('submitUpdate', ['updateSupplier'], [async data => { payload = data }])
  await update('s1', { supplier_name: '供应商', external_code: 'EXT1', phone1: '456', credit_amount: '999', gift_amount: '999' })
  assert.equal(payload.phone1, '456'); assert.equal(payload.is_monthly_settlement, undefined); assert.equal(payload.status, undefined)
  assert.equal(Object.hasOwn(payload, 'credit_amount'), false); assert.equal(Object.hasOwn(payload, 'gift_amount'), false)
})
test('空供应商详情或其他记录不得作为当前编辑快照', async () => {
  for (const supplier of [[], [{ supplier_id: 'other' }]]) {
    const load = callback('loadDetail', ['getSupplierDetail', 'normalizeUploadDetailFiles'], [async () => ({ data: { supplier } }), () => ({})])
    await assert.rejects(load('s1'), /详情返回不完整/)
  }
})
