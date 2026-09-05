import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSseEvent } from './officeChatApi.ts'

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
