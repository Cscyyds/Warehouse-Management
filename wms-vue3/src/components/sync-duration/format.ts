/**
 * 同步间隔选择器的纯函数工具（无 Vue 依赖）。
 *
 * 原为「生产概览 → 同步设置」专属，2026-11-05 抽到公共组件目录，
 * 供生产概览与借出借入同步设置共用（两模块后端 bounds 同为 300~172800 秒）。
 * 改这里会同时影响两个页面，勿按单一模块的口径调整。
 */

export function formatDuration(total: number): string {
  return `${Math.floor(total / 60)} 分 ${total % 60} 秒`
}

export function secondsForMinute(minute: number, min: number, max: number): number[] {
  const start = Math.max(0, min - minute * 60)
  const end = Math.min(59, max - minute * 60)
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i)
}

export function durationToSeconds(minutes: number, seconds: number, min: number, max: number): number {
  const total = minutes * 60 + seconds
  if (!Number.isInteger(minutes) || !Number.isInteger(seconds) || seconds < 0 || seconds > 59 || total < min || total > max) {
    throw new RangeError('同步间隔超出允许范围')
  }
  return total
}
