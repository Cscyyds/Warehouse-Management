import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeProductRelations } from './productMaintenance.ts'
import { productRelationChanges } from './productEdit.ts'
const policy = { supplier_required: false, supplier_price_required: false, customer_price_required: false, policy_version: '20261102' }
test('天心空关系不产生定价，已存在行保持', () => {
  const existing = { sale_price_id: 'old', customer_type_id: 'a' }
  const source = { sale_prices: [{}, { customer_type_id: 'b' }, existing], product_suppliers: [{}, { supplier_id: 's' }] }
  const result = normalizeProductRelations(source, policy)
  assert.deepEqual(result.data.sale_prices, [existing])
  assert.deepEqual(result.data.product_suppliers, [{ supplier_id: 's' }])
  assert.equal(source.sale_prices.length, 3)
  assert.ok(result.skippedPrices)
})
test('无归属价格拒绝，普通租户规则不被省略', () => {
  assert.throws(() => normalizeProductRelations({ sale_prices: [{ sale_price: 12 }] }, policy))
  assert.throws(() => normalizeProductRelations({ product_suppliers: [{ preset_purchase_price: 12 }] }, policy))
  assert.deepEqual(normalizeProductRelations({sale_prices:[{}]}, {...policy, customer_price_required:true}).data.sale_prices, [{}])
})
test('天心编辑留空旧价保持原值，仍可更新备注', () => {
  const originalData = { sale_prices: [{sale_price_id:'p',customer_type_id:'c',sale_price:'12',remark:''}],
    product_suppliers: [{supplier_id:'s',preset_purchase_price:'5'}] }
  const changes = productRelationChanges({sale_prices:[{sale_price_id:'p',customer_type_id:'c',sale_price:'',remark:'备注'}],
    product_suppliers:[{supplier_id:'s',preset_purchase_price:''}]}, {originalData,canWrite:()=>true}, {ignoreBlankPrices:true})
  assert.deepEqual(changes.updatedPrices,[{sale_price_id:'p',remark:'备注'}])
  assert.deepEqual(changes.updatedSuppliers,[])
})
