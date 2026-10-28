import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateProductRelationPreview, relationPreviewTruncated, canSubmitRelationPreview, relationPreviewChanges } from './productRelationPreview.ts'

const preview = () => ({ total_rows: 1, create_count: 0, update_count: 1, skipped_count: 0, create_list: [], update_list: [{ row_number: 2, product: { product_code: '001' }, before: { sale_price: '0' }, after: {}, changed_fields: [] }] })
test('无变化仍是有效预览，after缺键不解释为清空', () => {
  const value = validateProductRelationPreview(preview())
  assert.equal(canSubmitRelationPreview(value), true)
  assert.deepEqual(relationPreviewChanges(value.update_list[0]), [])
})
test('预览有错或被截断时禁止执行，统计不使用数组长度代替', () => {
  const truncated = { ...preview(), total_rows: 100, update_count: 100 }
  assert.equal(relationPreviewTruncated(validateProductRelationPreview(truncated)), true)
  assert.equal(canSubmitRelationPreview(truncated), false)
  assert.equal(canSubmitRelationPreview({ ...preview(), total_rows: 2, skipped_count: 1 }), false)
})
test('缺少结果字段或计数不一致不能当作预览通过', () => {
  assert.throws(() => validateProductRelationPreview({ ...preview(), update_count: 2 }))
  assert.throws(() => validateProductRelationPreview({ ...preview(), skipped_count: undefined }))
})
