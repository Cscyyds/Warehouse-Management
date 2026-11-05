import type { ImportTask, ImportTaskDetail, ImportTaskStatus, ImportTaskType, ImportSheetKey } from '../api/modules/batchImport'
import { normalizeApiError } from './apiError.ts'

export const IMPORT_STATUS_LABELS: Record<ImportTaskStatus, string> = {
  PENDING: '等待处理', VALIDATING: '检查文件中', WRITING: '正在保存', SUCCESS: '已完成',
  FAILED_VALIDATION: '检查未通过', FAILED_SYSTEM: '处理未完成',
}

export const IMPORT_DETAIL_INTERVAL_MS = 2000
export const IMPORT_LIST_INTERVAL_MS = 5000

export function isImportTaskFinished(task: Pick<ImportTask, 'status' | 'is_finished'>): boolean {
  return ['SUCCESS', 'FAILED_VALIDATION', 'FAILED_SYSTEM'].includes(task.status) || task.is_finished === true
}

const maintenanceTypes = new Set(['PRODUCT_UPDATE', 'PRODUCT_SUPPLIER', 'PRODUCT_SALE_PRICE'])

export function importResultStats(task: Pick<ImportTask, 'task_type' | 'status' | 'result_stats'>): Array<{ label: string; value: string }> {
  if (task.status !== 'SUCCESS' || !maintenanceTypes.has(task.task_type) || !task.result_stats) return []
  const labels = task.task_type === 'PRODUCT_UPDATE'
    ? [['updated_count', '实际更新产品'], ['unchanged_count', '无变化产品']]
    : [['created_count', '首次新增'], ['revived_count', task.task_type === 'PRODUCT_SUPPLIER' ? '恢复绑定' : '恢复定价'], ['updated_count', '实际更新'], ['unchanged_count', '无变化']]
  const stats = task.result_stats as Record<string, unknown>
  return labels.flatMap(([key, label]) => {
    const value = stats[key]
    if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) return []
    if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) return []
    return [{ label, value: String(value) }]
  })
}

export function importSuccessText(task: ImportTask): string {
  const stats = importResultStats(task)
  if (task.task_type === 'PRODUCT_UPDATE' && stats.length === 2) {
    return `实际更新 ${stats[0].value} 个产品，无变化跳过 ${stats[1].value} 个产品`
  }
  if (stats.length) return stats.map(item => `${item.label} ${item.value}`).join('，')
  return maintenanceTypes.has(task.task_type) ? '处理完成；此任务未提供分类统计' : `已导入 ${task.success_count} 行`
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
    case 'SUCCESS': return importSuccessText(task)
    case 'FAILED_VALIDATION': return `异常 ${task.error_count} 行 · 全部未导入`
    case 'FAILED_SYSTEM': return '后台处理未完成，请查看失败原因'
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
  return normalizeApiError(e?.response?.data, e?.message || '请求失败，请重试').message.replace(/<br\s*\/?>/gi, '\n')
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
