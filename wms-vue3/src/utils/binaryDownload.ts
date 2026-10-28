import { normalizeBlobError } from './apiError.ts'

export interface BinaryFileResponse { blob: Blob; contentType?: string; contentDisposition?: string }
export function downloadFileName(disposition: string, fallback: string): string {
  const extended = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition)
  const regular = /filename\s*=\s*(?:"([^"]*)"|([^;]*))/i.exec(disposition)
  let name = regular?.[1] || regular?.[2] || ''
  if (extended) { try { name = decodeURIComponent(extended[1].trim()) } catch { /* 使用普通文件名或本地回退名。 */ } }
  name = name.trim().split(/[\\/]/).pop()?.replace(/[\u0000-\u001f<>:"|?*]/g, '_') || ''
  return name.toLowerCase().endsWith('.xlsx') ? name : fallback
}

export async function validateXlsxDownload(response: BinaryFileResponse, fallbackName: string): Promise<string> {
  const { blob } = response
  if (!(blob instanceof Blob)) throw new Error('文件响应异常，请重新导出')
  const contentType = (response.contentType || blob.type).split(';')[0].trim().toLowerCase()
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
  const isZip = head.length === 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
  const isFileType = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'].includes(contentType)
  if (!isZip || !isFileType) throw new Error((await normalizeBlobError(blob, '导出未返回有效的 Excel 文件，请稍后重试')).message)
  return downloadFileName(response.contentDisposition || '', fallbackName)
}
