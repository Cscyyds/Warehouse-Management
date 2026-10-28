import { post, postBinary, toMultipart, type RequestConfig } from '@/utils/request'

export type ProductRelationKind = 'product-supplier' | 'product-sale-price'
export interface ProductRelationPreviewRow {
  row_number: number
  product: { product_id: string; product_code: string; product_name: string }
  revive_flag?: boolean
  supplier_name?: string
  supplier_model?: string | null
  preset_purchase_price?: string | null
  customer_type_name?: string
  sale_price?: string | null
  remark?: string | null
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  changed_fields?: string[]
}
export interface ProductRelationPreview {
  total_rows: number
  create_count: number
  update_count: number
  skipped_count: number
  create_list: ProductRelationPreviewRow[]
  update_list: ProductRelationPreviewRow[]
}
export function previewProductRelations(kind: ProductRelationKind, file: File, config?: RequestConfig) {
  const path = kind === 'product-supplier' ? 'suppliers' : 'sale-prices'
  return post<ProductRelationPreview>(`/api/v1/tenant-products/${path}/import/preview`, toMultipart({ file }), { timeout: 120000, ...config })
}
export function exportProductData(productIds: string[] | undefined, positions = false) {
  const ids = productIds?.map(id => id.trim()).filter(Boolean)
  if (ids && !ids.length) throw new Error('请先勾选需要导出的产品')
  return postBinary(positions ? '/api/v1/tenant-products/positions/export' : '/api/v1/tenant-products/export', ids ? { product_ids: [...new Set(ids)] } : {})
}
