import type { CloudJob, CodeStyle } from '@/api/modules/cloudPrint'
import type { CreatePrintTaskItemPayload } from '@/api/modules/printTask'

export interface CloudPrintRequest {
  request_id: string
  cloud_printer_id: string
  code_style: CodeStyle
  source?: string
  print_task_id?: string
  items?: CreatePrintTaskItemPayload[]
}

type RequestStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export class CloudPrintSelectionError extends Error {}

/** 局域网 HTTP 页面没有 randomUUID 时，仍可生成每次打印独立的请求号。 */
export function newCloudRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
  }
  return `cloud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** 未完成请求只允许原设备、原码制和原条目续打，防止界面选二维码却静默打印旧条码。 */
export async function prepareCloudPrintRequest(
  key: string,
  selection: Omit<CloudPrintRequest, 'request_id'>,
  query: (requestId: string) => Promise<CloudJob>,
  storage: RequestStore = localStorage,
): Promise<CloudPrintRequest> {
  let saved: CloudPrintRequest | null
  try { saved = JSON.parse(storage.getItem(key) || 'null') }
  catch { throw new CloudPrintSelectionError('原云打印请求记录无法读取，请先核查上次订单，勿重复下发') }
  if (saved) {
    if (!saved.request_id || !saved.cloud_printer_id || !['BARCODE', 'QRCODE'].includes(saved.code_style)) {
      throw new CloudPrintSelectionError('原云打印请求记录不完整，请先核查上次订单，勿重复下发')
    }
    // 早期网页只保存请求号、设备和码制，发送时再补任务ID；保留这类原请求的幂等性。
    if (selection.print_task_id && !saved.print_task_id && !saved.items) {
      saved = { ...saved, print_task_id: selection.print_task_id }
    }
    const { request_id, ...previous } = saved
    if (canonical(previous) === canonical(selection)) return saved
    const job = await query(request_id)
    const safeToStart = job.status === 'PRINTED'
      || (job.status === 'PREPARE_FAILED' && job.accepted === 0 && job.total === 0)
    if (!safeToStart) {
      const style = saved.code_style === 'QRCODE' ? '二维码' : '条码'
      throw new CloudPrintSelectionError(`上次${style}作业尚未完成（${job.job_id}），请保持原打印机、样式和份数查询或重试；确认完成后可切换本次样式`)
    }
  }
  const request = { ...selection, request_id: newCloudRequestId() }
  storage.setItem(key, JSON.stringify(request))
  return request
}
