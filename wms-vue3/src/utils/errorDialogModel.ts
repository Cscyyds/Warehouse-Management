import { serverErrorStatus } from './serverErrorDisplay.ts'

/** Only these user-facing values may reach the dialog or clipboard. */
export interface ErrorDialogOptions {
  title?: string
  fields?: string[]
  details?: string[]
  statusCode?: number
}

export interface ErrorDialogContent {
  title: string
  reason: string
  fields: string[]
  details: string[]
}

const LIMIT = 5
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : ''
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const lines = (value: string): string[] => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
const strings = (value: unknown): string[] => Array.isArray(value) ? value.flatMap(item => lines(text(item))) : []

export function buildErrorDialogContent(input: unknown, options: ErrorDialogOptions = {}): ErrorDialogContent {
  const source = record(input)
  // Do not stringify response/config/stack or arbitrary objects.
  const message = text(input) || text(source.reason) || text(source.message) || text(source.detail)
  const messages = lines(message)
  const details = strings(options.details).length ? strings(options.details) : strings(source.validationErrors)
  if (Array.isArray(input)) {
    for (const item of input) {
      const row = record(item)
      const reason = text(item) || text(row.reason) || text(row.msg)
      const field = text(row.field_label) || text(row.field)
        || (Array.isArray(row.loc) ? row.loc.filter(part => typeof part === 'string' && part !== 'body').join('.') : '')
      if (reason) details.push(field ? `${field}：${reason}` : reason)
    }
  }
  const status = options.statusCode ?? source.statusCode ?? record(source.response).status
  const diagnosticText = [text(options.title), message, ...details, ...strings(options.fields), ...strings(source.blockedFields)].join('\n')
  const summary = serverErrorStatus(diagnosticText, typeof status === 'number' ? status : undefined)
  if (summary) return { title: 'Status code', reason: summary, fields: [], details: [] }
  return {
    title: text(options.title) || '操作失败',
    reason: messages[0] || (details.length ? '请检查以下错误信息' : '操作未完成，请稍后重试'),
    fields: (options.fields ? strings(options.fields) : strings(source.blockedFields)).slice(0, LIMIT),
    details: (details.length ? details : messages.slice(1)).slice(0, LIMIT),
  }
}

export function errorDialogCopyText(content: ErrorDialogContent): string {
  return [content.title, content.reason, content.fields.length ? `字段：${content.fields.join('、')}` : '', ...content.details.slice(0, LIMIT)]
    .filter(Boolean).join('\n')
}
