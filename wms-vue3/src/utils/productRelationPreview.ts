import type { ProductRelationPreview, ProductRelationPreviewRow } from '../api/modules/productBatch'

export function validateProductRelationPreview(value: unknown): ProductRelationPreview {
  const data = value as ProductRelationPreview
  if (!data || !['total_rows', 'create_count', 'update_count', 'skipped_count'].every(key => Number.isSafeInteger(data[key as keyof ProductRelationPreview]) && Number(data[key as keyof ProductRelationPreview]) >= 0)
      || !Array.isArray(data.create_list) || !Array.isArray(data.update_list)
      || data.create_count < data.create_list.length || data.update_count < data.update_list.length
      || data.create_count + data.update_count + data.skipped_count !== data.total_rows) {
    throw new Error('预览返回不完整，请重新预览后提交')
  }
  const rows = [...data.create_list, ...data.update_list]
  if (rows.some(row => !row || !Number.isSafeInteger(row.row_number) || row.row_number < 2 || !row.product || !row.product.product_code)
    || data.update_list.some(row => !row.before || !row.after || !Array.isArray(row.changed_fields))) throw new Error('预览明细格式不完整，请重新预览')
  return data
}
export function relationPreviewTruncated(value: ProductRelationPreview): boolean {
  return value.create_count > value.create_list.length || value.update_count > value.update_list.length
}
export function canSubmitRelationPreview(value: ProductRelationPreview | null): boolean {
  return !!value && value.total_rows > 0 && value.skipped_count === 0 && !relationPreviewTruncated(value)
}
export function relationPreviewChanges(row: ProductRelationPreviewRow): Array<{ key: string; label: string; before: unknown; after: unknown }> {
  const labels: Record<string, string> = { supplier_model: '供应商型号', preset_purchase_price: '供应商预设采购价', sale_price: '销售价格', remark: '备注' }
  return (row.changed_fields ?? []).filter(key => key in labels && Object.prototype.hasOwnProperty.call(row.after, key)).map(key => ({ key, label: labels[key], before: row.before?.[key], after: row.after?.[key] }))
}
