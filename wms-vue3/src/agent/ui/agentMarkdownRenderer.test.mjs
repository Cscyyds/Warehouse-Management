import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMarkdownToHtml } from './agentMarkdownRenderer.ts'

test('renders a Markdown result table as semantic table markup', () => {
  const html = renderMarkdownToHtml(`| 序号 | 品号 | 产品名称 |
| --- | --- | --- |
| 1 | P2026070001 | 奥利奥巧克力饼干 |`)

  assert.match(html, /<div class="markdown-table-scroll"><table>/)
  assert.match(html, /<thead>/)
  assert.match(html, /<th>品号<\/th>/)
  assert.match(html, /<td>P2026070001<\/td>/)
})

test('does not render raw HTML supplied by the model', () => {
  const html = renderMarkdownToHtml('<script>alert("xss")</script>')

  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
})

test('renders an indented Markdown table after a bullet as a real table', () => {
  const html = renderMarkdownToHtml(`- 总客户数：33 条
- 前 3 条客户示例：
| 客户名称 | 负责人 | 联系电话 | 客户类型 |
| --- | --- | --- | --- |
| 广州抖音电商 | 董总 | 13900000028 | **电商客户** |`)

  assert.match(html, /<div class="markdown-table-scroll"><table>/)
  assert.match(html, /<th>客户名称<\/th>/)
  assert.doesNotMatch(html, /\| --- \|/)
})

test('renders an order table with surrounding paragraphs', () => {
  const html = renderMarkdownToHtml(`广东诺米名下 11 张订单，都是罗卓盛下的单。

5 张**未发送仓库**，2 张**待出库**，4 张**已出库**。

| 订单号 | 下单时间 | 应收金额 | 仓库状态 | 结算 |
|---|---|---|---|---|
| SO202608140004 | 8月14日 14:49 | 588,784.86 元 | 未发送仓库 | 月结 |
| SO202608270001 | 8月27日 14:11 | 400,200.00 元 | 待出库 | 现结 |

想看某一张的商品明细，告诉我订单号就可以。`)

  assert.match(html, /<p>广东诺米名下 11 张订单/) 
  assert.match(html, /<div class="markdown-table-scroll"><table>/)
  assert.match(html, /<th>订单号<\/th>/)
  assert.match(html, /<td>SO202608270001<\/td>/)
  assert.match(html, /想看某一张的商品明细/)
})
