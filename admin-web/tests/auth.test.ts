import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { adminLogin } = vi.hoisted(() => ({ adminLogin: vi.fn() }))
vi.mock('@/api/auth', () => ({ adminLogin }))

import { ApiError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const systemLogin = {
  access_token: 'system-token',
  token_type: 'bearer',
  operator_id: 'admin_1',
  operator_name: '系统管理员',
  operator_type: 'ADMIN' as const,
  login_name: 'admin@example.com',
  admin_type: 'SYSTEM' as const,
  expires_at: '2026-12-31T23:59:59',
}

describe('system administrator session', () => {
  beforeEach(() => {
    sessionStorage.clear()
    adminLogin.mockReset()
    setActivePinia(createPinia())
  })

  it('persists a SYSTEM administrator login and can log out', async () => {
    adminLogin.mockResolvedValue(systemLogin)
    const auth = useAuthStore()

    await auth.login('admin@example.com', '123456')

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isSystemAdmin).toBe(true)
    expect(sessionStorage.getItem('nuomi-wms-admin-auth')).toContain('system-token')

    auth.logout()
    expect(auth.isAuthenticated).toBe(false)
    expect(sessionStorage.getItem('nuomi-wms-admin-auth')).toBeNull()
  })

  it('rejects a NORMAL administrator without creating a session', async () => {
    adminLogin.mockResolvedValue({ ...systemLogin, admin_type: 'NORMAL' })
    const auth = useAuthStore()

    await expect(auth.login('normal@example.com', '123456')).rejects.toBeInstanceOf(ApiError)
    expect(auth.isAuthenticated).toBe(false)
    expect(sessionStorage.getItem('nuomi-wms-admin-auth')).toBeNull()
  })
})
