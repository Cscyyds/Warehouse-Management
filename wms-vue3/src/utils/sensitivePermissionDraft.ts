import type { RoleSensitivePermission, RestrictionType } from '../api/modules/sensitiveField'

export function validateRolePermissions(value: unknown): RoleSensitivePermission[] {
  if (!Array.isArray(value)) throw new Error('角色限制配置不完整，请重新加载')
  const seen = new Set<string>()
  return value.map(item => {
    if (!item || typeof item.field_id !== 'string' || !item.field_id || ![1, 2].includes(item.restriction_type) || seen.has(item.field_id)) {
      throw new Error('角色限制配置格式异常，请重新加载核对')
    }
    seen.add(item.field_id)
    return { ...item }
  })
}

export function permissionFingerprint(permissions: RoleSensitivePermission[]): string {
  return JSON.stringify(permissions.map(({ field_id, restriction_type }) => [field_id, restriction_type])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))))
}

export function permissionsFromDraft(draft: Record<string, 0 | RestrictionType>): RoleSensitivePermission[] {
  return Object.entries(draft).flatMap(([field_id, type]) => type === 1 || type === 2 ? [{ field_id, restriction_type: type }] : [])
}

export function permissionChanges(before: RoleSensitivePermission[], after: RoleSensitivePermission[]) {
  const old = new Map(before.map(item => [item.field_id, item.restriction_type]))
  const next = new Map(after.map(item => [item.field_id, item.restriction_type]))
  const added = after.filter(item => !old.has(item.field_id))
  const changed = after.filter(item => old.has(item.field_id) && old.get(item.field_id) !== item.restriction_type)
  const removed = before.filter(item => !next.has(item.field_id))
  const unhidden = before.filter(item => item.restriction_type === 1 && next.get(item.field_id) !== 1)
  const newlyHidden = after.filter(item => item.restriction_type === 1 && old.get(item.field_id) !== 1)
  return { added, changed, removed, unhidden, newlyHidden, count: added.length + changed.length + removed.length }
}
