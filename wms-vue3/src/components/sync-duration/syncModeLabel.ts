const labels = {
  TIANXIN: '天心模式',
  NATIVE: '本系统模式',
  DISABLED: '未启用',
}

export function syncModeLabel(mode?: keyof typeof labels): string {
  return mode ? (labels[mode] ?? '—') : '—'
}
