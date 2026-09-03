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

type HandledRequestError = Error & {
  __handledMessage?: boolean
  /** 兼容 axios 错误对象结构，让 catch 中能通过 err.response?.data 访问后端响应 */
  response?: { data?: unknown; status?: number; headers?: unknown; config?: unknown }
}

export type RequestConfig = AxiosRequestConfig & {
  /** 已完成前置操作时，为后续请求错误补充醒目的上下文提示 */
  errorMessagePrefix?: string
  /** 为 true 时不弹全局错误 toast（ElMessage），由调用方自行处理错误展示 */
  silent?: boolean
}

function prependErrorContext(message: string, config?: RequestConfig): string {
  if (!config?.errorMessagePrefix) return message
  return `<strong style="font-size: 15px; color: var(--el-color-danger);">${config.errorMessagePrefix}</strong><br/>${message}`
}

/** toast 中错误明细最多展示的条数，超出部分折叠为"…等 N 条错误" */
const MAX_ERROR_PREVIEW = 3

/** 从后端响应中提取错误消息，优先展示详细校验错误列表（过多时只预览前几条） */
function extractErrorMessage(res: ApiResponse): string {
  let errMsg = typeof res.data === 'string' ? res.data : res.message
  if (Array.isArray(res.data)) {
    // 数组型错误明细，两种已知形态：
    // 业务逐条校验错误 [{index, detail}]（如采购退货）；FastAPI 请求体校验错误 [{type, loc, msg, input}]
    const items = res.data as Array<Record<string, unknown>>
    const parts = items
      .slice(0, MAX_ERROR_PREVIEW)
      .map(e => {
        if (typeof e.detail === 'string' && e.detail) return e.detail
        if (typeof e.msg === 'string' && e.msg) {
          const loc = Array.isArray(e.loc)
            ? (e.loc as unknown[]).filter(k => k !== 'body').join('.')
            : ''
          return loc ? `${loc}：${e.msg}` : e.msg
        }
        return ''
      })
      .filter(Boolean)
    if (parts.length > 0) {
      if (items.length > MAX_ERROR_PREVIEW) parts.push(`…等 ${items.length} 条错误`)
      errMsg = parts.join('<br/>')
    }
  } else if (res.data && typeof res.data === 'object') {
    const data = res.data as Record<string, unknown>
    // 归一化 errors：扁平数组（单 Sheet 导入）或按工作表分组对象（采购订单双 Sheet 导入）
    let allErrors: Array<Record<string, unknown>> = []
    const rawErrors = data.errors
    if (Array.isArray(rawErrors)) {
      allErrors = rawErrors as Array<Record<string, unknown>>
    } else if (rawErrors && typeof rawErrors === 'object') {
      // 双 Sheet：{sheetName: [{row,name,reason}, ...]}，拍平并注入 sheet 字段
      for (const [sheet, list] of Object.entries(rawErrors as Record<string, unknown>)) {
        if (Array.isArray(list)) {
          (list as Array<Record<string, unknown>>).forEach(e => allErrors.push({ sheet, ...e }))
        }
      }
    }
    if (allErrors.length > 0) {
      const shownErrors = allErrors.slice(0, MAX_ERROR_PREVIEW)
      const parts = shownErrors
        .map(e => {
          // 批量导入错误结构：{row, name, reason}
          if (typeof e.reason === 'string' && e.reason) {
            const row = e.row
            const name = e.name
            const sheet = e.sheet
            const at = sheet ? `工作表「${sheet}」` : ''
            return `${at}第${row}行${name ? `「${name}」` : ''}：${e.reason}`
          }
          // 旧校验错误结构：{label, errors: string[]}
          const label = e.label
          const msgs = Array.isArray(e.errors) ? (e.errors as string[]).join('；') : ''
          return label ? `${label}：${msgs}` : msgs
        })
        .filter(Boolean)
      // 超出预览条数时折叠，避免 toast 被大量错误刷爆
      if (allErrors.length > MAX_ERROR_PREVIEW) {
        parts.push(`…等 ${allErrors.length} 条错误`)
      }
      errMsg = parts.join('<br/>')
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
      const silent = (response.config as RequestConfig)?.silent
      // silent 时不弹全局 toast，由调用方（如弹窗）自行展示错误
      if (!silent) {
        ElMessage({ message: errMsg || '请求失败', type: 'error', dangerouslyUseHTMLString: true })
      }
      // Error.message 保留纯文本（去掉 <br/> 等 HTML），供 catch 中非 ElMessage 场景（如文本插值）使用
      const handledError: HandledRequestError = new Error(errMsg.replace(/<br\s*\/?>/gi, '\n'))
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
      const silent = (error.config as RequestConfig | undefined)?.silent
      if (!silent) {
        ElMessage({ message: errMsg, type: 'error', dangerouslyUseHTMLString: true })
      }
      // 兜底：如果外部异常（如网络中断）走到这里，error.message 一般为 Axios 文案（如 'Network Error'），不含 HTML
      if (typeof error.message === 'string') {
        error.message = error.message.replace(/<br\s*\/?>/gi, '\n')
      }
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
