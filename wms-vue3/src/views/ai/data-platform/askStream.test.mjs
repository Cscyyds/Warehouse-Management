import test from 'node:test'
import assert from 'node:assert/strict'
import { createAskStreamState, feedAskSse, finishAskStream } from './askStream.ts'

const sourcesEvent = `event: sources\ndata: {"hits":[{"id":"c1","document_id":"d1","text":"上合页距门顶 120 毫米","index":"idx","score":0.9,"origin":{"page":3},"document_name":"安装手册.pdf"}],"model":"qwen3.8-flash"}\n\n`
const delta = text => `event: delta\ndata: ${JSON.stringify({ content: text })}\n\n`
const doneEvent = `event: done\ndata: {"answer":"终答[1]","model":"qwen3.8-flash","finish_reason":"stop","usage":{"total_tokens":10},"no_evidence":false}\n\n`

test('累计 delta 并回调全文', () => {
  const state = createAskStreamState()
  const seen = []
  feedAskSse(state, sourcesEvent + delta('上合页') + delta('距门顶 120 毫米[1]'), {
    onSources: hits => seen.push(hits.length),
    onDelta: answer => seen.push(answer),
  })
  assert.equal(state.answer, '上合页距门顶 120 毫米[1]')
  assert.equal(state.sources.length, 1)
  assert.equal(state.sources[0].document_name, '安装手册.pdf')
  assert.deepEqual(seen, [1, '上合页', '上合页距门顶 120 毫米[1]'])
})

test('done.answer 是权威终答', () => {
  const state = createAskStreamState()
  feedAskSse(state, delta('草稿') + doneEvent)
  const result = finishAskStream(state)
  assert.equal(result.answer, '终答[1]')
  assert.equal(result.model, 'qwen3.8-flash')
  assert.equal(result.noEvidence, false)
  assert.deepEqual(result.usage, { total_tokens: 10 })
})

test('事件跨 chunk 拆分仍能解析', () => {
  const state = createAskStreamState()
  const whole = sourcesEvent + delta('你好') + doneEvent
  for (let i = 0; i < whole.length; i += 7) feedAskSse(state, whole.slice(i, i + 7))
  const result = finishAskStream(state)
  assert.equal(result.sources.length, 1)
  assert.equal(result.answer, '终答[1]')
})

test('CRLF 与无 event 行的 data 块', () => {
  const state = createAskStreamState()
  feedAskSse(state, sourcesEvent.replace(/\n/g, '\r\n'))
  assert.equal(state.sources.length, 1)
  feedAskSse(state, 'data: {"content":"x"}\n\n')
  assert.equal(state.answer, '')
})

test('no_evidence 终答', () => {
  const state = createAskStreamState()
  feedAskSse(state, 'event: sources\ndata: {"hits":[],"model":"m"}\n\n'
    + 'event: done\ndata: {"answer":"没有找到","model":"m","no_evidence":true}\n\n')
  const result = finishAskStream(state)
  assert.equal(result.noEvidence, true)
  assert.equal(result.sources.length, 0)
})

test('error 事件抛出后端消息', () => {
  const state = createAskStreamState()
  feedAskSse(state, delta('部分') + 'event: error\ndata: {"message":"模型超时"}\n\n')
  assert.throws(() => finishAskStream(state), /模型超时/)
})

test('未收到 done 视为连接中断', () => {
  const state = createAskStreamState()
  feedAskSse(state, delta('部分'))
  assert.throws(() => finishAskStream(state), /连接中断/)
})

test('收尾时处理 buffer 中残留的完整事件', () => {
  const state = createAskStreamState()
  feedAskSse(state, sourcesEvent + delta('ok') + doneEvent.trimEnd())
  const result = finishAskStream(state)
  assert.equal(result.answer, '终答[1]')
})

test('坏 JSON 与未知事件被忽略', () => {
  const state = createAskStreamState()
  feedAskSse(state, 'event: delta\ndata: {bad json}\n\n' + 'event: ping\ndata: {}\n\n' + delta('ok') + doneEvent)
  assert.equal(finishAskStream(state).answer, '终答[1]')
})