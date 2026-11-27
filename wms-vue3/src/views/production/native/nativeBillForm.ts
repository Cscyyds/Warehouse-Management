import { newRequestId, type NativeItemRow } from '@/api/modules/productionNative'

export function useNativeRequestId() {
  let lastPayload: string | undefined
  let requestId: string
  return {
    id(payload: unknown) {
      const signature = JSON.stringify(payload)
      if (lastPayload !== signature || !requestId) requestId = newRequestId()
      lastPayload = signature
      return requestId
    },
    clear() { lastPayload = undefined },
  }
}

export function nativeError(error: unknown): { message: string; code?: string } {
  const err = error as { message?: string; response?: { data?: {
    message?: string
    data?: { error_code?: string; errors?: Array<{ reason?: string }> }
  } } }
  const body = err?.response?.data
  return {
    message: body?.data?.errors?.[0]?.reason || body?.message || err?.message || '请求失败，请重试',
    code: body?.data?.error_code,
  }
}

export function today() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}

export function validQuantity(value: string) {
  return /^\d{1,14}(?:\.\d{1,4})?$/.test(value) && /[1-9]/.test(value)
}

export function quantitySum(values: unknown[]) {
  let total = 0n
  for (const value of values) {
    if (typeof value !== 'string' || !/^\d+(?:\.\d{1,4})?$/.test(value)) return '—'
    const [whole, decimal = ''] = value.split('.')
    total += BigInt(whole) * 10000n + BigInt(decimal.padEnd(4, '0'))
  }
  const decimal = (total % 10000n).toString().padStart(4, '0').replace(/0+$/, '')
  return (total / 10000n).toString() + (decimal ? `.${decimal}` : '')
}

export type DraftLine = {
  key: string
  productId: string
  productCode: string
  productName: string
  unitName: string
  sourceItemId?: string
  qty: string
  length: string
  lengthApplicable: boolean
  lengthUnit: string
  xjxc: number
  remark: string
}

// 与主工程 normalize_container_length_unit 的单据单位别名保持一致。
const lengthUnitAliases: Record<string, 'm' | 'dm' | 'cm' | 'mm'> = {
  m: 'm', dm: 'dm', cm: 'cm', mm: 'mm',
  米: 'm', 公尺: 'm', 分米: 'dm', 厘米: 'cm', 公分: 'cm', 毫米: 'mm', 公厘: 'mm',
}

export function normalizeNativeLengthUnit(value?: string | null) {
  return lengthUnitAliases[value?.trim().toLowerCase() ?? '']
}

export function newDraft(productId: string, productCode: string, productName: string, unitName = '', assistUnitName?: string | null): DraftLine {
  const lengthUnit = normalizeNativeLengthUnit(assistUnitName)
  return { key: newRequestId(), productId, productCode, productName, unitName,
    qty: '', length: '', lengthApplicable: Boolean(lengthUnit),
    lengthUnit: lengthUnit ?? 'mm', xjxc: 0, remark: '' }
}

export function sourceDraft(row: NativeItemRow): DraftLine {
  return { ...newDraft(row.product_id, row.product_code, row.product_name, row.unit_name ?? ''),
    sourceItemId: row.item_id, length: String(row.length_value ?? ''), lengthUnit: row.length_unit || 'mm' }
}

export function draftError(rows: DraftLine[], isReturn: boolean) {
  if (!rows.length) return '请添加至少一条明细'
  for (const [index, row] of rows.entries()) {
    if (!validQuantity(row.qty.trim())) return `第 ${index + 1} 行：请输入大于 0、最多四位小数的数量`
    if (!isReturn && row.lengthApplicable && row.length.trim() && !/^\d{1,12}(?:\.\d{1,6})?$/.test(row.length.trim())) return `第 ${index + 1} 行：长度格式不正确`
  }
  return ''
}

export function draftPayload(rows: DraftLine[], isReturn: boolean, isPicking: boolean) {
  return rows.map(row => ({
    client_line_id: row.key,
    remark: row.remark.trim() || undefined,
    ...(isReturn ? {
      source_picking_item_id: row.sourceItemId, return_qty: row.qty.trim(),
    } : {
      product_id: row.productId, qty: row.qty.trim(), length: row.lengthApplicable && row.length.trim() ? `${row.length.trim()},${row.lengthUnit}` : undefined,
      ...(isPicking ? { xjxc: row.xjxc } : {}),
    }),
  }))
}

export function previewItems(rows: DraftLine[]) {
  return rows.map(row => ({ client_line_id: row.key, source_picking_item_id: row.sourceItemId!, return_qty: row.qty.trim() }))
}

export function previewLabels(rows: DraftLine[]) {
  return Object.fromEntries(rows.map(row => [row.key, `${row.productCode} ${row.productName}`]))
}

export function formatNativeDateTime(value?: string | null): string {
  return value ? value.replace('T', ' ').slice(0, 19) : '—'
}

export function formatNativeLength(row: Pick<NativeItemRow, 'length' | 'length_text' | 'length_value' | 'length_unit'>): string {
  if (row.length_text?.trim()) return row.length_text.trim()
  if (row.length_value != null && row.length_unit) return `${row.length_value}${row.length_unit}`
  const [value, unit] = (row.length ?? '').split(',')
  return value && unit ? `${value}${unit}` : row.length?.trim() || '-'
}
