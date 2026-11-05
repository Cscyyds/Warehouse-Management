import type { SensitiveFormBinding } from '../config/sensitivePageBindings'
import { omitSensitivePaths, sensitivePathCovers } from './sensitiveFields.ts'

export interface FormRestrictionState {
  status: string
  fields: Array<{ io_type: string; restriction_type: number; param_name: string }>
}
export interface FormSaveContext {
  originalData: Record<string, any>
  canWrite: (field: string) => boolean
  sanitizeFor: <T>(interfacePath: string, payload: T) => T
  assertCurrent?: () => void
}

export function createSensitiveFormPolicy(
  binding: SensitiveFormBinding,
  states: Map<string, FormRestrictionState>,
  responseHidden: string[] = [],
  missing: string[] = [],
) {
  const endpoints = [...new Set([binding.detail, ...Object.values(binding.fields).flatMap(field => field.input ? [field.input.interfacePath] : [])])]
  const confirmed = endpoints.every(path => states.get(path)?.status === 'ready')
  const covers = (paths: string[], field: string) => paths.some(path => sensitivePathCovers(path, field))
  const hidden = [...responseHidden, ...(states.get(binding.detail)?.fields ?? []).filter(field => field.io_type === 'OUTPUT' && field.restriction_type === 1).map(field => field.param_name)]
  function visible(key: string): boolean {
    const field = binding.fields[key]
    if (!field) return true
    if (covers(hidden, field.output) || missing.includes(key)) return false
    if (field.input && (states.get(field.input.interfacePath)?.fields ?? []).some(item => item.io_type === 'INPUT' && item.restriction_type === 1 && sensitivePathCovers(item.param_name, field.input!.param))) return false
    return !field.dependsOn?.some(dep => !visible(dep))
  }
  function editable(key: string): boolean {
    const field = binding.fields[key]
    if (!field) return true
    if (!confirmed || !visible(key)) return false
    return !field.input || !(states.get(field.input.interfacePath)?.fields ?? []).some(item => item.io_type === 'INPUT' && sensitivePathCovers(item.param_name, field.input!.param))
  }
  return {
    confirmed, visible, editable,
    hasRestrictions: responseHidden.length > 0 || endpoints.some(path => (states.get(path)?.fields.length ?? 0) > 0),
    hiddenKeys: Object.entries(binding.fields).flatMap(([key, field]) => !visible(key) ? [key, field.output] : []),
    sanitizeDraft: <T>(data: T): T => omitSensitivePaths(data, Object.keys(binding.fields).filter(key => !editable(key))),
    sanitizeFor: <T>(path: string, payload: T): T => {
      if (!confirmed) throw new Error('字段权限状态未确认，请重新加载后保存')
      const restricted = (states.get(path)?.fields ?? []).filter(item => item.io_type === 'INPUT').map(item => item.param_name)
      const outputBlocked = Object.entries(binding.fields).flatMap(([key, field]) => field.input?.interfacePath === path && !editable(key) ? [field.input.param] : [])
      return omitSensitivePaths(payload, [...restricted, ...outputBlocked])
    },
    canMutateRelation: (key: string) => !binding.relations?.[key] || editable(binding.relations[key]),
  }
}

/** 缺键只记录实际返回的行；空数组不意味着某个价格字段受限。 */
export function missingFormFields(data: Record<string, any>, binding: SensitiveFormBinding): string[] {
  return Object.keys(binding.fields).filter(path => {
    const [root, child] = path.split('[].')
    if (child) return !Array.isArray(data[root]) || data[root].some((row: any) => !Object.hasOwn(row, child))
    return !Object.hasOwn(data, path)
  })
}
