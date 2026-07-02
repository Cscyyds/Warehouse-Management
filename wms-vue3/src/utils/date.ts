export function isTableDateField(field?: string): boolean {
  if (!field) return false
  return /(?:^|_)(date|time|at)$/i.test(field) || /(Date|Time|At)$/i.test(field)
}

export function formatTableDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`
  }

  const raw = String(value).trim()
  if (!raw) return '-'

  const directMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (directMatch) {
    return `${Number(directMatch[1])}-${Number(directMatch[2])}-${Number(directMatch[3])}`
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${parsed.getMonth() + 1}-${parsed.getDate()}`
  }

  return raw
}
