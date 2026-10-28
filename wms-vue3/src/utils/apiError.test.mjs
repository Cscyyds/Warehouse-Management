import { test } from 'node:test'
import assert from 'node:assert/strict'
import { errorTextToSafeHtml, normalizeApiError, normalizeBlobError } from './apiError.ts'

test('服务器包装的敏感字段错误保留具体文案和中文字段名', () => {
  const raw = { message: '操作失败', data: { message: '当前角色无权限修改', blocked_fields: [
    { field_id: 'sf_price', field_label: '销售价格' }, { field_id: 'sf_price', field_label: '销售价格' },
  ] } }
  const result = normalizeApiError(raw)
  assert.equal(result.message, '当前角色无权限修改：销售价格')
  assert.deepEqual(result.blockedFields, ['销售价格'])
  assert.equal(result.raw, raw)
})

test('兼容原生 detail、旧版详情和请求校验错误', () => {
  assert.equal(normalizeApiError({ detail: { message: '不可查看', blocked_fields: [{ field_label: '成本' }] } }).message, '不可查看：成本')
  assert.equal(normalizeApiError({ message: '删除失败', data: { detail: '存在关联记录' } }).message, '删除失败，存在关联记录')
  assert.equal(normalizeApiError({ detail: [{ loc: ['body', 'qty'], msg: '不能为空' }] }).message, 'qty：不能为空')
})

test('导入错误保留工作表、原始行号，超过三条时显示总数', () => {
  const result = normalizeApiError({ data: { errors: { 明细: [
    { row: 2, name: 'A', reason: '编码不存在' }, { row: 3, reason: '数量非法' },
    { row: 4, reason: '重复' }, { row: 5, reason: '缺少字段' },
  ] } } })
  assert.equal(result.message, '工作表「明细」第2行「A」：编码不存在\n工作表「明细」第3行：数量非法\n工作表「明细」第4行：重复\n…等 4 条错误')
})

test('下载错误读取 Blob JSON，网关 HTML 使用兜底提示', async () => {
  const blob = new Blob([JSON.stringify({ data: { message: '无权下载', blocked_fields: [{ field_label: '成本' }] } })])
  assert.equal((await normalizeBlobError(blob, '下载失败')).message, '无权下载：成本')
  assert.equal((await normalizeBlobError(new Blob(['<html>错误页</html>']), '下载失败')).message, '下载失败')
})

test('错误文本中的 HTML 被转义，换行仍能展示', () => {
  assert.equal(errorTextToSafeHtml('<img src=x onerror="bad">\n下一行'), '&lt;img src=x onerror=&quot;bad&quot;&gt;<br/>下一行')
})
