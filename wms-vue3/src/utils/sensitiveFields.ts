export interface SensitivePathSegment { key: string | null; array: boolean }

export function parseSensitivePath(path: string): SensitivePathSegment[] {
  if (!path) throw new Error('字段路径不能为空')
  return path.split('.').map((part, index) => {
    if (part === '[]' && index === 0) return { key: null, array: true }
    const match = /^([^.[\]]+)(\[\])?$/.exec(part)
    if (!match || ['__proto__', 'prototype', 'constructor'].includes(match[1])) throw new Error(`不支持的字段路径：${path}`)
    return { key: match[1], array: !!match[2] }
  })
}

/** 精确按路径段匹配；限制父对象时，其子字段也受限。 */
export function sensitivePathCovers(restricted: string, field: string): boolean {
  const a = parseSensitivePath(restricted), b = parseSensitivePath(field)
  return a.length <= b.length && a.every((part, i) => part.key === b[i].key && part.array === b[i].array)
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue)
  // File/Blob/Date 等沿用对象身份，路径删除只处理普通 payload 对象。
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]))
}

/** 返回独立草稿，省略受限字段，保留数组行和主键，不把隐藏项推断为删行。 */
export function omitSensitivePaths<T>(payload: T, paths: string[]): T {
  const result = cloneValue(payload) as T
  clearSensitivePaths(result, paths)
  return result
}

/** 仅用于当前表单内存：清理敏感值时保留明细行身份，避免使已打开的选项弹窗引用失效。 */
export function clearSensitivePaths(payload: unknown, paths: string[]): void {
  function omit(value: unknown, parts: SensitivePathSegment[], index: number): void {
    const part = parts[index]
    if (!value || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    if (part.key !== null && !Object.prototype.hasOwnProperty.call(record, part.key)) return
    const next = part.key === null ? value : record[part.key]
    if (index === parts.length - 1) {
      if (part.key !== null) delete record[part.key]
      return
    }
    if (part.array) {
      if (Array.isArray(next)) next.forEach(item => omit(item, parts, index + 1))
    } else omit(next, parts, index + 1)
  }
  for (const path of paths) omit(payload, parseSensitivePath(path), 0)
}

export interface ResponseSensitiveRestriction { field_id: string; field_label: string; param_names: string[] }
export function responseSensitiveRestrictions(data: unknown): ResponseSensitiveRestriction[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  const raw = (data as Record<string, unknown>).restricted_sensitive_fields
  if (!Array.isArray(raw)) return []
  return raw.flatMap(item => {
    if (!item || typeof item !== 'object' || typeof item.field_id !== 'string' || !Array.isArray(item.param_names)) return []
    return [{ field_id: item.field_id, field_label: typeof item.field_label === 'string' ? item.field_label : '', param_names: item.param_names.filter((path: unknown) => typeof path === 'string') }]
  })
}
