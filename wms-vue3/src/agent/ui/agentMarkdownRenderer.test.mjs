import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMarkdownToHtml } from './agentMarkdownRenderer.ts'

test('renders standard, angle and Agent-escaped image links with clean URLs', () => {
  const url = 'https://nuomiwms.gz.bcebos.com/knowledge/OFFICIAL_PUBLIC/products/op_63d87e4aca554b44b196feb71fc70690/assets/0ebaead2fe8f1e755a6d0dafbb67eb34ca7a970142ce9255680519e2c2cf3d32.jpg'
  const escaped = url.replace(':', '\\:')
  const variants = [`![尺寸图](${url})`, `![尺寸图](<${url}>)`,
    `![尺寸图]\\(${escaped}\\)\\`, `![尺寸图]\\(\\<${escaped}>)`,
    `![尺寸图]\\(\\<${escaped}\\>\\)`]
  for (const value of variants) {
    const html = renderMarkdownToHtml(value)
    assert.ok(html.includes(`src="${url}"`), html)
    assert.match(html, /alt="尺寸图"/)
    assert.match(html, /loading="lazy"/)
  }
  assert.equal((renderMarkdownToHtml(variants.join('\n')).match(/<img /g) || []).length, variants.length)
  assert.doesNotMatch(renderMarkdownToHtml('`' + variants[2] + '`'), /<img /)
  assert.doesNotMatch(renderMarkdownToHtml('```\n' + variants[2] + '\n```'), /<img /)
  assert.doesNotMatch(renderMarkdownToHtml(`![partial]\\(\\<${escaped}`), /<img /)
  for (const bad of ['javascript:alert(1)', 'data:image/png;base64,eA==', 'https://user:pass@example.com/a.jpg', '/internal.jpg']) {
    assert.doesNotMatch(renderMarkdownToHtml(`![bad](${bad})`), /<img /)
  }
})

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


test('web sources render only safe external links with isolated new windows', () => {
  const html = renderMarkdownToHtml('[来源](https://example.com/report?a=1&b=2)')
  assert.match(html, /href="https:\/\/example.com\/report/)
  assert.match(html, /target="_blank"/)
  assert.match(html, /rel="noopener noreferrer"/)
  for (const url of ['javascript:alert%281%29', 'data:text/html,x', 'https://user:password@example.com', '/internal']) {
    assert.doesNotMatch(renderMarkdownToHtml(`[来源](${url})`), /href=/)
  }
})
