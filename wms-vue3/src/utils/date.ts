export function isTableDateField(field?: string): boolean {
  if (!field) return false
  return /(?:^|_)(date|time|at)$/i.test(field) || /(Date|Time|At)$/i.test(field)
}

export function formatTableDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}-${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:${String(value.getSeconds()).padStart(2, '0')}`
  }

  const raw = String(value).trim()
  if (!raw) return '-'

  // datetime: 2026-07-14T16:27:12 or 2026-07-14 16:27:12
  const dtMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{2}:\d{2}:\d{2})/)
  if (dtMatch) {
    return `${dtMatch[1]}-${dtMatch[2].padStart(2, '0')}-${dtMatch[3].padStart(2, '0')}-${dtMatch[4]}`
  }

  // date only: 2026-07-14
  const directMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (directMatch) {
    return `${directMatch[1]}-${directMatch[2].padStart(2, '0')}-${directMatch[3].padStart(2, '0')}`
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}-${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}:${String(parsed.getSeconds()).padStart(2, '0')}`
  }

  return raw
}
