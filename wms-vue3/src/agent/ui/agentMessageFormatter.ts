export interface AgentTextSegment {
  text: string
  bold: boolean
}

export interface AgentMessageBlock {
  type: 'paragraph' | 'ordered-list' | 'unordered-list'
  items: AgentTextSegment[][]
}

export function parseAgentTextSegments(value: string): AgentTextSegment[] {
  const segments: AgentTextSegment[] = []
  const pattern = /\*\*(.+?)\*\*/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value))) {
    if (match.index > cursor) segments.push({ text: value.slice(cursor, match.index), bold: false })
    segments.push({ text: match[1], bold: true })
    cursor = match.index + match[0].length
  }
  if (cursor < value.length) segments.push({ text: value.slice(cursor), bold: false })
  return segments.length ? segments : [{ text: value, bold: false }]
}

export function formatAgentMessage(content: string): AgentMessageBlock[] {
  const blocks: AgentMessageBlock[] = []
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  let index = 0

  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) {
      index += 1
      continue
    }

    const orderedMatch = line.match(/^\d+[.)、]\s*(.+)$/)
    const unorderedMatch = line.match(/^[-•]\s+(.+)$/)
    if (orderedMatch || unorderedMatch) {
      const type = orderedMatch ? 'ordered-list' : 'unordered-list'
      const items: AgentTextSegment[][] = []
      while (index < lines.length) {
        const candidate = lines[index].trim()
        const match = type === 'ordered-list'
          ? candidate.match(/^\d+[.)、]\s*(.+)$/)
          : candidate.match(/^[-•]\s+(.+)$/)
        if (!match) break
        items.push(parseAgentTextSegments(match[1]))
        index += 1
      }
      blocks.push({ type, items })
      continue
    }

    blocks.push({ type: 'paragraph', items: [parseAgentTextSegments(line)] })
    index += 1
  }

  return blocks
}

/**
 * 时间线卡片的单行摘要：结果 Bubble 会经 Markdown 渲染，而时间线 detail 按
 * 纯文本展示——不剥离表格管道、加粗星号就会以原文泄漏（历史踩坑）。
 */
export function toTimelineDetail(value: string, maxLength = 80): string {
  const plain = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !/^\s*\|/.test(line))
    .join(' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[`*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= maxLength) return plain
  return `${plain.slice(0, maxLength)}…`
}
