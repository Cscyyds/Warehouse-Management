import axios, { AxiosError } from 'axios'
import type { ApiResponse, FormValue } from '@/types/api'

const AUTH_KEY = 'zhixing-wms-admin-auth'

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status = 0, details: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 20_000,
})

http.interceptors.request.use((config) => {
  const raw = sessionStorage.getItem(AUTH_KEY)
  if (raw) {
    try {
      const token = JSON.parse(raw).accessToken as string | undefined
      if (token) config.headers.Authorization = `Bearer ${token}`
    } catch {
      sessionStorage.removeItem(AUTH_KEY)
    }
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status ?? 0
    const body = error.response?.data
    if (status === 401) {
      sessionStorage.removeItem(AUTH_KEY)
      const base = import.meta.env.BASE_URL
      if (!location.pathname.endsWith('/login')) {
        const pathWithoutBase = location.pathname.startsWith(base)
          ? location.pathname.slice(base.length - 1)
          : location.pathname
        const redirect = encodeURIComponent(`${pathWithoutBase}${location.search}`)
        location.assign(`${base}login?redirect=${redirect}`)
      }
    }
    const detail = typeof body?.data === 'string'
      ? body.data
      : body?.data && typeof body.data === 'object' && 'detail' in body.data
        ? String((body.data as { detail: unknown }).detail)
        : ''
    throw new ApiError(detail || body?.message || error.message || '请求失败', status, body?.data)
  },
)

export function toUrlEncoded(payload: object): URLSearchParams {
  const params = new URLSearchParams()
  Object.entries(payload as Record<string, FormValue>).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    params.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value))
  })
  return params
}

export function unwrap<T>(response: ApiResponse<T>): T {
  const ok = response.success === true || response.code === 200
  if (!ok) {
    throw new ApiError(response.message || '操作失败', 200, response.data)
  }
  return response.data as T
}

export async function postForm<T>(url: string, payload: object): Promise<T> {
  const { data } = await http.post<ApiResponse<T>>(url, toUrlEncoded(payload), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return unwrap(data)
}

export async function getData<T>(url: string, params?: object): Promise<T> {
  const { data } = await http.get<ApiResponse<T>>(url, { params })
  return unwrap(data)
}
