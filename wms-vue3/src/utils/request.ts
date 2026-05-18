import axios, { type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000
})

export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
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
    if (res.code !== 200) {
      ElMessage.error(res.msg || '请求失败')
      return Promise.reject(new Error(res.msg))
    }
    return response.data
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
    } else {
      ElMessage.error(error.message || '网络错误')
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
