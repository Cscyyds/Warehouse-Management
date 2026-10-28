import { getData, postFormData } from './http'
import type { SensitiveFieldPage, SensitiveMappingPage, SensitiveFieldPayload, SensitiveMappingPayload, SensitiveFieldDefinition } from '@/types/sensitiveFields'

export const FIELD_SEARCH_KEYS = ['field_id', 'field_code', 'field_label', 'description'] as const
export const MAPPING_SEARCH_KEYS = ['field_id', 'interface_path', 'interface_name', 'param_name'] as const
export function querySensitiveFields(params: object) { return getData<SensitiveFieldPage>('/platform-sensitive-fields/query', params) }
export function searchSensitiveFields(params: object) { return getData<SensitiveFieldPage>('/platform-sensitive-fields/search', params) }
export function createSensitiveField(payload: SensitiveFieldPayload) { return postFormData<{ field_id: string }>('/platform-sensitive-fields/create', payload as Record<string, unknown>) }
export function updateSensitiveField(payload: SensitiveFieldPayload) { return postFormData<{ field_id: string; updated_fields: string[] }>('/platform-sensitive-fields/update', payload as Record<string, unknown>) }
export function deleteSensitiveField(fieldId: string) { return postFormData<unknown>('/platform-sensitive-fields/delete', { field_id: fieldId }) }
export function querySensitiveMappings(params: object) { return getData<SensitiveMappingPage>('/platform-sensitive-interface-fields/query', params) }
export function searchSensitiveMappings(params: object) { return getData<SensitiveMappingPage>('/platform-sensitive-interface-fields/search', params) }
export function createSensitiveMapping(payload: SensitiveMappingPayload) { return postFormData<{ mapping_id: string }>('/platform-sensitive-interface-fields/create', payload as Record<string, unknown>) }
export function updateSensitiveMapping(payload: SensitiveMappingPayload) { return postFormData<unknown>('/platform-sensitive-interface-fields/update', payload as Record<string, unknown>) }
export function deleteSensitiveMapping(mappingId: string) { return postFormData<unknown>('/platform-sensitive-interface-fields/delete', { mapping_id: mappingId }) }

/** 依赖/字段候选按真实分页取全，不能只用当前表格页。 */
export async function allSensitiveFields(): Promise<SensitiveFieldDefinition[]> {
  const session = localStorage.getItem('zhixing-wms-admin-auth')
  const result: SensitiveFieldDefinition[] = []
  for (let page = 1; page <= 100; page++) {
    const response = await querySensitiveFields({ page, page_size: 200 })
    if (session !== localStorage.getItem('zhixing-wms-admin-auth')) throw new Error('登录会话已变化，请重新加载字段')
    if (!Array.isArray(response.fields)) throw new Error('字段候选返回不完整，请重新加载')
    result.push(...response.fields)
    if (result.length >= response.total) {
      const unique = [...new Map(result.map(field => [field.field_id, field])).values()]
      if (unique.length < response.total) throw new Error('字段列表在加载期间已变化，请重新加载候选')
      return unique
    }
    if (!response.fields.length) throw new Error('字段候选未完整加载，暂不能保存依赖关系')
  }
  throw new Error('字段数量超出候选加载范围，请联系管理员核对')
}
