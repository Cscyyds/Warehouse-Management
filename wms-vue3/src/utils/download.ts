/**
 * 模块：二进制文件下载（业务单据 PDF 等）
 *
 * 背景：request.ts 的响应拦截器按 JSON 解析错误体，而 PDF 接口以
 *       responseType: 'blob' 发起，错误体同样是 Blob，拦截器读不出后端的
 *       message/data，只能弹出 axios 通用文案（如 "Request failed with status code 403"）。
 *       因此 PDF 下载接口统一带 silent: true，由本模块解析 Blob 错误体并提示后端原文案。
 *
 * 兜底：后端若以 HTTP 200 返回 JSON 错误体（异常中间件改写状态码），拦截器会当成成功，
 *       这里通过 PDF 文件头魔数识别，避免把错误信息当 PDF 下载到本地。
 */
import { ElMessage } from 'element-plus'
import { normalizeBlobError } from './apiError'
import { validateXlsxDownload, type BinaryFileResponse } from './binaryDownload'

/** reportlab 生成的 PDF 以 %PDF- 开头，用于校验响应确为 PDF 内容 */
const PDF_MAGIC = '%PDF'
/** 无法从响应中解析出后端文案时的兜底提示 */
const DEFAULT_ERROR = 'PDF 生成失败，请稍后重试'
async function readBlobText(blob: Blob): Promise<string> {
  try {
    return (await blob.text()).trim()
  } catch {
    return ''
  }
}

/** 从错误响应中提取可展示文案：优先 data（后端具体原因），其次 message */
async function extractBlobError(blob: Blob, fallback = DEFAULT_ERROR): Promise<string> {
  return (await normalizeBlobError(blob, fallback)).message
}

/** 归一化异常文案：Blob 错误体读后端文案，其余场景给可读兜底 */
async function resolveErrorMessage(error: unknown): Promise<string> {
  const blob = (error as { response?: { data?: unknown } })?.response?.data
  if (blob instanceof Blob) return extractBlobError(blob)
  const message = String((error as { message?: unknown })?.message || '')
  if (!message || message.startsWith('Request failed')) return DEFAULT_ERROR
  if (message.includes('Network Error')) return '网络异常，请检查网络后重试'
  if (message.toLowerCase().includes('timeout')) return 'PDF 生成超时，请稍后重试'
  return message
}

/** 触发浏览器另存为（文件名由调用方按后端 Content-Disposition 规则拼接） */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export interface PdfDownloadOptions {
  /** 发起下载请求，返回二进制流（api 模块的 printXxxPdf） */
  request: () => Promise<Blob>
  /** 本地保存的文件名，需与后端 Content-Disposition 规则一致 */
  fileName: string
  /** 下载成功提示 */
  successMessage?: string
  /** 异步下载完成前，页面或登录身份变化时不保存旧文件。 */
  isCurrent?: () => boolean
}

/**
 * 请求并保存 PDF，统一成功/失败提示。
 *
 * 失败时抛出异常（文案已提示），调用方 catch 后复位按钮状态即可，无需重复提示。
 */
export async function downloadPdf(options: PdfDownloadOptions): Promise<void> {
  const { request, fileName, successMessage = 'PDF 已开始下载' } = options
  try {
    if (options.isCurrent?.() === false) return
    const blob = await request()
    if (options.isCurrent?.() === false) return
    const head = await readBlobText(blob.slice(0, PDF_MAGIC.length))
    if (blob.type.includes('application/json') || head !== PDF_MAGIC) {
      throw new Error(await extractBlobError(blob))
    }
    if (options.isCurrent?.() === false) return
    saveBlob(blob, fileName)
    ElMessage.success(successMessage)
  } catch (error) {
    if (options.isCurrent?.() === false) return
    ElMessage.error(await resolveErrorMessage(error))
    throw error
  }
}

/** 同步导出，成功仅说明浏览器已开始下载，不产生后台导出任务。 */
export async function downloadXlsx(options: { request: () => Promise<BinaryFileResponse>; fileName: string }): Promise<void> {
  try {
    const response = await options.request()
    const name = await validateXlsxDownload(response, options.fileName)
    saveBlob(response.blob, name)
    ElMessage.success('文件已开始下载，请在浏览器下载列表查看')
  } catch (error) {
    const e = error as { response?: { data?: unknown }; message?: string }
    const message = e.response?.data instanceof Blob ? (await normalizeBlobError(e.response.data, '导出失败，请稍后重试')).message
      : e.message?.toLowerCase().includes('timeout') ? '文件生成超时，请稍后重新导出'
        : e.message || '导出失败，请稍后重试'
    ElMessage.error(message)
    throw error
  }
}
