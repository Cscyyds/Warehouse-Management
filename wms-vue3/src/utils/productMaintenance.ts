export interface ProductMaintenancePolicy {
  supplier_required: boolean
  supplier_price_required: boolean
  customer_price_required: boolean
  policy_version: string
}
const text = (value: unknown) => String(value ?? '').trim()

/** 新空行可以省略，已有关系不因字段缺失而删除或清空。 */
export function normalizeProductRelations(data: Record<string, any>, policy: ProductMaintenancePolicy) {
  let skippedPrices = false
  const normalized = { ...data }
  if (Array.isArray(data.product_suppliers)) {
    normalized.product_suppliers = data.product_suppliers.filter((row: any) => {
      if (!text(row.supplier_id) && text(row.preset_purchase_price)) throw new Error('填写采购价时请选择供应商')
      return !!text(row.supplier_id)
    })
  }
  if (!policy.customer_price_required && Array.isArray(data.sale_prices)) {
    normalized.sale_prices = data.sale_prices.filter((row: any) => {
      if (row.sale_price_id) return true
      if (!text(row.customer_type_id) && text(row.sale_price)) throw new Error('填写销售价格时请选择客户类型')
      if (!text(row.sale_price)) { skippedPrices ||= !!text(row.customer_type_id); return false }
      return true
    })
  }
  return { data: normalized, skippedPrices }
}
