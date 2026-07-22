export type OrderDateRange = [Date, Date]

function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function recentCalendarDays(days: number): OrderDateRange {
  const end = startOfToday()
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  return [start, end]
}

function currentMonth(): OrderDateRange {
  const end = startOfToday()
  return [new Date(end.getFullYear(), end.getMonth(), 1), end]
}

/** 采购、销售订单共用的创建日期快捷范围（首尾日期均包含）。 */
export const orderDateRangeShortcuts = [
  { text: '近 7 天', value: () => recentCalendarDays(7) },
  { text: '近 15 天', value: () => recentCalendarDays(15) },
  { text: '近 30 天', value: () => recentCalendarDays(30) },
  { text: '本月', value: currentMonth }
]

/** 创建时间不可能晚于今天，避免选择没有业务意义的未来日期。 */
export function disableFutureOrderDate(date: Date): boolean {
  return date.getTime() > startOfToday().getTime()
}
