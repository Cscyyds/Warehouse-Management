import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSensitiveFormPolicy, missingFormFields } from './sensitiveForm.ts'
import { productRelationChanges } from './productEdit.ts'
import { sensitiveFormBindings } from '../config/sensitivePageBindings.ts'

const binding = sensitiveFormBindings.productInfo
function policy(fields = {}, hidden = [], missing = []) {
  const endpoints = [binding.detail, ...Object.values(binding.fields).flatMap(field => field.input ? [field.input.interfacePath] : [])]
  return createSensitiveFormPolicy(binding, new Map(endpoints.map(path => [path, { status: 'ready', fields: fields[path] ?? [] }])), hidden, missing)
}
const restriction = (param_name, restriction_type = 2, io_type = 'INPUT') => ({ param_name, restriction_type, io_type })
const original = () => ({ product_id: 'p1', factory_price: '0', min_sale_price: '10', sale_prices: [{ sale_price_id: 'price1', customer_type_id: 'c1', sale_price: '12.50', remark: '原备注' }], product_suppliers: [{ supplier_id: 's1', preset_purchase_price: '2.345' }] })
const context = (data, p = policy()) => ({ originalData: data, canWrite: p.editable, sanitizeFor: p.sanitizeFor })

test('只读价格保留展示，隐藏价格连同派生毛利移除；普通备注和主键保留', () => {
  const p = policy({ '/tenant-products/update': [restriction('factory_price')], '/tenant-products/sale-prices/update': [restriction('items[].sale_price', 1)] })
  assert.equal(p.visible('factory_price'), true); assert.equal(p.editable('factory_price'), false)
  assert.equal(p.visible('sale_prices[].sale_price'), false); assert.equal(p.visible('sale_prices[].gross_profit_rate'), false)
  assert.equal(p.canMutateRelation('sale_prices'), false)
  assert.deepEqual(p.sanitizeDraft({ factory_price: '0', remark: '备注', sale_prices: [{ sale_price_id: 'sp', sale_price: '12', remark: '' }] }), { remark: '备注', sale_prices: [{ sale_price_id: 'sp', remark: '' }] })
})

test('输出限制使用真实 suppliers 路径，同时清理表单别名和原始响应，更新按 supplier_id[] 省略', () => {
  const p = policy({}, ['suppliers[].preset_purchase_price'])
  assert.equal(p.visible('product_suppliers[].preset_purchase_price'), false)
  assert.ok(p.hiddenKeys.includes('suppliers[].preset_purchase_price'))
  assert.deepEqual(p.sanitizeFor('/tenant-products/suppliers/update-price', { product_id: 'p', supplier_id: [{ supplier_id: 's', preset_purchase_price: '2' }] }), { product_id: 'p', supplier_id: [{ supplier_id: 's' }] })
})

test('预判失败时禁止更新，缺键不被零覆盖；空关系数组不误判价格权限', () => {
  const p = createSensitiveFormPolicy(binding, new Map())
  assert.equal(p.confirmed, false); assert.equal(p.editable('factory_price'), false)
  assert.throws(() => p.sanitizeFor('/tenant-products/update', {}), /未确认/)
  const missing = missingFormFields({ factory_price: 0, sale_prices: [], product_suppliers: [] }, binding)
  assert.equal(missing.includes('factory_price'), false); assert.equal(missing.includes('min_sale_price'), true)
  assert.equal(missing.includes('sale_prices[].sale_price'), false)
  assert.equal(policy({}, [], missing).visible('gross_profit_ctrl_rate'), false)
})

test('明确null是业务未定价，不能当作响应删键隐藏整列或禁止补录', () => {
  const data = { ...original(), product_suppliers: [{ supplier_id: 's1', preset_purchase_price: null }] }
  const missing = missingFormFields(data, binding)
  assert.equal(missing.includes('product_suppliers[].preset_purchase_price'), false)
  const p = policy({}, [], missing)
  assert.equal(p.visible('product_suppliers[].preset_purchase_price'), true)
  assert.equal(p.editable('product_suppliers[].preset_purchase_price'), true)
  assert.equal(p.canMutateRelation('product_suppliers'), true)
})

test('受限产品只改备注：不新增/删除关系，不写隐藏价格，也支持清空客户价格备注', () => {
  const data = original()
  const p = policy({ '/tenant-products/sale-prices/update': [restriction('items[].sale_price')], '/tenant-products/suppliers/update-price': [restriction('supplier_id[].preset_purchase_price')] })
  const draft = p.sanitizeDraft({ ...data, sale_prices: [{ ...data.sale_prices[0], remark: '' }] })
  const changes = productRelationChanges(draft, context(data, p))
  assert.deepEqual(changes.updatedPrices, [{ sale_price_id: 'price1', remark: '' }])
  assert.deepEqual(changes.updatedSuppliers, []); assert.deepEqual(changes.removedPrices, [])
})

test('未加载关系不解释为清空，受限关系不能通过删除重建或换客户类型改价', () => {
  assert.deepEqual(productRelationChanges({ remark: '新' }, context({ product_id: 'p1' })).removedSuppliers, [])
  const data = original(), p = policy({}, ['sale_prices[].sale_price', 'suppliers[].preset_purchase_price'])
  assert.throws(() => productRelationChanges({ ...data, sale_prices: [] }, context(data, p)), /不能新增、删除/)
  assert.throws(() => productRelationChanges({ ...data, product_suppliers: [{ supplier_id: 's2' }] }, context(data, p)), /不能新增、删除/)
  assert.throws(() => productRelationChanges({ ...data, sale_prices: [{ ...data.sale_prices[0], customer_type_id: 'c2' }] }, context(data, p)), /不能新增、删除/)
})

test('不同编辑表单使用各自快照，历史高精度和数值等价价格不重复更新', () => {
  const first = original(), second = { ...original(), product_id: 'p2', sale_prices: [{ sale_price_id: 'other', customer_type_id: 'c2', sale_price: '30' }] }
  const changes = productRelationChanges({ ...first, product_suppliers: [{ supplier_id: 's1', preset_purchase_price: '02.3450' }] }, context(first))
  assert.deepEqual(changes.updatedSuppliers, []); assert.deepEqual(changes.updatedPrices, [])
  assert.deepEqual(productRelationChanges({ ...second, sale_prices: [] }, context(second)).removedPrices, ['other'])
  assert.throws(() => productRelationChanges({ ...first, sale_prices: second.sale_prices }, context(first)), /不属于本次详情/)
})
