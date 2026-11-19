import { describe, expect, it } from 'vitest'
import { ApiError, toUrlEncoded, unwrap } from '@/api/http'

describe('toUrlEncoded', () => {
  it('保留零值和空字符串，并将数组编码为 JSON', () => {
    const result = toUrlEncoded({
      status: 0,
      remark: '',
      permission_id: ['PERM_1', 'PERM_2'],
      ignored: undefined,
    })

    expect(result.get('status')).toBe('0')
    expect(result.get('remark')).toBe('')
    expect(result.get('permission_id')).toBe('["PERM_1","PERM_2"]')
    expect(result.has('ignored')).toBe(false)
  })
})

describe('toUrlEncoded · 天心 formal_start_at 语义（platform-tianxin/sync-config/update）', () => {
  it('设置：日期时间字符串原样保留', () => {
    const result = toUrlEncoded({ tenant_id: 't1', module_code: 'PURCHASE_SALES', formal_start_at: '2026-11-18 00:00:00' })
    expect(result.get('formal_start_at')).toBe('2026-11-18 00:00:00')
  })

  it('清空：空串必须保留（后端据此关闭归档），不能被丢弃', () => {
    const result = toUrlEncoded({ tenant_id: 't1', module_code: 'BORROW', formal_start_at: '' })
    expect(result.has('formal_start_at')).toBe(true)
    expect(result.get('formal_start_at')).toBe('')
  })

  it('不改：undefined 被丢弃（后端「未做任何修改」）', () => {
    const result = toUrlEncoded({ tenant_id: 't1', module_code: 'PRODUCTION' })
    expect(result.has('formal_start_at')).toBe(false)
  })

  it('null 同样被丢弃 —— 故清空绝不能用 null（会误变成「不改」）', () => {
    const result = toUrlEncoded({ tenant_id: 't1', module_code: 'PRODUCTION', formal_start_at: null })
    expect(result.has('formal_start_at')).toBe(false)
  })

  it('dry_run / confirm 布尔值序列化为 "true"/"false" 字符串', () => {
    const on = toUrlEncoded({ dry_run: true, confirm: true })
    expect(on.get('dry_run')).toBe('true')
    expect(on.get('confirm')).toBe('true')
    const off = toUrlEncoded({ dry_run: false, confirm: false })
    expect(off.get('dry_run')).toBe('false')
    expect(off.get('confirm')).toBe('false')
  })
})

describe('unwrap', () => {
  it('支持后端当前 success 响应格式', () => {
    expect(unwrap({ success: true, message: '成功', data: { id: 1 } })).toEqual({ id: 1 })
  })

  it('兼容文档中的 code 响应格式', () => {
    expect(unwrap({ code: 200, message: '成功', data: 'ok' })).toBe('ok')
  })

  it('允许成功响应返回 null', () => {
    expect(unwrap({ success: true, message: '删除成功', data: null })).toBeNull()
  })

  it('失败响应抛出业务错误', () => {
    expect(() => unwrap({ success: false, message: '操作失败', data: '原因' })).toThrow(ApiError)
  })
})
