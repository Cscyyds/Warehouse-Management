/** 后端业务异常、FastAPI 原生异常和导入错误的可展示形式。 */
export interface NormalizedApiError {
  message: string
  blockedFields: string[]
  validationErrors: string[]
  raw: unknown
}

const MAX_ERRORS = 3
const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
const asText = (value: unknown): string => typeof value === 'string' ? value.trim() : ''

/** 文本和服务器返回值均不作为可信 HTML。 */
export function errorTextToSafeHtml(message: string): string {
  return message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '<br/>')
}

function errorLines(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const lines = value.slice(0, MAX_ERRORS).map(item => {
    const row = asRecord(item)
    if (!row) return asText(item)
    if (asText(row.reason)) {
      const sheet = asText(row.sheet) ? `工作表「${asText(row.sheet)}」` : ''
      const number = row.row == null ? '' : `第${String(row.row)}行`
      const name = asText(row.name) ? `「${asText(row.name)}」` : ''
      return `${sheet}${number}${name}：${asText(row.reason)}`
    }
    if (asText(row.detail)) return asText(row.detail)
    if (asText(row.msg)) {
      const loc = Array.isArray(row.loc) ? row.loc.filter(key => key !== 'body').join('.') : ''
      return loc ? `${loc}：${asText(row.msg)}` : asText(row.msg)
    }
    const messages = Array.isArray(row.errors) ? row.errors.map(asText).filter(Boolean).join('；') : ''
    return asText(row.label) && messages ? `${asText(row.label)}：${messages}` : messages
  }).filter(Boolean)
  if (lines.length && value.length > MAX_ERRORS) lines.push(`…等 ${value.length} 条错误`)
  return lines
}

export function normalizeApiError(raw: unknown, fallback = '请求失败'): NormalizedApiError {
  const outer = asRecord(raw)
  const data = asRecord(outer?.data)
  const detail = asRecord(outer?.detail) || asRecord(data?.detail)
  const body = (data && (data.message || data.blocked_fields || data.errors || typeof data.detail === 'string'))
    ? data : detail || data || outer
  const blocked = Array.isArray(body?.blocked_fields) ? body.blocked_fields : []
  const blockedFields = [...new Set(blocked.map(item => {
    const field = asRecord(item)
    return asText(field?.field_label) || (typeof item === 'string' ? item.trim() : '')
  }).filter(Boolean))]

  let errors = errorLines(Array.isArray(outer?.data) ? outer.data : outer?.detail)
  const rawErrors = body?.errors
  if (!errors.length && Array.isArray(rawErrors)) errors = errorLines(rawErrors)
  if (!errors.length && asRecord(rawErrors)) {
    const entries: unknown[] = []
    for (const [sheet, list] of Object.entries(rawErrors as Record<string, unknown>)) {
      if (Array.isArray(list)) entries.push(...list.map(item => ({ sheet, ...asRecord(item) })))
    }
    errors = errorLines(entries)
  }

  let primary = asText(body?.message) || asText(body?.detail) || asText(outer?.data)
    || asText(outer?.detail) || asText(outer?.message) || asText(raw) || fallback
  // 旧接口把操作上下文放在 message、具体原因放在 data.detail。
  if (body === data && !asText(data?.message) && asText(data?.detail) && asText(outer?.message)
      && asText(outer?.message) !== asText(data?.detail)) {
    primary = `${asText(outer?.message)}，${asText(data?.detail)}`
  }
  let message = errors.length ? errors.join('\n') : primary
  if (blockedFields.length) message += `：${blockedFields.join('、')}`
  return { message, blockedFields, validationErrors: errors, raw }
}

/** 文件接口的错误体可能仍是 JSON Blob；非 JSON HTML 不作为用户文案。 */
export async function normalizeBlobError(blob: Blob, fallback = '请求失败'): Promise<NormalizedApiError> {
  let text = ''
  try { text = (await blob.slice(0, 1024 * 1024).text()).trim() } catch { return normalizeApiError(null, fallback) }
  if (!text) return normalizeApiError(null, fallback)
  try {
    return normalizeApiError(JSON.parse(text), fallback)
  } catch {
    return /^\s*</.test(text) ? normalizeApiError(null, fallback) : normalizeApiError(text.slice(0, 120), fallback)
  }
}
