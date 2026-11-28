import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeErrorText, sanitizeDiagnosticPayload, sanitizeErrorResponse } from './serverErrorDisplay.ts'
import { normalizeApiError, normalizeBlobError } from './apiError.ts'
import { importErrorPage, importRequestError } from './importTask.ts'
import { createAskStreamState, feedAskSse, finishAskStream } from '../views/ai/data-platform/askStream.ts'
import { createAgentPocStreamState, feedAgentPocSse, finishAgentPocStream, normalizeOfficeHistory } from '../agent/office/officeChatApi.ts'

const trace = 'Traceback (most recent call last):\n  File "private/server.py", line 20\nRuntimeError: PRIVATE_DETAIL'
const status = 'Status code\n500 Internal Server Error'

test('Python、JS、Java和数据库诊断统一为状态码，普通业务错误不变', () => {
  for (const text of [trace, 'TypeError: PRIVATE_DETAIL\n    at handler (/private/service.js:20:5)',
    'java.lang.RuntimeException: PRIVATE_DETAIL\n at com.example.Service.run(Service.java:23)',
    '(sqlalchemy.exc.ProgrammingError) PRIVATE_DETAIL\n[SQL: SELECT private]',
    '调用失败：\n' + status]) assert.equal(safeErrorText(text), status)
  assert.equal(safeErrorText(trace, 503), 'Status code\n503 Service Unavailable')
  assert.equal(safeErrorText('采购价格不能为空'), '采购价格不能为空')
  assert.equal(safeErrorText('Traceback 字段不能为空'), 'Traceback 字段不能为空')
})

test('HTTP200任务错误、错误明细和请求错误统一简化，保留任务状态和文档正文', () => {
  const raw = { status: 'FAILED_SYSTEM', error_message: trace, last_error_message: trace, errors: [{ row: 2, reason: trace }],
    content: trace, text: trace, document_id: 'A', data: { blocked_fields: ['采购价格'] } }
  const safe = sanitizeDiagnosticPayload(raw, 200)
  assert.equal(safe.error_message, status)
  assert.equal(safe.last_error_message, status)
  assert.equal(safe.errors[0].reason, status)
  assert.equal(safe.status, 'FAILED_SYSTEM')
  assert.equal(safe.content, trace)
  assert.equal(safe.text, trace)
  assert.equal(raw.error_message, trace, '不能修改原始对象供日志定位使用')
  assert.equal(importErrorPage({ ...raw, error_total: 1 }).rows[0].reason, status)
  assert.equal(importRequestError({ message: trace }), status)
  assert.equal(normalizeApiError({ message: '删除失败', data: { detail: trace } }).message, status)
  const normal = { message: '产品编码不存在', errors: [{ row: 2, reason: '数量必须大于零' }] }
  assert.equal(sanitizeDiagnosticPayload(normal), normal)
})

test('JSON和错误文本延迟读取并保留Response元信息，成功文件和流不被读取', async () => {
  const original = new Response(JSON.stringify({ status: 'FAILED_SYSTEM', error_message: trace }), { headers: { 'content-type': 'application/json' } })
  const response = await sanitizeErrorResponse(original)
  assert.equal(response.bodyUsed, false)
  assert.equal((await response.clone().json()).error_message, status)
  assert.equal(response.bodyUsed, false)
  assert.equal((await response.json()).error_message, status)
  const failed = await sanitizeErrorResponse(new Response(trace, { status: 500, headers: { 'content-type': 'text/plain' } }))
  assert.equal(failed.status, 500)
  assert.equal(await failed.text(), status)
  const malformed = await sanitizeErrorResponse(new Response('PRIVATE_NOT_JSON', { status: 500, headers: { 'content-type': 'application/json' } }))
  await assert.rejects(malformed.json(), error => error.message === status)
  for (const type of ['application/pdf', 'text/event-stream']) {
    const file = new Response('original-data', { headers: { 'content-type': type } })
    assert.equal(await sanitizeErrorResponse(file), file)
    assert.equal(file.bodyUsed, false)
    assert.equal(await file.text(), 'original-data')
  }
})

test('Blob中的HTML/JSON堆栈、SSE错误和历史错误不会泄露诊断，正常用户内容保留', async () => {
  assert.equal((await normalizeBlobError(new Blob(['<html><pre>' + trace + '</pre></html>']))).message, status)
  const ask = createAskStreamState()
  feedAskSse(ask, `event: error\ndata: ${JSON.stringify({ message: trace })}\n\n`)
  assert.throws(() => finishAskStream(ask), error => error.message === status)
  const office = createAgentPocStreamState()
  feedAgentPocSse(office, `data: ${JSON.stringify({ type: 'error', error: trace })}\n\n`)
  assert.throws(() => finishAgentPocStream(office), error => error.message === status)
  const history = normalizeOfficeHistory({ messages: [
    { role: 'assistant', finish_reason: 'error', content: trace }, { role: 'user', content: trace },
  ] }, 'session')
  assert.equal(history[0].content, status)
  assert.equal(history[1].content, trace)
})
