export function createAmountSummary(amountProps: string[]) {
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
        const total = data.reduce((acc, row) => {
          const val = Number(row[col.property])
          return acc + (isNaN(val) ? 0 : val)
        }, 0)
        sums[index] = `¥${total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      } else {
        sums[index] = ''
      }
    })
    return sums
  }
}
