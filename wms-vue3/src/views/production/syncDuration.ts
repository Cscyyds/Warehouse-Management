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
