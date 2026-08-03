import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: false,
  typographer: false,
})

// Keep wide WMS result tables inside the assistant message instead of widening
// the floating panel. Raw HTML is disabled, so this class can only originate
// from the renderer itself.
markdown.renderer.rules.table_open = () => '<div class="markdown-table-scroll"><table>\n'
markdown.renderer.rules.table_close = () => '</table></div>\n'

const allowedTags = [
  'div',
  'p',
  'br',
  'strong',
  'em',
  's',
  'del',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'pre',
  'code',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
]

export function renderMarkdownToHtml(content: string): string {
  return markdown.render(content)
}

export function renderAgentMarkdown(content: string): string {
  return DOMPurify.sanitize(renderMarkdownToHtml(content), {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: ['class', 'colspan', 'rowspan', 'scope'],
  })
}
