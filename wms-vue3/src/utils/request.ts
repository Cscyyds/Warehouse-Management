import axios, { type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { errorTextToSafeHtml, normalizeApiError, normalizeBlobError } from './apiError'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/',
  timeout: 30000
})

/* ── 全局并发闸门 ──────────────────────────────────────────────────────────
 * 后端 ASGISecurityMiddleware 配有 IP 级令牌桶（默认 burst=10、5 req/s），
 * 页面若一次性并发几十个请求会被直接 429 拦掉，表现为「请求过于频繁」。
 * 这里把在途请求数限制在 MAX_CONCURRENT_REQUESTS 以内，从源头削峰。
 * 注意：削峰只压峰值，真正把请求数降下来仍需接口批量返回数据。
 */
const MAX_CONCURRENT_REQUESTS = 6

let activeRequestCount = 0
const waitingQueue: Array<() => void> = []

function acquireRequestSlot(): Promise<void> {
  if (activeRequestCount < MAX_CONCURRENT_REQUESTS) {
    activeRequestCount++
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    waitingQueue.push(() => {
      activeRequestCount++
      resolve()
    })
  })
}

function releaseRequestSlot(): void {
  activeRequestCount = Math.max(0, activeRequestCount - 1)
  const next = waitingQueue.shift()
  if (next) next()
}

/** 只对幂等方法自动重发，避免 POST 重复提交 */
const RETRYABLE_METHODS = ['get', 'head', 'options']
/** 429 最多自动重试次数 */
const MAX_RETRY_ON_429 = 3
/** 429 重试基础退避时长（毫秒），按 2 的幂递增 */
const RETRY_BASE_DELAY_MS = 300

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 记录请求是否持有并发槽位与已重试次数，保证获取/释放成对 */
type SlotConfig = AxiosRequestConfig & { __slotAcquired?: boolean; __retryCount?: number }

function releaseSlotFor(config?: SlotConfig): void {
  if (config?.__slotAcquired) {
    config.__slotAcquired = false
    releaseRequestSlot()
  }
}

export interface ApiResponse<T = unknown> {
  code?: number
  success?: boolean
  message: string
  data: T
  timestamp?: string
}

type HandledRequestError = Error & {
  __handledMessage?: boolean
  blockedFields?: string[]
  validationErrors?: string[]
  /** 兼容 axios 错误对象结构，让 catch 中能通过 err.response?.data 访问后端响应 */
  response?: { data?: unknown; status?: number; headers?: unknown; config?: unknown }
}

export type RequestConfig = AxiosRequestConfig & {
  /** 二进制下载保留响应头；普通 JSON 请求仍只返回响应体。 */
  rawResponse?: boolean
  /** 已完成前置操作时，为后续请求错误补充醒目的上下文提示 */
  errorMessagePrefix?: string
  /** 为 true 时不弹全局错误 toast（ElMessage），由调用方自行处理错误展示 */
  silent?: boolean
}

function prependErrorContext(message: string, config?: RequestConfig): string {
  return config?.errorMessagePrefix ? `${config.errorMessagePrefix}\n${message}` : message
}

/** Element Plus 的 HTML 模式只用于换行，所有来源的文本先转义。 */
function showError(message: string): void {
  ElMessage({ message: errorTextToSafeHtml(message), type: 'error', dangerouslyUseHTMLString: true })
}

service.interceptors.request.use(
  async (config) => {
    await acquireRequestSlot()
    ;(config as SlotConfig).__slotAcquired = true
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
    releaseSlotFor(response.config as SlotConfig)
    const res = response.data as ApiResponse
    // 后端实际格式: { success: true/false, message: "...", data: ... }
    if (res.success === false || (res.code !== undefined && res.code !== 200)) {
      const normalized = normalizeApiError(res)
      const errMsg = prependErrorContext(normalized.message, response.config as RequestConfig)
      const silent = (response.config as RequestConfig)?.silent
      // silent 时不弹全局 toast，由调用方（如弹窗）自行展示错误
      if (!silent) {
        showError(errMsg || '请求失败')
      }
      // Error.message 保留纯文本（去掉 <br/> 等 HTML），供 catch 中非 ElMessage 场景（如文本插值）使用
      const handledError: HandledRequestError = new Error(errMsg)
      handledError.blockedFields = normalized.blockedFields
      handledError.validationErrors = normalized.validationErrors
      handledError.__handledMessage = true
      // 挂上 response，让 catch 中能拿到 err.response.data（与 axios 错误对象保持一致）
      handledError.response = {
        data: res,
        status: response.status,
        headers: response.headers,
        config: response.config,
      }
      return Promise.reject(handledError)
    }
    return (response.config as RequestConfig).rawResponse ? response : response.data
  },
  async (error) => {
    const slotConfig = error.config as SlotConfig | undefined
    releaseSlotFor(slotConfig)

    // 429 来自后端 IP 令牌桶限流，属于瞬时错误：退避后重发即可，
    // 不该把「请求过于频繁」当成业务错误弹给用户。
    if (error.response?.status === 429 && slotConfig) {
      const method = String(slotConfig.method || 'get').toLowerCase()
      const retryCount = slotConfig.__retryCount ?? 0
      if (RETRYABLE_METHODS.includes(method) && retryCount < MAX_RETRY_ON_429) {
        slotConfig.__retryCount = retryCount + 1
        await sleep(RETRY_BASE_DELAY_MS * 2 ** retryCount)
        return service.request(slotConfig)
      }
    }

    if (error.response?.status === 401) {
      const url = String(error.config?.url || '')
      // 独立用户（pdf_agent 账号）：只有 PDF 链路返回 401 才算会话失效。
      // nuomi_wms 不认识 PDF_AGENT 令牌，对 WMS 侧任何接口都返 401，
      // 若一并清会话会把独立用户误踢出登录态。
      if (localStorage.getItem('auth_kind') === 'pdf_agent') {
        const isPdfChain = url.startsWith('/pdf-agent')
          || url.startsWith('/api/v1/plugin/pdf')
          || url.startsWith('/api/v1/files/upload/pdf')
        if (isPdfChain) {
          localStorage.removeItem('token')
          localStorage.removeItem('auth_kind')
          router.push('/ai/pdf_agent/login')
        }
      } else {
        localStorage.removeItem('token')
        router.push('/login')
      }
    } else {
      const resData: unknown = error.response?.data
      const normalized = resData instanceof Blob
        ? await normalizeBlobError(resData, error.message || '网络错误')
        : normalizeApiError(resData, error.message || '网络错误')
      const errMsg = prependErrorContext(normalized.message, error.config as RequestConfig | undefined)
      const silent = (error.config as RequestConfig | undefined)?.silent
      if (!silent) showError(errMsg)
      error.message = errMsg
      ;(error as HandledRequestError).blockedFields = normalized.blockedFields
      ;(error as HandledRequestError).validationErrors = normalized.validationErrors
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

export async function postBinary(url: string, data: unknown, config?: RequestConfig) {
  const response = await service.post<Blob>(url, data, { timeout: 180000, ...config, responseType: 'blob', rawResponse: true, silent: true } as RequestConfig)
  return { blob: response.data, contentType: String(response.headers['content-type'] || ''), contentDisposition: String(response.headers['content-disposition'] || '') }
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
