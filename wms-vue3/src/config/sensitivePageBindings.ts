/** 路径来自已登记的后端过滤/更新拦截；表单别名在此显式转换。 */
export interface SensitiveFormBinding {
  detail: string
  fields: Record<string, { output: string; input?: { interfacePath: string; param: string }; dependsOn?: string[] }>
  relations?: Record<string, string>
}

export const sensitiveFormBindings: Record<string, SensitiveFormBinding> = {
  purchaseSupplier: {
    detail: '/tenant-suppliers/detail',
    fields: {
      balance: { output: 'supplier[].balance' },
      credit_limit: { output: 'supplier[].credit_limit' },
      credit_amount: { output: 'supplier[].credit_amount' },
      prepayment_amount: { output: 'supplier[].prepayment_amount' },
      gift_amount: { output: 'supplier[].gift_amount' },
    },
  },
  productInfo: {
    detail: '/tenant-products/detail',
    fields: {
      factory_price: { output: 'factory_price', input: { interfacePath: '/tenant-products/update', param: 'factory_price' } },
      min_sale_price: { output: 'min_sale_price', input: { interfacePath: '/tenant-products/update', param: 'min_sale_price' } },
      avg_cost_price: { output: 'avg_cost_price' },
      gross_profit_ctrl_rate: { output: 'gross_profit_ctrl_rate', dependsOn: ['factory_price', 'min_sale_price'] },
      stock_warning_qty: { output: 'stock_warning_qty' },
      available_stock: { output: 'available_stock' },
      supplier_preset_purchase_price: { output: 'supplier_preset_purchase_price' },
      'sale_prices[].sale_price': { output: 'sale_prices[].sale_price', input: { interfacePath: '/tenant-products/sale-prices/update', param: 'items[].sale_price' } },
      'sale_prices[].gross_profit_rate': { output: 'sale_prices[].gross_profit_rate', dependsOn: ['factory_price', 'sale_prices[].sale_price'] },
      'product_suppliers[].avg_cost_price': { output: 'suppliers[].avg_cost_price' },
      'product_suppliers[].preset_purchase_price': { output: 'suppliers[].preset_purchase_price', input: { interfacePath: '/tenant-products/suppliers/update-price', param: 'supplier_id[].preset_purchase_price' } },
      'components[].unit_price': { output: 'components[].unit_price' },
    },
    // 价格受限时禁止删行重建/换对象改价；普通备注仍可独立保存。
    relations: { sale_prices: 'sale_prices[].sale_price', product_suppliers: 'product_suppliers[].preset_purchase_price' },
  },
}
