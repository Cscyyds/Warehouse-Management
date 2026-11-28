import test from 'node:test'
import assert from 'node:assert/strict'
import { injectCitations } from './answerFormat.ts'

test('合法编号替换为可点击 sup', () => {
  const out = injectCitations('距门顶 120 毫米[1]，承重 35kg[2][3]。', 3)
  assert.match(out, /<sup class="dp-cite" data-cite="1" role="button" tabindex="0"[^>]*>1<\/sup>/)
  assert.match(out, /data-cite="2"/)
  assert.match(out, /data-cite="3"/)
})

test('越界编号原样保留', () => {
  const text = '引用[0]与[4]以及[99]'
  assert.equal(injectCitations(text, 3), text)
})

test('不破坏 Markdown 链接语法', () => {
  const text = '见[1](https://example.com)与[2][ref]以及[3]: 定义'
  assert.equal(injectCitations(text, 3), text)
})

test('无资料时不注入', () => {
  assert.equal(injectCitations('结论[1]', 0), '结论[1]')
  assert.equal(injectCitations('', 3), '')
})

test('多位编号与中文标点共存', () => {
  const out = injectCitations('第一点[10]。第二点[11]？', 12)
  assert.match(out, /data-cite="10"/)
  assert.match(out, /data-cite="11"/)
  assert.ok(!out.includes('[10]'))
})