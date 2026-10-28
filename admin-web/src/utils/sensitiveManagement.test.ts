import { describe, expect, it } from 'vitest'
import { fieldUpdateDelta, mappingUpdateDelta, searchParams, validMappingPath, validParameterPath } from './sensitiveManagement'
import type { SensitiveFieldDefinition, SensitiveInterfaceMapping } from '@/types/sensitiveFields'
describe('平台敏感管理提交契约', () => {
  it('派生转原始显式清空依赖，0和空说明不被省略', () => {
    const original = { field_id: 'f', field_label: '字段', is_derived: true, derived_from_field_ids: ['x'], description: '旧说明', sort_no: 1, status: 1 } as SensitiveFieldDefinition
    expect(fieldUpdateDelta(original, { field_label: '字段', is_derived: 0, derived_from_field_ids: [], description: '', sort_no: 0, status: 0 })).toEqual({ field_id: 'f', is_derived: 0, derived_from_field_ids: [], description: '', sort_no: 0, status: 0 })
  })
  it('映射差量只发送实际修改项', () => {
    const row = { mapping_id: 'm', field_id: 'f', interface_path: '/a', interface_name: '接口', io_type: 'OUTPUT', param_name: 'items[].price', sort_no: 0, status: 1 } as SensitiveInterfaceMapping
    expect(mappingUpdateDelta(row, { ...row, status: 0 })).toEqual({ mapping_id: 'm', status: 0 })
  })
  it('搜索白名单以JSON字符串提交，不把多字段条件误称为AND', () => {
    expect(searchParams('field_label', ' 价格 ', ['field_label'])).toEqual({ search_field: '["field_label"]', search_value: '{"field_label":"价格"}' })
    expect(() => searchParams('status', '0', ['field_label'])).toThrow()
  })
  it('路径只接受内部路由和正确的字段路径，不接受带前缀、域名或查询串的路径', () => {
    expect(validMappingPath('/tenant-products/detail')).toBe(true)
    for (const path of ['/api/v1/tenant-products/detail', 'https://site/api', '/a?q=1', '/a b']) expect(validMappingPath(path)).toBe(false)
    for (const path of ['price', 'products[].sale_prices[].price', '[].amount']) expect(validParameterPath(path)).toBe(true)
    expect(validParameterPath('products[0].price')).toBe(false)
  })
})
