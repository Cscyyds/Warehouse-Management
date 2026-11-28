import type { SimpleStockEntry, SimpleStockPosition } from '../api/modules/productInventory'

/** 展开位置仅用于表格；所有合计仍以原始余额行计算。旧接口缺positions时保留余额。 */
export function simpleStockPositionRows(rows: SimpleStockEntry[]) {
  return rows.flatMap(row => {
    const fallback: SimpleStockPosition = row.place_type === 'DISTRIBUTION_SPOT'
      ? { position_code: row.spot_no, location_no: row.spot_no, location_name: row.spot_name, floor_no: 0, position_no: 0 }
      : { position_code: row.position_code, location_no: row.location_no, location_name: row.location_name, floor_no: row.floor_no, position_no: row.position_no }
    const positions = row.positions?.length ? row.positions : [fallback]
    return positions.map((position, index) => ({ ...row, position, displayKey: `${row.balance_id}:${index}` }))
  })
}

export function formatStockDecimal(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '-'
  const text = String(value).trim()
  if (!/^\d+(?:\.\d+)?$/.test(text)) return '-'
  const [whole, fraction = ''] = text.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  return whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (trimmed ? `.${trimmed}` : '')
}

/** 精确四位数量求和；任一数量不可见则合计也不显示。 */
export function sumSimpleStock(rows: SimpleStockEntry[]): string {
  let total = 0n
  for (const row of rows) {
    if (typeof row.stock_qty !== 'string' || !/^\d+(?:\.\d{1,4})?$/.test(row.stock_qty)) return '-'
    const [whole, fraction = ''] = row.stock_qty.split('.')
    total += BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'))
  }
  return formatStockDecimal(`${total / 10000n}.${(total % 10000n).toString().padStart(4, '0')}`)
}

export function simplePlaceLabel(type: string): string {
  return ({ POSITION: '位置', PLASTIC_BOX: '塑料盒', DISTRIBUTION_SPOT: '集散位' } as Record<string, string>)[type] || '其他存放对象'
}

export function simplePlaceDisplay(row: SimpleStockEntry): { name: string; code: string } {
  if (row.place_type === 'PLASTIC_BOX') return { name: row.box_name?.trim() || '', code: row.box_code?.trim() || '' }
  if (row.place_type === 'DISTRIBUTION_SPOT') return { name: row.spot_name?.trim() || '', code: row.spot_no?.trim() || '' }
  if (row.place_type === 'POSITION') {
    const parts = [row.location_name?.trim() || '']
    if (row.floor_no != null) parts.push(`${row.floor_no}层`)
    if (row.position_no != null) parts.push(`${row.position_no}号位`)
    return { name: parts.filter(Boolean).join(' · '), code: row.position_code?.trim() || row.location_no?.trim() || '' }
  }
  return { name: '', code: '' }
}

/** 实时状态接口优先；状态不可用时只按真实明细展示，空数组不猜测模式。 */
export function inventoryDisplayMode(
  simpleRows: SimpleStockEntry[] | undefined,
  hasBarcodes: boolean,
  currentMode?: boolean,
): 'simple' | 'barcode' | 'empty' {
  if (currentMode !== undefined) return currentMode ? 'simple' : 'barcode'
  if (simpleRows?.length) return 'simple'
  if (hasBarcodes) return 'barcode'
  return 'empty'
}
