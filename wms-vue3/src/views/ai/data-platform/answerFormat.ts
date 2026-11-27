/**
 * 问答回答的 Markdown 渲染与引用编号注入。
 *
 * 模型按后端约定输出 [1] / [2][3] 形式的来源编号；这里把合法编号替换为
 * 可点击的 <sup class="dp-cite" data-cite="n">，再经 markdown-it 渲染、
 * DOMPurify 消毒后交给 v-html。编号超出资料数量时原样保留，避免误伤
 * Markdown 链接语法（[1](url)、[1][ref]、[1]: 定义）。
 */
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({ html: true, linkify: false, breaks: true })

/** 把 [n] 引用替换为可交互 sup 标记；n 必须在 1..sourceCount 内。 */
export function injectCitations(text: string, sourceCount: number): string {
  if (!text || sourceCount <= 0) return text
  return text.replace(/\[(\d{1,2})\](?![\(:]|\[(?!\d))/g, (whole, num: string) => {
    const n = Number(num)
    if (n < 1 || n > sourceCount) return whole
    return `<sup class="dp-cite" data-cite="${n}" role="button" tabindex="0" aria-label="查看来源 ${n}">${n}</sup>`
  })
}

/** 渲染为消毒后的 HTML（保留 sup / data-cite / class / role / tabindex）。 */
export function renderAnswer(text: string, sourceCount: number): string {
  if (!text) return ''
  return DOMPurify.sanitize(md.render(injectCitations(text, sourceCount)), { USE_PROFILES: { html: true } })
}