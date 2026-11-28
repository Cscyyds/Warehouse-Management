import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAgentPocStreamState,
  streamOfficeChat,
  exceedsOfficeFileLimit,
  feedAgentPocSse,
  finishAgentPocStream,
  formatOfficeRelativeTime,
  generateOfficeSessionId,
  normalizeOfficeHistory,
  normalizeOfficeSessions,
  OfficeApiError,
  OfficeStreamDisconnectedError,
  parseOfficeIsoUtc,
  resolveOfficeImages,
  resolveOfficeUploadTarget,
  toOfficeUserAttachment,
} from './officeChatApi.ts'

// ─── 会话 ───────────────────────────────────────────────────────────────

test('generateOfficeSessionId 生成 web- 前缀的 12 位会话 ID', () => {
  const id = generateOfficeSessionId()
  assert.match(id, /^web-[0-9a-f]{12}$/)
})

test('normalizeOfficeSessions 解析 agent_poc 会话列表', () => {
  const sessions = normalizeOfficeSessions({
    sessions: [
      { sid: 'app-abc123', title: '查库存', preview: '库存充足', updated_at: '2026-10-12T08:30:00+00:00' },
      { sid: '', title: '无效' },
      { title: '缺少 sid 跳过' },
    ],
  })
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].id, 'app-abc123')
  assert.equal(sessions[0].title, '查库存')
})

test('normalizeOfficeSessions 空标题回退为新会话', () => {
  const sessions = normalizeOfficeSessions({ sessions: [{ sid: 'x1', title: '' }] })
  assert.equal(sessions[0].title, '新会话')
})

test('parseOfficeIsoUtc 兼容 UTC 偏移与无时区写法', () => {
  const withOffset = parseOfficeIsoUtc('2026-10-12T08:30:00+00:00')
  const naive = parseOfficeIsoUtc('2026-10-12T08:30:00')
  assert.equal(withOffset, Date.parse('2026-10-12T08:30:00Z'))
  assert.equal(naive, Date.parse('2026-10-12T08:30:00Z'))
  assert.equal(parseOfficeIsoUtc(''), null)
})

test('formatOfficeRelativeTime 输出相对时间文案', () => {
  const now = Date.now()
  assert.equal(formatOfficeRelativeTime(new Date(now - 30_000).toISOString()), '刚刚')
  assert.equal(formatOfficeRelativeTime(new Date(now - 5 * 60_000).toISOString()), '5分钟前')
  assert.equal(formatOfficeRelativeTime(new Date(now - 3 * 3_600_000).toISOString()), '3小时前')
})

// ─── 历史消息 ───────────────────────────────────────────────────────────

test('normalizeOfficeHistory 解析消息并把挂起态标记为待作答', () => {
  const messages = normalizeOfficeHistory({
    messages: [
      { role: 'user', content: '查库存', turn_no: '1', created_at: '2026-10-12T08:30:00+00:00' },
      { role: 'assistant', content: '', finish_reason: 'success', turn_no: '1' },
      { role: 'assistant', content: '要查哪种？', options: ['A 商品', 'B 商品'], turn_no: '1' },
    ],
    pending: { type: 'select' },
  }, 'app-s1')
  assert.equal(messages.length, 2)
  assert.equal(messages[0].role, 'user')
  assert.equal(messages[1].status, 'waiting_input')
  assert.deepEqual(messages[1].options, ['A 商品', 'B 商品'])
  assert.ok(messages[1].id.startsWith('history_app-s1_t'))
})

test('normalizeOfficeHistory 无挂起态时选项消息保持 success', () => {
  const messages = normalizeOfficeHistory({
    messages: [{ role: 'assistant', content: '好的', options: ['继续'], finish_reason: 'stop' }],
  }, 'app-s2')
  assert.equal(messages[0].status, 'success')
})

// ─── SSE 流 ─────────────────────────────────────────────────────────────

test('feedAgentPocSse 逐字累计 delta 并在 done 时以终答覆盖', () => {
  const state = createAgentPocStreamState()
  const progress = []
  feedAgentPocSse(state, 'data: {"type":"delta","text":"你"}\n\n', { onProgress: c => progress.push(c) })
  feedAgentPocSse(state, 'data: {"type":"delta","text":"好"}\n\n', { onProgress: c => progress.push(c) })
  assert.equal(state.content, '你好')
  assert.deepEqual(progress, ['你', '你好'])

  feedAgentPocSse(state, 'data: {"type":"done","reply":"你好，库存充足","options":[]}\n\n')
  const result = finishAgentPocStream(state)
  assert.equal(result.content, '你好，库存充足')
  assert.equal(result.status, 'success')
})

test('feedAgentPocSse 支持跨块分片', () => {
  const state = createAgentPocStreamState()
  feedAgentPocSse(state, 'data: {"type":"delta","tex')
  feedAgentPocSse(state, 't":"半截"}\n\n')
  assert.equal(state.content, '半截')
})

test('finishAgentPocStream 未收到 done 视为连接中断', () => {
  const state = createAgentPocStreamState()
  feedAgentPocSse(state, 'data: {"type":"delta","text":"部分"}\n\n')
  assert.throws(() => finishAgentPocStream(state), OfficeStreamDisconnectedError)
})

test('finishAgentPocStream error 事件抛出 OfficeApiError', () => {
  const state = createAgentPocStreamState()
  feedAgentPocSse(state, 'data: {"type":"error","error":"模型限流"}\n\n')
  assert.throws(() => finishAgentPocStream(state), (error) =>
    error instanceof OfficeApiError && error.message === '模型限流')
})

test('done 带选项时终态为 waiting_input', () => {
  const state = createAgentPocStreamState()
  feedAgentPocSse(state, 'data: {"type":"done","reply":"请选择","options":["查销量","查库存"]}\n\n')
  const result = finishAgentPocStream(state)
  assert.equal(result.status, 'waiting_input')
  assert.deepEqual(result.options, ['查销量', '查库存'])
})

// ─── 上传附件 ───────────────────────────────────────────────────────────

test('resolveOfficeUploadTarget 按 MIME/后缀识别图片并补齐后缀', () => {
  const image = resolveOfficeUploadTarget(new File([], '照片.jpg', { type: 'image/jpeg' }))
  assert.equal(image.kind, 'image')
  assert.equal(image.mime, 'image/jpeg')

  const noExt = resolveOfficeUploadTarget(new File([], '微信缓存文件', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  assert.equal(noExt.kind, 'excel')
  assert.equal(noExt.name, '微信缓存文件.xlsx')

  const unknown = resolveOfficeUploadTarget(new File([], 'data.bin', { type: 'application/octet-stream' }))
  assert.equal(unknown.kind, 'excel')
  assert.equal(unknown.mime, 'application/octet-stream')
})

test('exceedsOfficeFileLimit 文档限一个、图片可多选', () => {
  const image = { id: '1', name: 'a.png', size: 1, url: 'u', kind: 'image', localUrl: '' }
  const doc = { id: '2', name: 'a.xlsx', size: 1, url: 'u', kind: 'excel', localUrl: '' }
  assert.equal(exceedsOfficeFileLimit([doc], [doc]), true)
  assert.equal(exceedsOfficeFileLimit([image, image], [image]), false)
  assert.equal(exceedsOfficeFileLimit([image], [doc]), false)
})

test('toOfficeUserAttachment 生成扩展名徽标', () => {
  const attachment = toOfficeUserAttachment({
    id: '1', name: '销售明细.xlsx', size: 10, url: 'https://b/x.xlsx', kind: 'excel', localUrl: '',
  })
  assert.equal(attachment.abbreviation, 'XLSX')
  assert.equal(attachment.isImage, false)

  const imageAttachment = toOfficeUserAttachment({
    id: '2', name: '照片.jpg', size: 10, url: 'https://b/x.jpg', kind: 'image', localUrl: 'blob:x',
  })
  assert.equal(imageAttachment.isImage, true)
  assert.equal(imageAttachment.localUrl, 'blob:x')
})

// ─── 图片解析 ───────────────────────────────────────────────────────────

test('resolveOfficeImages 兼容嵌套结构与字符串并按 URL 去重', () => {
  const images = resolveOfficeImages([
    'https://cdn.example.com/a.png',
    { picture_message: { picture_url: 'https://cdn.example.com/b.png', title: '图表B' } },
    { url: 'https://cdn.example.com/a.png', title: '重复图' },
    { title: '没有地址的跳过' },
  ])
  assert.deepEqual(images, [
    { url: 'https://cdn.example.com/a.png', title: '图片' },
    { url: 'https://cdn.example.com/b.png', title: '图表B' },
  ])
})


test('streamOfficeChat sends explicit web authorization only when selected', async () => {
  const originalFetch = globalThis.fetch
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const payloads = []
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'test-token' } })
  globalThis.fetch = async (_url, init) => {
    payloads.push(JSON.parse(init.body))
    return new Response('data: {"type":"done","reply":"已审回复","options":[]}\n\n', {
      status: 200, headers: { 'Content-Type': 'text/event-stream' },
    })
  }
  try {
    for (const webSearch of [true, false, undefined]) {
      const result = await streamOfficeChat({ sessionId: 'web-test', text: '问题', messageId: 'm', attachments: [], webSearch }, {})
      assert.equal(result.content, '已审回复')
    }
    assert.equal(payloads[0].web_search, true)
    assert.equal('web_search' in payloads[1], false)
    assert.equal('web_search' in payloads[2], false)
  } finally {
    globalThis.fetch = originalFetch
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
    else delete globalThis.localStorage
  }
})
