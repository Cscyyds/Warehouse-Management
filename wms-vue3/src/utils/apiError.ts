import { safeErrorText, sanitizeDiagnosticPayload, serverErrorStatus } from './serverErrorDisplay.ts'

/** 后端业务异常、FastAPI 原生异常和导入错误的可展示形式。 */
export interface NormalizedApiError {
  message: string
  blockedFields: string[]
  validationErrors: string[]
  raw: unknown
}

const MAX_ERRORS = 5
const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
const asText = (value: unknown): string => typeof value === 'string' ? value.trim() : ''

/** 文本和服务器返回值均不作为可信 HTML。 */
export function errorTextToSafeHtml(message: string): string {
  return safeErrorText(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '<br/>')
}

function errorLines(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const lines = value.map(item => {
    const row = asRecord(item)
    if (!row) return asText(item)
    if (asText(row.reason)) {
      const sheet = asText(row.sheet) ? `工作表「${asText(row.sheet)}」` : ''
      const number = row.row == null ? '' : `第${String(row.row)}行`
      const name = asText(row.name) ? `「${asText(row.name)}」` : ''
      const field = asText(row.field_label) || asText(row.field)
      const prefix = `${sheet}${number}${name}` || field
      return prefix ? `${prefix}：${asText(row.reason)}` : asText(row.reason)
    }
    if (asText(row.detail)) return asText(row.detail)
    if (asText(row.msg)) {
      const loc = Array.isArray(row.loc) ? row.loc.filter(key => key !== 'body').join('.') : ''
      return loc ? `${loc}：${asText(row.msg)}` : asText(row.msg)
    }
    const messages = Array.isArray(row.errors) ? row.errors.map(asText).filter(Boolean).join('；') : ''
    return asText(row.label) && messages ? `${asText(row.label)}：${messages}` : messages
  }).filter(Boolean)
  return lines
}

// Only inspect error-bearing keys, including entries beyond the display limit.
function diagnosticStatus(value: unknown): string | undefined {
  if (typeof value === 'string') return serverErrorStatus(value)
  if (Array.isArray(value)) {
    for (const item of value) { const status = diagnosticStatus(item); if (status) return status }
    return undefined
  }
  const row = asRecord(value)
  if (!row) return undefined
  for (const key of ['data', 'detail', 'details', 'errors', 'error', 'message', 'msg', 'reason', 'traceback', 'stack', 'stacktrace']) {
    if (key in row) { const status = diagnosticStatus(row[key]); if (status) return status }
  }
  return undefined
}

function relatedDetails(data: Record<string, unknown> | undefined): string[] {
  if (!data) return []
  const details: string[] = []
  if (Array.isArray(data.using_user)) {
    for (const item of data.using_user) {
      const name = asText(asRecord(item)?.user_name)
      if (name) details.push(`使用员工：${name}`)
    }
  }
  const supplierFields: Array<[string, string]> = [
    ['missing_supplier_ids', '未绑定或缺少价格的供应商'],
    ['invalid_supplier_ids', '不可用供应商'],
    ['duplicate_supplier_ids', '重复绑定的供应商'],
  ]
  for (const [key, label] of supplierFields) {
    if (Array.isArray(data[key])) for (const id of data[key] as unknown[]) {
      const text = asText(id)
      if (text) details.push(`${label}：${text}`)
    }
  }
  return details
}

export function normalizeApiError(raw: unknown, fallback = '请求失败'): NormalizedApiError {
  const display = sanitizeDiagnosticPayload(raw)
  const status = diagnosticStatus(display)
  if (status) return { message: `Status code\n${status}`, blockedFields: [], validationErrors: [], raw }
  const outer = asRecord(display)
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
  if (!errors.length && Array.isArray(data?.data)) errors = errorLines(data.data)
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
    || asText(outer?.detail) || asText(outer?.message) || asText(display) || safeErrorText(fallback)
  // Business errors often put the operation in message and the actionable reason in data.
  if (asText(outer?.data) && asText(outer?.message) && asText(outer?.data) !== asText(outer?.message)) {
    primary = `${asText(outer?.message)}\n${asText(outer?.data)}`
  }
  // 旧接口把操作上下文放在 message、具体原因放在 data.detail。
  if (body === data && !asText(data?.message) && asText(data?.detail) && asText(outer?.message)
      && asText(outer?.message) !== asText(data?.detail)) {
    primary = `${asText(outer?.message)}，${asText(data?.detail)}`
  }
  const nestedDetail = asText(data?.message) && asText(data?.detail) && asText(data?.message) !== asText(data?.detail)
    ? [asText(data?.detail)] : []
  const related = relatedDetails(data)
  if (related.length && typeof data?.using_user_total === 'number') primary += `（涉及 ${data.using_user_total} 人）`
  const details = [...nestedDetail, ...errors, ...related].slice(0, MAX_ERRORS)
  if (details.length && (asText(outer?.message) || asText(body?.message))) {
    const context = asText(outer?.message)
    if (context && !primary.includes(context)) primary = `${context}，${primary}`
  }
  const hasContext = Boolean(asText(outer?.message) || asText(body?.message) || asText(body?.detail) || asText(outer?.detail))
  let message = details.length ? (hasContext ? [primary, ...details] : details).join('\n') : primary
  if (blockedFields.length) message += `：${blockedFields.join('、')}`
  message = safeErrorText(message)
  return { message, blockedFields, validationErrors: details, raw }
}

/** 文件接口的错误体可能仍是 JSON Blob；非 JSON HTML 不作为用户文案。 */
export async function normalizeBlobError(blob: Blob, fallback = '请求失败'): Promise<NormalizedApiError> {
  let text = ''
  try { text = (await blob.slice(0, 1024 * 1024).text()).trim() } catch { return normalizeApiError(null, fallback) }
  if (!text) return normalizeApiError(null, fallback)
  try {
    return normalizeApiError(JSON.parse(text), fallback)
  } catch {
    const safe = safeErrorText(text)
    if (safe !== text) return normalizeApiError(safe, fallback)
    return /^\s*</.test(text) ? normalizeApiError(null, fallback) : normalizeApiError(text.slice(0, 120), fallback)
  }
}
