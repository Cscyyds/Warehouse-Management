import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { adminLogin } from '@/api/auth'
import { ApiError } from '@/api/http'
import type { LoginData } from '@/types/platform'

const AUTH_KEY = 'nuomi-wms-admin-auth'

interface StoredAuth {
  accessToken: string
  operatorId: string
  operatorName: string
  loginName: string
  adminType: 'SYSTEM' | 'NORMAL' | null
  expiresAt: string
}

function restore(): StoredAuth | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    return raw ? JSON.parse(raw) as StoredAuth : null
  } catch {
    sessionStorage.removeItem(AUTH_KEY)
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<StoredAuth | null>(restore())
  const isAuthenticated = computed(() => Boolean(session.value?.accessToken))
  const isSystemAdmin = computed(() => session.value?.adminType === 'SYSTEM')

  function persist(data: LoginData) {
    const next: StoredAuth = {
      accessToken: data.access_token,
      operatorId: data.operator_id,
      operatorName: data.operator_name,
      loginName: data.login_name,
      adminType: data.admin_type,
      expiresAt: data.expires_at,
    }
    session.value = next
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(next))
  }

  async function login(account: string, password: string) {
    const data = await adminLogin(account, password)
    if (data.admin_type !== 'SYSTEM') {
      throw new ApiError('此控制台仅允许系统管理员登录', 403)
    }
    persist(data)
  }

  function logout() {
    session.value = null
    sessionStorage.removeItem(AUTH_KEY)
  }

  return { session, isAuthenticated, isSystemAdmin, login, logout }
})
