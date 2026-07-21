import axios, { type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/',
  timeout: 30000
})

export interface ApiResponse<T = unknown> {
  code?: number
  success?: boolean
  message: string
  data: T
  timestamp?: string
}

type HandledRequestError = Error & { __handledMessage?: boolean }

export type RequestConfig = AxiosRequestConfig & {
  /** 已完成前置操作时，为后续请求错误补充醒目的上下文提示 */
  errorMessagePrefix?: string
}

function prependErrorContext(message: string, config?: RequestConfig): string {
  if (!config?.errorMessagePrefix) return message
  return `<strong style="font-size: 15px; color: var(--el-color-danger);">${config.errorMessagePrefix}</strong><br/>${message}`
}

/** 从后端响应中提取错误消息，优先展示详细校验错误列表 */
function extractErrorMessage(res: ApiResponse): string {
  let errMsg = typeof res.data === 'string' ? res.data : res.message
  if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
    const data = res.data as Record<string, unknown>
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      errMsg = (data.errors as Array<{ label?: string; errors?: string[] }>)
        .map(e => {
          const label = e.label || ''
          const msgs = (e.errors || []).join('；')
          return label ? `${label}：${msgs}` : msgs
        })
        .join('<br/>')
    } else if (typeof data.detail === 'string' && data.detail) {
      // 后端错误详情在 data.detail，与 message 组合展示（如：删除供应商失败，当前仍有产品正在使用该供应商，无法删除）
      errMsg = res.message ? `${res.message}，${data.detail}` : data.detail
    }
  }
  return errMsg
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
      const errMsg = prependErrorContext(extractErrorMessage(res), response.config as RequestConfig)
      ElMessage({ message: errMsg || '请求失败', type: 'error', dangerouslyUseHTMLString: true })
      const handledError: HandledRequestError = new Error(errMsg)
      handledError.__handledMessage = true
      return Promise.reject(handledError)
    }
    return response.data
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
    } else {
      const resData = error.response?.data as ApiResponse | undefined
      let errMsg = typeof resData?.data === 'string' ? resData.data : resData?.message
      if (resData) {
        errMsg = extractErrorMessage(resData)
      }
      errMsg = prependErrorContext(errMsg || error.message || '网络错误', error.config as RequestConfig | undefined)
      ElMessage({ message: errMsg, type: 'error', dangerouslyUseHTMLString: true })
    }
    ;(error as HandledRequestError).__handledMessage = true
    return Promise.reject(error)
  }
)

export function get<T>(url: string, params?: Record<string, unknown>, config?: RequestConfig): Promise<ApiResponse<T>> {
  return service.get(url, { params, ...config }) as unknown as Promise<ApiResponse<T>>
}

export function post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
  return service.post(url, data, config) as unknown as Promise<ApiResponse<T>>
}

export function put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
  return service.put(url, data, config) as unknown as Promise<ApiResponse<T>>
}

export function del<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
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
