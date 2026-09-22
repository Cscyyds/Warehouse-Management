import type { ImportTask, ImportTaskDetail, ImportTaskStatus, ImportTaskType, ImportSheetKey } from '../api/modules/batchImport'

export const IMPORT_STATUS_LABELS: Record<ImportTaskStatus, string> = {
  PENDING: '待执行', VALIDATING: '校验中', WRITING: '写入中', SUCCESS: '导入成功',
  FAILED_VALIDATION: '校验失败', FAILED_SYSTEM: '系统失败',
}

export function importStatusType(status: ImportTaskStatus): 'info' | 'primary' | 'warning' | 'success' | 'danger' {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED_VALIDATION' || status === 'FAILED_SYSTEM') return 'danger'
  if (status === 'WRITING') return 'warning'
  return status === 'VALIDATING' ? 'primary' : 'info'
}

export function importProgress(task: ImportTask): number {
  return task.total_count > 0 ? Math.min(100, Math.max(0, Math.round(task.processed_count / task.total_count * 100))) : 0
}

export function importProgressText(task: ImportTask): string {
  switch (task.status) {
    case 'PENDING': return '等待后台处理'
    case 'VALIDATING': return `已校验 ${task.processed_count} / ${task.total_count} 行`
    case 'WRITING': return '校验完成，正在写入'
    case 'SUCCESS': return `已导入 ${task.success_count} 行`
    case 'FAILED_VALIDATION': return `异常 ${task.error_count} 行 · 全部未导入`
    case 'FAILED_SYSTEM': return '任务失败，已回滚'
    default: return task.status_name || task.status
  }
}

export function importSheets(type: ImportTaskType): Array<{ key: ImportSheetKey; label: string }> {
  if (type === 'sales-order') return [{ key: 'sales_order', label: '销售主单' }, { key: 'sales_order_item', label: '销售明细' }]
  if (type === 'purchase-order') return [{ key: 'purchase_order', label: '采购主单' }, { key: 'purchase_order_item', label: '采购明细' }]
  return []
}

export function importErrorPage(detail: ImportTaskDetail, sheet?: ImportSheetKey) {
  if (sheet) return {
    rows: Array.isArray(detail.errors) ? [] : detail.errors[sheet] ?? [],
    total: detail[sheet]?.invalid_count ?? 0,
  }
  return { rows: Array.isArray(detail.errors) ? detail.errors : [], total: detail.error_total ?? 0 }
}

export function importRequestError(error: unknown): string {
  const e = error as { message?: string; response?: { data?: { message?: string; detail?: unknown } } }
  const body = e?.response?.data
  return (body?.message || (typeof body?.detail === 'string' ? body.detail : '') || e?.message || '请求失败，请重试').replace(/<br\s*\/?>/gi, '\n')
}

export function importFileUrl(url: string | null): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : undefined
  } catch {
    return undefined
  }
}

export function importFileSize(size: number | null): string {
  if (size === null) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}
