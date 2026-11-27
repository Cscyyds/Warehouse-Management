import { describe, it, expect, vi } from 'vitest'
import { http, postFormData, unwrap } from './http'
import { AxiosError } from 'axios'

describe('平台请求错误和表单契约', () => {
  it('保留FastAPI detail中的版本和关闭阻断详情', async () => {
    const old = http.defaults.adapter
    const detail = { error_code: 'SIMPLE_MODE_CLOSE_BLOCKED', blockers: [{ error_code: 'SIMPLE_STOCK_REMAINS', stock_qty: '0.0001' }] }
    http.defaults.adapter = async config => {
      throw new AxiosError('Conflict', 'ERR_BAD_REQUEST', config, null, { status: 409, statusText: 'Conflict', headers: {}, config, data: { detail } })
    }
    try {
      await expect(http.get('/platform-tenants/simple-mode/update')).rejects.toMatchObject({ status: 409, details: detail })
    } finally { http.defaults.adapter = old }
  })
  it('业务失败不能被code=200覆盖，保留具体字段限制', () => {
    expect(() => unwrap({ success: false, code: 200, message: '操作失败', data: { message: '禁止修改', blocked_fields: [{ field_label: '成本' }] } })).toThrow('禁止修改：成本')
  })
  it('FormData保留0、空串和显式空数组，省略undefined', async () => {
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: { success: true, message: '成功', data: {} } })
    try {
      await postFormData('/platform-sensitive-fields/update', { field_id: 'f', status: 0, description: '', derived_from_field_ids: [], omitted: undefined })
      const form = post.mock.calls[0][1] as FormData
      expect(form.get('status')).toBe('0')
      expect(form.get('description')).toBe('')
      expect(form.get('derived_from_field_ids')).toBe('[]')
      expect(form.has('omitted')).toBe(false)
    } finally { post.mockRestore() }
  })
})
