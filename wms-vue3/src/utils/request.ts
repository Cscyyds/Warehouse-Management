import axios, { type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000
})

export interface ApiResponse<T = unknown> {
  code?: number
  success?: boolean
  message: string
  data: T
  timestamp?: string
}

service.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

service.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResponse
    // 后端实际格式: { success: true/false, message: "...", data: ... }
    if (res.success === false || (res.code !== undefined && res.code !== 200)) {
      const errMsg = typeof res.data === 'string' ? res.data : res.message
      ElMessage.error(errMsg || '请求失败')
      return Promise.reject(new Error(errMsg))
    }
    return response.data
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
    } else {
      const resData = error.response?.data as ApiResponse | undefined
      const errMsg = typeof resData?.data === 'string' ? resData.data : resData?.message
      ElMessage.error(errMsg || error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export function get<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  return service.get(url, { params, ...config }) as unknown as Promise<ApiResponse<T>>
}

export function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  return service.post(url, data, config) as unknown as Promise<ApiResponse<T>>
}

export function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  return service.put(url, data, config) as unknown as Promise<ApiResponse<T>>
}

export function del<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  return service.delete(url, config) as unknown as Promise<ApiResponse<T>>
}

/** 将对象转为 x-www-form-urlencoded（URLSearchParams），过滤 undefined/null/空串 */
export function toFormData(data: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value))
    }
  })
  return params
}

/** 将对象转为 multipart/form-data（FormData），过滤 undefined/null/空串，支持文件数组 */
export function toMultipart(data: Record<string, unknown>): FormData {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) {
      // 文件数组：images[]
      value.forEach((file) => formData.append(key, file))
    } else if (value instanceof File) {
      formData.append(key, value)
    } else {
      formData.append(key, String(value))
    }
  })
  return formData
}
