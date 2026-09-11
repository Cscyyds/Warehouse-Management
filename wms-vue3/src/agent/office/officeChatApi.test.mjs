import assert from 'node:assert/strict'
import test from 'node:test'
import { applyOfficeAlbumPrefix, normalizeHistoryMessage, normalizeSession, parseSseEvent, stripOfficeAlbumPrefix } from './officeChatApi.ts'
import { parseOfficeOrderQuestion } from './officeQuestionFormatter.ts'

test('parseSseEvent parses Coze proxy events and joins multiline data', () => {
  assert.deepEqual(
    parseSseEvent('id: 17\nevent: thinking\ndata: {"content":"正在查询",\ndata: "node_title":"查询"}'),
    {
      id: '17',
      event: 'thinking',
      data: { content: '正在查询', node_title: '查询' },
    },
  )
})

test('parseSseEvent ignores empty blocks and normalizes event names', () => {
  assert.equal(parseSseEvent('  \n  '), null)
  assert.equal(parseSseEvent('event: Done\ndata: {}')?.event, 'done')
})

test('parseOfficeOrderQuestion extracts the prompt and JSON choices', () => {
  const result = parseOfficeOrderQuestion([
    '需要展开哪一张的商品明细？回复订单号或序号即可。',
    '====',
    '["1.查看 SO202608140004｜T801D电动巴士门等 2 项｜应收 588,784.86元","12.展示全部订单信息"]',
    '- 1.查看 SO202608140004｜T801D电动巴士门等 2 项｜应收 588,784.86元',
    '- 12.展示全部订单信息',
  ].join('\n'))

  assert.deepEqual(result, {
    kind: 'order-detail',
    prompt: '需要展开哪一张的商品明细？回复订单号或序号即可。',
    options: [
      { label: '1.查看 SO202608140004｜T801D电动巴士门等 2 项｜应收 588,784.86元' },
      { label: '12.展示全部订单信息' },
    ],
  })
})

test('parseOfficeOrderQuestion supports the complete-detail wording from history', () => {
  const result = parseOfficeOrderQuestion([
    '这几张订单中，您想展开哪一张的完整商品明细？回复订单号或序号即可。',
    '====',
    '["1.查看 SO202607220002｜12202060新款60W智能超薄恒压电源等 2 项｜应收 565.00元","5.展示全部订单信息","6.不查看完整订单详情"]',
    '- 1.查看 SO202607220002｜12202060新款60W智能超薄恒压电源等 2 项｜应收 565.00元',
  ].join('\n'))

  assert.equal(result?.kind, 'order-detail')
  assert.equal(result?.prompt, '这几张订单中，您想展开哪一张的完整商品明细？回复订单号或序号即可。')
  assert.equal(result?.options.length, 3)
})

test('parseOfficeOrderQuestion leaves other question formats untouched', () => {
  assert.equal(parseOfficeOrderQuestion('请选择处理方式\n====\n["1.确认","2.取消"]'), null)
  assert.equal(parseOfficeOrderQuestion('需要展开哪一张的商品明细？回复订单号或序号即可。\n====\n不是 JSON'), null)
})

test('stripOfficeAlbumPrefix removes the album-mode prefix like the miniprogram', () => {
  assert.equal(stripOfficeAlbumPrefix('[查图册]:A1001 灯带'), 'A1001 灯带')
  assert.equal(stripOfficeAlbumPrefix('[查图册]：全角冒号'), '全角冒号')
  assert.equal(stripOfficeAlbumPrefix('[查图册] : 带空格'), '带空格')
  assert.equal(stripOfficeAlbumPrefix('查图册不带方括号'), '查图册不带方括号')
  assert.equal(stripOfficeAlbumPrefix('前面有[查图册]:不剥离'), '前面有[查图册]:不剥离')
  assert.equal(stripOfficeAlbumPrefix(''), '')
  assert.equal(stripOfficeAlbumPrefix(null), '')
})

test('applyOfficeAlbumPrefix prepends the album-mode prefix like the miniprogram', () => {
  assert.equal(applyOfficeAlbumPrefix('A1001 灯带'), '[查图册]: A1001 灯带')
  // 已带前缀不重复叠加
  assert.equal(applyOfficeAlbumPrefix('[查图册]:A1001 灯带'), '[查图册]:A1001 灯带')
  assert.equal(applyOfficeAlbumPrefix('[查图册]: A1001 灯带'), '[查图册]: A1001 灯带')
  // 首尾空白被 trim
  assert.equal(applyOfficeAlbumPrefix('  恒压电源  '), '[查图册]: 恒压电源')
  // 空文本原样返回
  assert.equal(applyOfficeAlbumPrefix(''), '')
  assert.equal(applyOfficeAlbumPrefix(null), '')
  // 与 strip 往返一致：拼前缀发后端、剥离后回到原文
  assert.equal(stripOfficeAlbumPrefix(applyOfficeAlbumPrefix('T801D电动巴士门')), 'T801D电动巴士门')
})

test('normalizeSession strips the album prefix from title and preview', () => {
  const session = normalizeSession({
    id: 42,
    title: '[查图册]:T801D电动巴士门',
    last_message_preview: '[查图册]:恒压电源',
  })
  assert.equal(session.title, 'T801D电动巴士门')
  assert.equal(session.preview, '恒压电源')

  const fallback = normalizeSession({ session_id: 's1' })
  assert.equal(fallback.title, '新会话')
})

test('normalizeHistoryMessage strips the album prefix only from user messages', () => {
  const userMessage = normalizeHistoryMessage(
    { id: 'm1', role: 'user', content: '[查图册]:A1001 灯带', created_at: '2026-09-11T10:00:00Z' },
    's1',
    0,
  )
  assert.equal(userMessage.content, 'A1001 灯带')

  const assistantMessage = normalizeHistoryMessage(
    { id: 'm2', role: 'assistant', content: '[查图册]:不是用户消息，保持原样', created_at: '2026-09-11T10:00:01Z' },
    's1',
    1,
  )
  assert.equal(assistantMessage.content, '[查图册]:不是用户消息，保持原样')
})
