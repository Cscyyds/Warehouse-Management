import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: false,
  typographer: false,
})

function safeImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      && !/[\x00-\x1f]/.test(value)
  } catch { return false }
}

// Some Agent exports escape the image delimiters as ]\(https\://...\).
// An inline rule keeps code examples untouched and also works during streaming.
markdown.inline.ruler.before('image', 'agent_escaped_image', (state, silent) => {
  const start = state.pos
  const head = /^!\[((?:\\.|[^\]\\])*)\]\\\(/.exec(state.src.slice(start))
  if (!head) return false
  const bodyStart = start + head[0].length
  let end = bodyStart, depth = 1, angle = false
  while (end < state.posMax && depth) {
    const slash = state.src[end] === '\\'
    const ch = state.src[end + (slash ? 1 : 0)]
    if (ch === '<') angle = true
    else if (ch === '>') angle = false
    else if (!angle) {
      if (ch === '(') depth++
      else if (ch === ')') depth--
    }
    end += slash ? 2 : 1
  }
  if (depth) return false
  const inner = state.src.slice(bodyStart, end - (state.src[end - 2] === '\\' ? 2 : 1))
    .trim().replace(/\\([\\:<>()[\]])/g, '$1')
  const url = inner.startsWith('<') && inner.includes('>') ? inner.slice(1, inner.indexOf('>')) : inner
  if (!safeImageUrl(url)) return false
  if (state.src[end] === '\\' && /^(?:\r?\n|\s*$)/.test(state.src.slice(end + 1))) end++
  if (!silent) {
    const token = state.push('image', 'img', 0)
    token.attrs = [['src', url], ['alt', head[1].replace(/\\([\\\[\]])/g, '$1')]]
    token.children = []
    const child = new state.Token('text', '', 0)
    child.content = String(token.attrGet('alt') || '')
    token.children.push(child)
  }
  state.pos = end
  return true
})

const renderImage = markdown.renderer.rules.image!
markdown.renderer.rules.image = (tokens, index, options, env, self) => {
  if (!safeImageUrl(String(tokens[index].attrGet('src') || ''))) return ''
  tokens[index].attrSet('loading', 'lazy')
  return renderImage(tokens, index, options, env, self)
}

// Keep wide WMS result tables inside the assistant message instead of widening
// the floating panel. Raw HTML is disabled, so this class can only originate
// from the renderer itself.
markdown.renderer.rules.table_open = () => '<div class="markdown-table-scroll"><table>\n'
markdown.renderer.rules.table_close = () => '</table></div>\n'

markdown.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  const token = tokens[index]
  try {
    const url = new URL(String(token.attrGet('href') || ''))
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      token.attrs = []
    } else {
      token.attrSet('href', url.href)
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noopener noreferrer')
    }
  } catch { token.attrs = [] }
  return self.renderToken(tokens, index, options)
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line)
}

function isTableDelimiter(line: string): boolean {
  const cells = line.trim().slice(1, -1).split('|').map((cell) => cell.trim())
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

/**
 * Models commonly put a table immediately after a bullet without a blank line.
 * Markdown then treats every pipe row as list text. Isolate only valid table
 * blocks (header + delimiter) so markdown-it can render semantic table markup.
 */
export function normalizeAgentMarkdownTables(content: string): string {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const output: string[] = []

  for (let index = 0; index < lines.length;) {
    if (!isTableRow(lines[index])) {
      output.push(lines[index])
      index += 1
      continue
    }

    let end = index
    while (end < lines.length && isTableRow(lines[end])) end += 1
    const block = lines.slice(index, end)
    if (block.length < 2 || !isTableDelimiter(block[1])) {
      output.push(...block)
      index = end
      continue
    }

    if (output.length && output.at(-1)?.trim()) output.push('')
    output.push(...block.map((line) => line.trim()))
    if (end < lines.length && lines[end].trim()) output.push('')
    index = end
  }

  return output.join('\n')
}

const allowedTags = [
  'img',
  'a',
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
  return markdown.render(normalizeAgentMarkdownTables(content))
}

export function renderAgentMarkdown(content: string): string {
  return DOMPurify.sanitize(renderMarkdownToHtml(content), {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: ['class', 'colspan', 'rowspan', 'scope', 'href', 'target', 'rel', 'src', 'alt', 'title', 'loading'],
  })
}
