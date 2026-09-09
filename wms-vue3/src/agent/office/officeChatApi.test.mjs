import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSseEvent } from './officeChatApi.ts'
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
