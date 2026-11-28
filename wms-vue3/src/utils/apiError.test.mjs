import { test } from 'node:test'
import assert from 'node:assert/strict'
import { errorTextToSafeHtml, normalizeApiError, normalizeBlobError } from './apiError.ts'

test('字符串data中的业务原因与message一起保留，重复文案不重复展示', () => {
  assert.equal(normalizeApiError({ success: false, message: '变更采购状态失败', data: '订单已是已采购状态，无需重复变更' }).message,
    '变更采购状态失败\n订单已是已采购状态，无需重复变更')
  assert.equal(normalizeApiError({ message: '操作失败', data: '操作失败' }).message, '操作失败')
})

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

test('导入错误保留工作表、原始行号，最多展示五条', () => {
  const result = normalizeApiError({ data: { errors: { 明细: [
    { row: 2, name: 'A', reason: '编码不存在' }, { row: 3, reason: '数量非法' },
    { row: 4, reason: '重复' }, { row: 5, reason: '缺少字段' },
  ] } } })
  assert.equal(result.message, '工作表「明细」第2行「A」：编码不存在\n工作表「明细」第3行：数量非法\n工作表「明细」第4行：重复\n工作表「明细」第5行：缺少字段')
})

test('下载错误读取 Blob JSON，网关 HTML 使用兜底提示', async () => {
  const blob = new Blob([JSON.stringify({ data: { message: '无权下载', blocked_fields: [{ field_label: '成本' }] } })])
  assert.equal((await normalizeBlobError(blob, '下载失败')).message, '无权下载：成本')
  assert.equal((await normalizeBlobError(new Blob(['<html>错误页</html>']), '下载失败')).message, '下载失败')
})

test('错误文本中的 HTML 被转义，换行仍能展示', () => {
  assert.equal(errorTextToSafeHtml('<img src=x onerror="bad">\n下一行'), '&lt;img src=x onerror=&quot;bad&quot;&gt;<br/>下一行')
})

test('嵌套校验错误保留操作说明和最多五条字段原因', () => {
  const raw = { message: '新增供应商失败', data: { detail: '参数校验失败', data: Array.from({ length: 6 }, (_, i) => ({ loc: ['body', `field${i + 1}`], msg: `原因${i + 1}` })) } }
  const result = normalizeApiError(raw)
  assert.match(result.message, /新增供应商失败/)
  assert.match(result.message, /参数校验失败/)
  assert.match(result.message, /field5：原因5/)
  assert.doesNotMatch(result.message, /原因6/)
})

test('占用员工和供应商关联错误只展示可读的白名单详情', () => {
  const result = normalizeApiError({ message: '删除组织失败', data: { detail: '仍有员工使用', using_user_total: 2, using_user: [{ user_name: '张三', login_name: 'SECRET' }, { user_name: '李四' }] } })
  assert.match(result.message, /张三/)
  assert.match(result.message, /李四/)
  assert.match(result.message, /2/)
  assert.doesNotMatch(result.message, /SECRET/)
  const supplier = normalizeApiError({ message: '关联供应商失败', data: { detail: '供应商无效', invalid_supplier_ids: ['sup1', 'sup2'] } })
  assert.match(supplier.message, /sup1/)
  assert.match(supplier.message, /sup2/)
})

test('对象 data 同时有 message 和 detail 时保留具体原因', () => {
  const result = normalizeApiError({ message: '保存失败', data: { message: '参数错误', detail: '数量必须大于零' } })
  assert.match(result.message, /参数错误/)
  assert.match(result.message, /数量必须大于零/)
})

test('多条错误保留上下文，最多五条，堆栈即使位于限制之后也只返回状态码', () => {
  const errors = Array.from({ length: 6 }, (_, i) => ({ label: `第${i + 1}条`, errors: [`原因${i + 1}`] }))
  const raw = { message: '保存价格失败', data: { message: '校验失败', errors } }
  const result = normalizeApiError(raw)
  assert.match(result.message, /保存价格失败/)
  assert.match(result.message, /第5条：原因5/)
  assert.doesNotMatch(result.message, /原因6/)
  errors[5].errors[0] = 'Traceback (most recent call last):\nPRIVATE_STACK'
  assert.equal(normalizeApiError(raw).message, 'Status code\n500 Internal Server Error')
})
