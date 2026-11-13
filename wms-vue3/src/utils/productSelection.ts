/** 预判失败时选择动作只携带产品身份与规格，禁止从跨页旧选择带出价格/库存。 */
const identityKeys = new Set(['product_id', 'product_code', 'product_name', 'product_type', 'product_status', 'item_no', 'category_id', 'category_name', 'specification', 'color', 'unit_id', 'unit_name', 'is_combined', 'supplier_id', 'supplier_name', 'supplier_model'])
export function productSelectionIdentity<T>(products: T[]): T[] {
  return products.map(product => Object.fromEntries(Object.entries(product as object).filter(([key]) => identityKeys.has(key))) as T)
}
