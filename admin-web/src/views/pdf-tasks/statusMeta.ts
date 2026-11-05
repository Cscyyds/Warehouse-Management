export const PDF_STATUS_META: Record<string, { label: string; type: 'primary' | 'success' | 'warning' | 'danger' | 'info' }> = {
  ready: { label: '待解析', type: 'info' },
  processing: { label: '解析中', type: 'primary' },
  merging: { label: '合并中', type: 'primary' },
  review_pending: { label: '待人工审核', type: 'warning' },
  publishing: { label: '发布中', type: 'primary' },
  published: { label: '已完成', type: 'success' },
  publish_partial: { label: '部分完成', type: 'warning' },
  failed: { label: '失败', type: 'danger' },
  canceled: { label: '已取消', type: 'danger' },
}

export const PDF_STAGE_META: Record<string, string> = {
  created: '已创建',
  queued: '排队中',
  w1: '页面识别 W1',
  w2: '产品合并 W2',
  review: '人工审核',
  publish: '结果发布',
  done: '已完成',
}

export const PDF_IMAGE_TYPE_META: Record<string, string> = {
  main: '主图',
  detail: '细节图',
  scene: '场景图',
  structure: '结构图',
  install: '安装图',
  parameter: '参数图',
  other: '其他',
}

export function pdfStatusMeta(status: string) {
  return PDF_STATUS_META[status] || { label: status || '未知', type: 'info' as const }
}

export function pdfStageMeta(stage: string, status = '') {
  if (!stage) {
    if (status === 'published' || status === 'publish_partial') return '已完成'
    if (status === 'review_pending') return '人工审核'
    if (status === 'failed') return '已失败'
    if (status === 'canceled') return '已取消'
    return '—'
  }
  return PDF_STAGE_META[stage] || stage
}

export function pdfImageTypeMeta(type: string) {
  return PDF_IMAGE_TYPE_META[type] || type || '其他'
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', { hour12: false })
}

export function formatSize(size?: number): string {
  const value = Number(size || 0)
  if (!value) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}
