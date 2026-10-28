import type { FormSaveContext } from './sensitiveForm'

const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
export function sameProductPrice(a: unknown, b: unknown): boolean {
  const normalize = (value: unknown) => String(value ?? '').trim().replace(/^0+(?=\d)/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return normalize(a) === normalize(b)
}

/** 在主资料写入前计算和检查差量。缺失的关系表不解释为清空。 */
export function productRelationChanges(data: Record<string, any>, context: FormSaveContext) {
  const original = context.originalData
  const saleWritable = context.canWrite('sale_prices[].sale_price')
  const supplierWritable = context.canWrite('product_suppliers[].preset_purchase_price')
  const prices: any[] | null = Array.isArray(original.sale_prices) && own(data, 'sale_prices') ? data.sale_prices : null
  const suppliers: any[] | null = Array.isArray(original.product_suppliers) && own(data, 'product_suppliers') ? data.product_suppliers : null
  if (prices !== null && !Array.isArray(prices)) throw new Error('客户价格明细格式不完整，请重新加载')
  if (suppliers !== null && !Array.isArray(suppliers)) throw new Error('关联供应商明细格式不完整，请重新加载')
  const originalPrices: any[] = original.sale_prices ?? []
  const originalSuppliers: any[] = original.product_suppliers ?? []
  const oldPriceMap = new Map(originalPrices.map(row => [row.sale_price_id, row]))
  const oldSupplierMap = new Map(originalSuppliers.map(row => [row.supplier_id, row]))
  const removedPrices = prices === null ? [] : originalPrices.filter(old => !prices.some(row => row.sale_price_id === old.sale_price_id)).map(row => String(row.sale_price_id))
  const removedSuppliers = suppliers === null ? [] : originalSuppliers.filter(old => !suppliers.some(row => row.supplier_id === old.supplier_id)).map(row => String(row.supplier_id))
  const addedPrices = (prices ?? []).filter(row => !row.sale_price_id)
  const addedSuppliers = (suppliers ?? []).filter(row => !oldSupplierMap.has(row.supplier_id))
  if (!saleWritable && (removedPrices.length || addedPrices.length || (prices ?? []).some(row => oldPriceMap.get(row.sale_price_id)?.customer_type_id !== row.customer_type_id))) throw new Error('客户价格受限，不能新增、删除或更换客户类型')
  if (!supplierWritable && (removedSuppliers.length || addedSuppliers.length)) throw new Error('供应商预设价受限，不能新增、删除或更换关联供应商')
  const updatedPrices = (prices ?? []).flatMap(row => {
    if (!row.sale_price_id) return []
    const old = oldPriceMap.get(row.sale_price_id)
    if (!old) throw new Error('客户价格记录不属于本次详情，请重新加载')
    const patch: { sale_price_id: string; sale_price?: string; remark?: string; customer_type_id?: string } = { sale_price_id: row.sale_price_id }
    if (saleWritable && own(row, 'sale_price') && !sameProductPrice(old.sale_price, row.sale_price)) patch.sale_price = String(row.sale_price)
    if ((row.remark ?? '') !== (old.remark ?? '')) patch.remark = String(row.remark ?? '')
    if (saleWritable && row.customer_type_id !== old.customer_type_id) patch.customer_type_id = row.customer_type_id
    return Object.keys(patch).length > 1 ? [patch] : []
  })
  const updatedSuppliers = (suppliers ?? []).filter(row => supplierWritable && oldSupplierMap.has(row.supplier_id) && own(row, 'preset_purchase_price') && !sameProductPrice(oldSupplierMap.get(row.supplier_id)?.preset_purchase_price, row.preset_purchase_price))
  return { prices, suppliers, saleWritable, supplierWritable, removedPrices, removedSuppliers, addedPrices, addedSuppliers, updatedPrices, updatedSuppliers }
}
