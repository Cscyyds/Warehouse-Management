export function createAmountSummary(amountProps: string[], canSum: (prop: string) => boolean = () => true) {
  return ({ columns, data }: { columns: any[]; data: any[] }) => {
    const sums: string[] = []
    let labelSet = false
    columns.forEach((col, index) => {
      if (!labelSet && !col.type) {
        sums[index] = '合计'
        labelSet = true
        return
      }
      if (amountProps.includes(col.property)) {
        if (!canSum(col.property)) { sums[index] = ''; return }
        // 删除/缺失/空白/非法金额不能按0拼出一个看似完整的合计。
        if (data.some(row => row[col.property] == null || String(row[col.property]).trim() === '' || !Number.isFinite(Number(row[col.property])))) {
          sums[index] = '-'
          return
        }
        const total = data.reduce((acc, row) => {
          const val = Number(row[col.property])
          return acc + val
        }, 0)
        sums[index] = Number.isFinite(total) ? `¥${total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'
      } else {
        sums[index] = ''
      }
    })
    return sums
  }
}
