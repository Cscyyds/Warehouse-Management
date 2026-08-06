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
    ALLOWED_ATTR: ['class', 'colspan', 'rowspan', 'scope'],
  })
}
