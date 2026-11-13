import { getQuery, postForm, type CreatePrintTaskItemPayload } from './printTask'

export interface CloudPrinter {
  cloud_printer_id: string
  name: string
  provider: string
  sn: string
  developer_user: string
  has_ukey: boolean
  printer_model_code: string
  label_spec_id: string
  qr_width_mm: number
  qr_height_mm: number
  qr_columns: 1 | 2
  qr_row_width_mm: number
  status: 0 | 1
}
export type CodeStyle = 'BARCODE' | 'QRCODE'
export interface CloudJob {
  job_id: string
  request_id: string
  status: string
  error: string | null
  accepted: number
  total: number
  orders: Array<{ barcode_content: string; copies: number; state: string; order_id: string | null }>
}
export const listCloudPrinters = () => getQuery<{ list: CloudPrinter[] }>('/api/v1/tenant-wms/cloud-printers', {})
export const saveCloudPrinter = (data: Record<string, unknown>) => postForm<CloudPrinter>('/api/v1/tenant-wms/cloud-printers/save', data)
export const deleteCloudPrinter = (id: string) => postForm('/api/v1/tenant-wms/cloud-printers/delete', { cloud_printer_id: id })
export const getCloudPrinterStatus = (id: string) => getQuery<{ status: number; message: string }>('/api/v1/tenant-wms/cloud-printers/status', { cloud_printer_id: id })
export function submitCloudPrint(data: {
  cloud_printer_id: string; request_id: string; code_style: CodeStyle; source?: string
  print_task_id?: string; items?: CreatePrintTaskItemPayload[]
}) {
  return postForm<CloudJob>('/api/v1/tenant-wms/cloud-print-jobs', {
    ...data, items: data.items ? JSON.stringify(data.items) : undefined,
  }, 120000)
}
export const queryCloudJob = (id: string) => getQuery<CloudJob>('/api/v1/tenant-wms/cloud-print-jobs', { request_id: id })
export const previewCloudPrint = (data: {
  cloud_printer_id: string; code_style: CodeStyle; print_task_id?: string; items?: CreatePrintTaskItemPayload[]
}) => postForm<{ labels: Array<{ barcode_content: string; png_base64: string; copies: number }> }>(
  '/api/v1/tenant-wms/cloud-print-jobs/preview', { ...data, request_id: 'preview', items: data.items ? JSON.stringify(data.items) : undefined })

export function cloudJobMessage(job: CloudJob): string {
  if (job.status === 'PRINTED') return '云平台已确认打印完成'
  if (job.status === 'SUBMITTED') return `芯烨云已受理 ${job.accepted} 个订单，请确认出纸；再次点击可查询结果`
  if (job.status === 'UNKNOWN') return `${job.error || '云订单状态不确定'}（作业 ${job.job_id}）。请核查平台订单，勿新建请求重打`
  if (job.status === 'FAILED' || job.status === 'PREPARE_FAILED') return `${job.error || '云打印失败'}；已受理 ${job.accepted}/${job.total}，重试会跳过已受理订单`
  return `作业 ${job.job_id} 正在处理，请稍后查询；请保留本次请求号`
}
