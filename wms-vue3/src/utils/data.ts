/** 数据表格操作列全局统一宽度 */
export const global_opt_width = 210

export function buildSearchParams(map: Record<string, unknown>): { search_field: string; search_value: string } {
  const entries = Object.entries(map).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return { search_field: '[]', search_value: '{}' }

  const searchField = entries.map(([k]) => k)
  const searchValue: Record<string, unknown> = {}
  entries.forEach(([k, v]) => { searchValue[k] = v })
  return { search_field: JSON.stringify(searchField), search_value: JSON.stringify(searchValue) }
}

export function unwrapListData<T = unknown>(
  data: unknown,
  candidates: string[] = []
): { items: T[]; total: number; page: number; page_size: number } {
  let payload: any = data
  if (payload && typeof payload === 'object' && 'data' in payload && 'message' in payload && ('success' in payload || 'code' in payload)) {
    payload = payload.data
  }

  if (payload && typeof payload === 'object' && 'data' in payload && payload.items === undefined && payload.list === undefined && payload.records === undefined) {
    const inner = payload.data
    if (inner && typeof inner === 'object') payload = inner
  }

  const src: any = payload ?? {}

  let items: unknown[] = []
  if (Array.isArray(src)) {
    items = src
  } else if (src && typeof src === 'object') {
    if (Array.isArray(src.items)) items = src.items
    else if (Array.isArray(src.list)) items = src.list
    else if (Array.isArray(src.records)) items = src.records
    else {
      for (const key of candidates) {
        if (Array.isArray(src[key])) {
          items = src[key]
          break
        }
      }
    }
  }

  const normalizeNumber = (v: unknown, fallback: number): number => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
    return fallback
  }

  const total = normalizeNumber(src.total ?? src.count ?? src.total_count ?? src.totalCount, items.length)
  const page = normalizeNumber(src.page ?? src.current_page ?? src.currentPage ?? src.current ?? 1, 1)
  const pageSize = normalizeNumber(src.page_size ?? src.pageSize ?? src.per_page ?? src.perPage ?? src.limit ?? 20, 20)

  return { items: items as T[], total, page, page_size: pageSize }
}

export function safeLoadOptions<T>(fn: () => Promise<T[] | null | undefined> | T[] | null | undefined): () => Promise<T[]> {
  return async () => {
    try {
      const res = await Promise.resolve(fn())
      return Array.isArray(res) ? res : []
    } catch {
      return []
    }
  }
}
