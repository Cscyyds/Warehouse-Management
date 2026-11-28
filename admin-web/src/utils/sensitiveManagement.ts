import type { SensitiveFieldDefinition, SensitiveFieldPayload, SensitiveInterfaceMapping, SensitiveMappingPayload } from '@/types/sensitiveFields'

export function searchParams(key: string, value: string, whitelist: readonly string[]) {
  if (!whitelist.includes(key)) throw new Error('不支持的搜索字段')
  return { search_field: JSON.stringify([key]), search_value: JSON.stringify({ [key]: value.trim() }) }
}
export function fieldUpdateDelta(original: SensitiveFieldDefinition, next: Required<Omit<SensitiveFieldPayload, 'field_id' | 'module' | 'field_code'>>) {
  const payload: SensitiveFieldPayload = { field_id: original.field_id }
  if (next.field_label !== original.field_label) payload.field_label = next.field_label
  if (next.description !== (original.description ?? '')) payload.description = next.description
  if (next.sort_no !== original.sort_no) payload.sort_no = next.sort_no
  if (next.status !== original.status) payload.status = next.status
  if (!!next.is_derived !== original.is_derived) payload.is_derived = next.is_derived
  if (JSON.stringify([...next.derived_from_field_ids].sort()) !== JSON.stringify([...original.derived_from_field_ids].sort()) || (original.is_derived && !next.is_derived)) payload.derived_from_field_ids = next.is_derived ? next.derived_from_field_ids : []
  return payload
}
export function mappingUpdateDelta(original: SensitiveInterfaceMapping, next: SensitiveMappingPayload) {
  const payload: SensitiveMappingPayload = { mapping_id: original.mapping_id }
  for (const key of ['field_id', 'interface_path', 'interface_name', 'io_type', 'param_name', 'sort_no', 'status'] as const) {
    if (next[key] !== undefined && next[key] !== original[key]) Object.assign(payload, { [key]: next[key] })
  }
  return payload
}
export function validMappingPath(path: string): boolean {
  return path.length <= 255 && /^\/(?!api\/v1(?:\/|$))[^\s?#]*$/.test(path) && !path.includes('://')
}
export function validParameterPath(path: string): boolean {
  return /^(?:\[\]\.)?[a-zA-Z_][a-zA-Z0-9_]*(?:\[\])?(?:\.[a-zA-Z_][a-zA-Z0-9_]*(?:\[\])?)*$/.test(path)
}
