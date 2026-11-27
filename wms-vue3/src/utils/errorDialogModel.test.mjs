import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildErrorDialogContent, errorDialogCopyText } from './errorDialogModel.ts'

test('dialog and clipboard use only approved error values, with at most five details', () => {
  const content = buildErrorDialogContent({
    message: '保存失败', blockedFields: ['采购价格'],
    validationErrors: Array.from({ length: 8 }, (_, i) => `原因${i + 1}`),
    stack: 'SECRET_STACK', config: { headers: { Authorization: 'SECRET_TOKEN' } },
    response: { data: { private: 'SECRET_DATA' } },
  })
  assert.equal(content.details.length, 5)
  assert.deepEqual(content.fields, ['采购价格'])
  const copied = errorDialogCopyText(content)
  assert.match(copied, /采购价格/)
  assert.doesNotMatch(copied, /SECRET|原因6|原因7|原因8/)
})

test('plain text and structured validation errors remain readable without object serialization', () => {
  const content = buildErrorDialogContent('<img src=x onerror=alert(1)>\n下一行')
  assert.equal(content.reason, '<img src=x onerror=alert(1)>')
  assert.deepEqual(content.details, ['下一行'])
  const validation = buildErrorDialogContent([{ loc: ['body', 'quantity'], msg: '数量不能为空', input: 'SECRET' }])
  assert.deepEqual(validation.details, ['quantity：数量不能为空'])
  assert.doesNotMatch(errorDialogCopyText(validation), /SECRET/)
  assert.equal(buildErrorDialogContent({ config: 'SECRET' }).reason, '操作未完成，请稍后重试')
})

test('服务器 Traceback 只展示和复制状态码，不保留诊断明细或字段', () => {
  const expected = { title: 'Status code', reason: '500 Internal Server Error', fields: [], details: [] }
  const traceback = 'Traceback (most recent call last):\n  File "private/server.py", line 12\nDatabaseError: PRIVATE_DATA'
  assert.deepEqual(buildErrorDialogContent(traceback), expected)
  const content = buildErrorDialogContent('请求失败', { statusCode: 500, details: [traceback], fields: ['PRIVATE_FIELD'] })
  assert.deepEqual(content, expected)
  assert.equal(errorDialogCopyText(content), 'Status code\n500 Internal Server Error')
  assert.deepEqual(buildErrorDialogContent('请求失败', { details: [traceback] }), expected)
  assert.deepEqual(buildErrorDialogContent('Internal Server Error'), expected)
})

test('使用实际服务器状态码，普通业务错误仍保留原有原因和字段', () => {
  assert.equal(buildErrorDialogContent({ message: '网关错误', response: { status: 503 } }).reason, '503 Service Unavailable')
  const content = buildErrorDialogContent('无权修改', { statusCode: 403, fields: ['采购价格'] })
  assert.equal(content.title, '操作失败')
  assert.equal(content.reason, '无权修改')
  assert.deepEqual(content.fields, ['采购价格'])
})
