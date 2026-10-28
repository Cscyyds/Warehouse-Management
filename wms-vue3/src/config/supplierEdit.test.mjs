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
