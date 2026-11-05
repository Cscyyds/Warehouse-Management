import axios, { AxiosError } from 'axios'
import type { ApiResponse, FormValue } from '@/types/api'
import { normalizeApiError, normalizeBlobError } from '@/utils/apiError'

const AUTH_KEY = 'zhixing-wms-admin-auth'

export class ApiError extends Error {
  status: number
  details: unknown
  blockedFields: string[] = []
  validationErrors: string[] = []

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
  const raw = localStorage.getItem(AUTH_KEY)
  if (raw) {
    try {
      const token = JSON.parse(raw).accessToken as string | undefined
      if (token) config.headers.Authorization = `Bearer ${token}`
    } catch {
      localStorage.removeItem(AUTH_KEY)
    }
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status ?? 0
    const body = error.response?.data
    if (status === 401) {
      localStorage.removeItem(AUTH_KEY)
      const base = import.meta.env.BASE_URL
      if (!location.pathname.endsWith('/login')) {
        const pathWithoutBase = location.pathname.startsWith(base)
          ? location.pathname.slice(base.length - 1)
          : location.pathname
        const redirect = encodeURIComponent(`${pathWithoutBase}${location.search}`)
        location.assign(`${base}login?redirect=${redirect}`)
      }
    }
    const normalized = body instanceof Blob ? await normalizeBlobError(body, error.message || '请求失败') : normalizeApiError(body, error.message || '请求失败')
    const apiError = new ApiError(normalized.message, status, body instanceof Blob ? normalized.raw : body?.data)
    apiError.blockedFields = normalized.blockedFields
    apiError.validationErrors = normalized.validationErrors
    throw apiError
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
  const ok = response.success !== false && (response.success === true || response.code === 200)
  if (!ok) {
    const normalized = normalizeApiError(response, '操作失败')
    const error = new ApiError(normalized.message, 200, response.data)
    error.blockedFields = normalized.blockedFields
    error.validationErrors = normalized.validationErrors
    throw error
  }
  return response.data as T
}

export async function postForm<T>(url: string, payload: object): Promise<T> {
  const { data } = await http.post<ApiResponse<T>>(url, toUrlEncoded(payload), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return unwrap(data)
}

/** 新敏感管理接口按后端 Form() 契约提交；数组只序列化为JSON字符串。 */
export async function postFormData<T>(url: string, payload: Record<string, unknown>): Promise<T> {
  const form = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue
    form.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value))
  }
  return postMultipart<T>(url, form)
}

/**
 * multipart/form-data 文件上传（axios 收到 FormData 自动设 multipart boundary，
 * 鉴权拦截器照常注入 token）。上传可能远慢于普通请求，timeout 由调用方放宽。
 */
export async function postMultipart<T>(url: string, form: FormData, timeoutMs = 120_000): Promise<T> {
  const { data } = await http.post<ApiResponse<T>>(url, form, { timeout: timeoutMs })
  return unwrap(data)
}

export async function getData<T>(url: string, params?: object): Promise<T> {
  const { data } = await http.get<ApiResponse<T>>(url, { params })
  return unwrap(data)
}
