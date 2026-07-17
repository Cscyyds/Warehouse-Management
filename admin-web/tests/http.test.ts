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
