import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAgentMessage } from './agentMessageFormatter.ts'

test('formats a WMS query result into paragraphs and ordered result items', () => {
  const blocks = formatAgentMessage(`已为您搜索到客户"广州抖音电商"的销售订单，共 3 条：

1. **SO202607210005** — 结算方式：现结，销售金额 3,800.00 元
2. **SO202607160001** — 结算方式：月结，销售金额 60,000.00 元
3. **SO2026070028** — 结算方式：现结，销售金额 76.00 元

如需操作，请告诉我。`)

  assert.deepEqual(blocks.map((block) => block.type), [
    'paragraph',
    'ordered-list',
    'paragraph',
  ])
  assert.equal(blocks[1].items.length, 3)
  assert.deepEqual(blocks[1].items[0][0], { text: 'SO202607210005', bold: true })
  assert.equal(blocks[2].items[0][0].text, '如需操作，请告诉我。')
})
