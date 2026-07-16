import { postForm } from './http'
import type { LoginData } from '@/types/platform'

export function adminLogin(account: string, password: string) {
  return postForm<LoginData>('/auth/admin/login', { account, password })
}
