import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { productRelationChanges } from '../utils/productEdit.ts'
import { createSensitiveFormPolicy } from '../utils/sensitiveForm.ts'
import { sensitiveFormBindings } from './sensitivePageBindings.ts'

const source = readFileSync(new URL('./formConfigs.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('formConfigs.ts', source, ts.ScriptTarget.Latest, true)
let productConfig
function walk(node) { if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'productInfo') productConfig = node.initializer; ts.forEachChild(node, walk) }
walk(ast)
const update = productConfig.properties.find(node => node.name?.getText(ast) === 'submitUpdate').initializer.getText(ast)
const validator = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'validateProductFormTables').getText(ast)
const names = ['updateProduct', 'deleteProductSalePrice', 'bindProductSalePrices', 'updateProductSalePrices', 'deleteProductSupplier', 'addProductSupplier', 'updateSupplierPresetPrice']
function harness(fail) {
  const calls = []
  const functions = names.map(name => async (...args) => { calls.push({ name, args }); if (name === fail) throw Object.assign(new Error('接口失败'), { response: { status: 400 } }); return { success: true } })
  const output = ts.transpileModule(`${validator}\nconst save = ${update}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const save = new Function('productRelationChanges', ...names, `${output}; return save`)(productRelationChanges, ...functions)
  const originalData = { product_id: 'p1', factory_price: '0', min_sale_price: '10', sale_prices: [{ sale_price_id: 'sp', customer_type_id: 'ct', sale_price: '12', remark: '旧' }], product_suppliers: [{ supplier_id: 's', preset_purchase_price: '2.345' }] }
  return { save, calls, originalData, context: { originalData, canWrite: () => true, sanitizeFor: (_, value) => value } }
}
test('真实保存流程保留零价、零预警，未变关系不发更新请求', async () => {
  const h = harness(); await h.save('p1', { ...h.originalData, stock_warning_qty: 0, remark: '新' }, undefined, h.context)
  assert.deepEqual(h.calls.map(call => call.name), ['updateProduct'])
  assert.equal(h.calls[0].args[0].factory_price, '0'); assert.equal(h.calls[0].args[0].stock_warning_qty, '0')
})
test('真实受限编辑可以只改基本备注和客户备注，价格参数不出现 undefined 字符串', async () => {
  const h = harness(), binding = sensitiveFormBindings.productInfo
  const endpoints = [binding.detail, ...Object.values(binding.fields).flatMap(field => field.input ? [field.input.interfacePath] : [])]
  const states = new Map(endpoints.map(path => [path, { status: 'ready', fields: Object.values(binding.fields).filter(field => field.input?.interfacePath === path).map(field => ({ io_type: 'INPUT', restriction_type: 2, param_name: field.input.param })) }]))
  const p = createSensitiveFormPolicy(binding, states)
  const context = { ...h.context, canWrite: p.editable, sanitizeFor: p.sanitizeFor }
  await h.save('p1', p.sanitizeDraft({ ...h.originalData, remark: '新', sale_prices: [{ ...h.originalData.sale_prices[0], remark: '' }] }), undefined, context)
  assert.deepEqual(h.calls.map(call => call.name), ['updateProduct', 'updateProductSalePrices'])
  assert.equal(Object.hasOwn(h.calls[0].args[0], 'factory_price'), false)
  assert.deepEqual(h.calls[1].args[1], [{ sale_price_id: 'sp', remark: '' }])
})
test('关联删除失败明确标记部分保存，停止后续写入', async () => {
  const h = harness('deleteProductSalePrice')
  await assert.rejects(h.save('p1', { ...h.originalData, sale_prices: [] }, undefined, h.context), error => error.partialSave === true && /基本资料已保存/.test(error.message))
  assert.deepEqual(h.calls.map(call => call.name), ['updateProduct', 'deleteProductSalePrice'])
})
test('快照不匹配、受限关系重建及非法价格均在任何写入前拒绝', async () => {
  const h = harness()
  await assert.rejects(h.save('other', h.originalData, undefined, h.context), /不匹配/)
  await assert.rejects(h.save('p1', { ...h.originalData, sale_prices: [] }, undefined, { ...h.context, canWrite: () => false }), /不能新增、删除/)
  await assert.rejects(h.save('p1', { ...h.originalData, product_suppliers: [{ supplier_id: 's', preset_purchase_price: '2.3456' }] }, undefined, h.context), /最多保留2位/)
  assert.deepEqual(h.calls, [])
})

test('历史供应商尚未定价时可以修改备注，也允许明确补录新价格', async () => {
  const h = harness(); h.originalData.product_suppliers[0].preset_purchase_price = null
  await h.save('p1', { ...h.originalData, remark: '只改备注' }, undefined, h.context)
  assert.deepEqual(h.calls.map(call => call.name), ['updateProduct'])
  h.calls.length = 0
  await h.save('p1', { ...h.originalData, product_suppliers: [{ supplier_id: 's', preset_purchase_price: '5.00' }] }, undefined, h.context)
  assert.deepEqual(h.calls.map(call => call.name), ['updateProduct', 'updateSupplierPresetPrice'])
})

test('原本没有供应商关系的历史产品可以修改其他资料，不强迫新增关系', async () => {
  const h = harness(); h.originalData.product_suppliers = []
  await h.save('p1', { ...h.originalData, remark: '改备注' }, undefined, h.context)
  assert.deepEqual(h.calls.map(call => call.name), ['updateProduct'])
})

test('多接口保存中登录会话变化后停止后续写入，明确主资料已部分保存', async () => {
  const h = harness()
  await assert.rejects(h.save('p1', { ...h.originalData, sale_prices: [] }, undefined, { ...h.context, assertCurrent: () => { if (h.calls.length) throw new Error('会话变化') } }), error => error.partialSave === true)
  assert.deepEqual(h.calls.map(call => call.name), ['updateProduct'])
})
