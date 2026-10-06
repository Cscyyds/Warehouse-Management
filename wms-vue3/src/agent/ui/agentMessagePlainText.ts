/**
 * 把助手消息的 Markdown 原文转成"可直接粘贴"的纯文本。
 *
 * 背景：WMS小助手的回复大量是订单/库存表格，复制原始 Markdown 会把
 * `**加粗**`、表格管道符 `|`、井号标题一起带进微信/钉钉/Excel 里，
 * 排版全乱。这里统一降级为纯文本，其中表格按制表符分隔（粘进 Excel 自动分列）。
 */

const TABLE_ROW = /^\s*\|.*\|\s*$/

function isTableDelimiter(line: string): boolean {
  const cells = line.trim().slice(1, -1).split('|').map(cell => cell.trim())
  return cells.length > 0 && cells.every(cell => /^:?-{2,}:?$/.test(cell))
}

/** 去掉行内 Markdown 标记，保留可读文本。 */
function stripInlineMarks(text: string): string {
  return text
    // [文字](链接) / ![图片](链接) → 文字
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 行内代码
    .replace(/`([^`]*)`/g, '$1')
    // 加粗 / 斜线 / 删除线
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/~~([^~]+)~~/g, '$1')
    // 转义残留
    .replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, '$1')
}

function convertTableRow(line: string): string {
  const trimmed = line.trim()
  const body = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed
  const cells = (body.endsWith('|') ? body.slice(0, -1) : body).split('|')
  return cells.map(cell => stripInlineMarks(cell.trim())).join('\t')
}

function convertLine(line: string): string {
  let text = line
  // 标题：只留文字
  text = text.replace(/^\s{0,3}#{1,6}\s+/, '')
  // 引用块
  text = text.replace(/^\s{0,3}>\s?/, '')
  // 无序/有序列表：统一成 "- "，避免 "1." 与纯文本语义混淆
  text = text.replace(/^(\s*)[-*+]\s+/, '$1- ')
  return stripInlineMarks(text)
}

/**
 * 表格块（含表头 + 分隔行 + 数据行）整体转换：整块转成制表符分隔的连续行，
 * 分隔行直接丢弃——只留空行会让粘进 Excel 后中间多出一行空白。
 */
function convertTableBlock(lines: string[]): string[] {
  const rows = isTableDelimiter(lines[1] ?? '')
    ? lines.filter((_, index) => index !== 1)
    : lines
  return rows.map(convertTableRow)
}

export function toPlainText(content: string): string {
  if (!content) return ''
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const output: string[] = []
  let inFence = false

  for (let index = 0; index < lines.length;) {
    const line = lines[index]

    // 代码块内容原样保留（含缩进），但去掉围栏标记本身
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      index += 1
      continue
    }
    if (inFence) {
      output.push(line)
      index += 1
      continue
    }

    // 表格块：吃掉所有连续的管道行
    if (TABLE_ROW.test(line)) {
      let end = index
      while (end < lines.length && TABLE_ROW.test(lines[end])) end += 1
      output.push(...convertTableBlock(lines.slice(index, end)))
      index = end
      continue
    }

    // 分隔线：转为空行，避免把 `---` 复制出去
    if (/^\s{0,3}([-*_])\s*(\1\s*){2,}$/.test(line)) {
      output.push('')
      index += 1
      continue
    }

    output.push(convertLine(line))
    index += 1
  }

  return output
    .map(line => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 组装办公模式用户消息的复制文本：正文 + 附件清单。
 * 附件只带名称（本地 File 与服务端 URL 都不适合直接粘出去）。
 */
export function buildOfficeUserCopyText(content: string, attachments: { name: string }[]): string {
  const body = toPlainText(content)
  const names = attachments.map(item => item.name).filter(Boolean)
  if (!names.length) return body
  const lines = names.map(name => `[附件] ${name}`)
  return body ? `${body}\n${lines.join('\n')}` : lines.join('\n')
}