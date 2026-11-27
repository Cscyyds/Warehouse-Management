/**
 * PDF 预览「越更新越小」回归测试
 *
 * 故障现象：每次实时更新（勾选变化 → PDF 重新生成）后，预览里的 PDF 页面
 * 都比上一次小一点，连续几次后明显缩水。
 *
 * 根因：给 iframe 的 PDF URL 同时传了 `zoom=100` 与 `view=FitH`。
 * 二者互斥，`zoom` 会覆盖适配模式，使页面按 A4 原始尺寸（96dpi 下约 794px）
 * 渲染；容器宽度不够时浏览器再自动缩一次塞进来。每次重载都重算一遍，
 * 于是视觉上逐次变小。
 *
 * 正确做法：只用 `view=FitH` —— 语义是「页面宽度铺满容器」，
 * 是确定性状态，重载多少次结果都一致。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const DIALOG = new URL('../components/PdfExportDialog.vue', import.meta.url)
const source = readFileSync(DIALOG, 'utf8')

/** 从 SFC 源码里抽出 iframeSrc 函数体，避免复制实现导致测的不是真代码 */
function extractIframeSrcBody() {
  const start = source.indexOf('function iframeSrc(')
  assert.ok(start >= 0, 'PdfExportDialog 里应存在 iframeSrc 函数')
  // 从函数起点找到第一个「只含一个 }」的行作为结束
  const lines = source.slice(start).split('\n')
  const body = []
  for (const line of lines) {
    body.push(line)
    if (line.trim() === '}') break
  }
  return body.join('\n')
}

/** 用真实实现构造 URL（把 URL 参数换成占位，行为等价） */
function buildUrlFromImplementation() {
  const body = extractIframeSrcBody()
  const fn = new Function('url', `${body}\n return iframeSrc(url)`.replace(
    /function iframeSrc\(url: string\): string \{/,
    'function iframeSrc(url) {',
  ))
  return fn
}

test('iframeSrc 不得包含 zoom 参数（与 FitH 互斥，是缩小的根因）', () => {
  const body = extractIframeSrcBody()
  assert.ok(!/zoom=/.test(body), '不得再出现 zoom= 参数：它会覆盖 FitH 导致页面按原始尺寸渲染并逐次缩小')
})

test('iframeSrc 必须使用 view=FitH（页面宽度铺满容器）', () => {
  const body = extractIframeSrcBody()
  assert.ok(/view=FitH/.test(body), '应使用 view=FitH 让页面适配容器宽度')
})

test('iframeSrc 对 data URL 追加 FitH 且保留原始内容', () => {
  const iframeSrc = buildUrlFromImplementation()
  const out = iframeSrc('data:application/pdf;base64,AAAA')
  assert.ok(out.startsWith('data:application/pdf;base64,AAAA'), '必须保留原始 URL')
  assert.ok(out.endsWith('#view=FitH'), '应以 #view=FitH 结尾')
})

test('iframeSrc 对已有 hash 的 URL 不产生两个 #', () => {
  const iframeSrc = buildUrlFromImplementation()
  const out = iframeSrc('blob:http://x/abc#foo=1')
  assert.equal((out.match(/#/g) || []).length, 1, '只应有一个 #')
})

test('iframeSrc 对空串原样返回（无内容时不拼参数）', () => {
  const iframeSrc = buildUrlFromImplementation()
  assert.equal(iframeSrc(''), '')
})

test('同一 URL 反复转换结果稳定（确定性参数才可能不缩放）', () => {
  const iframeSrc = buildUrlFromImplementation()
  const url = 'data:application/pdf;base64,BBB'
  const first = iframeSrc(url)
  for (let i = 0; i < 5; i++) {
    assert.equal(iframeSrc(url), first, '同一输入必须得到同一输出，否则每次重载视图会跳变')
  }
})

test('iframe 样式预留滚动条槽位（避免宽度抖动导致 FitH 重算）', () => {
  assert.ok(
    /scrollbar-gutter:\s*stable/.test(source),
    'iframe 应设置 scrollbar-gutter: stable，防止页数变化时滚动条出现/消失改变可用宽度',
  )
})
