const labels: Record<number, string> = {
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout', 505: 'HTTP Version Not Supported',
}

/** Recognize diagnostic output, not ordinary mentions of errors in business text. */
export function serverErrorStatus(value: string, status?: number): string | undefined {
  const canonical = value.match(/\bStatus code\s*[:：]?\s*([45]\d{2})\b/i)
  const internal = /\b500\s+Internal Server Error\b|^Internal Server Error$|^Request failed with status code 500$/i.test(value.trim())
  const diagnostic = /\bTraceback\s*\(most recent call last\)\s*:|\bFile\s+["'][^"'\r\n]+["'],\s+line\s+\d+|(?:^|\n)\s*at\s+[^\r\n]+(?:\.(?:js|ts|java|cs):\d+|:\d+:\d+\)?\s*$)|\b(?:sqlalchemy\.exc|asyncmy\.errors|pymysql\.err|psycopg\d?\.errors|sqlite3)\.\w*(?:Error|Exception)|\[(?:SQL|parameters)\s*:/im.test(value)
  const serverStatus = typeof status === 'number' && status >= 500 && status <= 599
  if (!serverStatus && !canonical && !internal && !diagnostic) return undefined
  const code = typeof status === 'number' && status >= 400 && status <= 599 ? status : canonical ? Number(canonical[1]) : 500
  return `${code} ${labels[code] || (code >= 500 ? 'Server Error' : 'Request Error')}`
}

export function safeErrorText(value: string, status?: number): string {
  const summary = serverErrorStatus(value, status)
  return summary ? `Status code\n${summary}` : value
}

const errorFields = new Set([
  'message', 'msg', 'error', 'errors', 'errorname', 'errormessage', 'errmsg', 'errortext', 'errordetail', 'errordetails',
  'errordescription', 'errorreason', 'lasterror', 'failure', 'failures', 'failuremessage', 'failurereason', 'failedreason',
  'warning', 'warnings', 'notice', 'notices', 'reason', 'reasons', 'detail', 'details', 'hint', 'statusmessage', 'validationerrors', 'traceback', 'stack', 'stacktrace', 'exception',
])

/** Copy only changed branches. Document text/content, identifiers and normal business errors stay intact. */
export function sanitizeDiagnosticPayload<T>(value: T, status?: number, diagnosticField = true): T {
  if (typeof value === 'string') return (diagnosticField ? safeErrorText(value, status) : value) as T
  if (Array.isArray(value)) {
    const items = value.map(item => sanitizeDiagnosticPayload(item, status, diagnosticField))
    return (items.some((item, i) => item !== value[i]) ? items : value) as T
  }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value
  const source = value as Record<string, unknown>
  const ownStatus = [source.statusCode, source.status_code, source.http_status, source.status,
    source.success === false ? source.code : undefined].find(code => typeof code === 'number' && code >= 400 && code <= 599)
  const effectiveStatus = typeof ownStatus === 'number' ? ownStatus : status
  let result = source
  for (const [key, item] of Object.entries(source)) {
    const normalizedKey = key.replace(/[^a-z]/gi, '').toLowerCase()
    const isError = errorFields.has(normalizedKey)
      || /(?:errors?|failures?|failed|exceptions?|tracebacks?|stacktrace)(?:message|messages|reason|reasons|detail|details|description|desc|text|trace|stack)?$/.test(normalizedKey)
      || (effectiveStatus !== undefined && effectiveStatus >= 400 && ['title', 'description', 'body'].includes(key))
      || (key === 'data' && (source.success === false || (effectiveStatus !== undefined && effectiveStatus >= 400)))
    const safe = sanitizeDiagnosticPayload(item, effectiveStatus, isError)
    if (safe !== item) {
      if (result === source) result = { ...source }
      result[key] = safe
    }
  }
  return result as T
}

/** Keep body streaming and binary downloads intact; simplify only when callers read JSON/error text. */
const wrappedResponses = new WeakSet<Response>()
function wrapErrorResponse(response: Response): Response {
  if (!response.clone || !response.headers?.get || wrappedResponses.has(response)) return response
  const json = /\bjson\b/i.test(response.headers.get('content-type') || '')
  if (!json && response.ok) return response
  const readJson = response.json.bind(response)
  const readText = response.text.bind(response)
  const clone = response.clone.bind(response)
  Object.defineProperties(response, {
    json: { value: async () => {
      try { return sanitizeDiagnosticPayload(await readJson(), response.status) }
      catch (error) {
        // Native JSON parser errors may echo a fragment of the response body.
        if (error instanceof SyntaxError) throw new SyntaxError(safeErrorText(response.status >= 400 ? `Status code\n${response.status}` : '响应内容不是有效 JSON', response.status))
        throw error
      }
    }, configurable: true },
    text: { value: async () => {
      const original = await readText()
      if (json) {
        try {
          const body = JSON.parse(original)
          const safe = sanitizeDiagnosticPayload(body, response.status)
          return safe === body ? original : JSON.stringify(safe)
        } catch { /* A non-JSON error page may still contain diagnostics. */ }
      }
      return safeErrorText(original, response.status)
    }, configurable: true },
    clone: { value: () => wrapErrorResponse(clone()), configurable: true },
  })
  wrappedResponses.add(response)
  return response
}

export async function sanitizeErrorResponse(response: Response): Promise<Response> {
  return wrapErrorResponse(response)
}

export async function fetchWithSafeErrors(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return sanitizeErrorResponse(await fetch(input, init))
}
