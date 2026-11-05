/** 塑料盒长度全程保留十进制字符串，避免经过 Number 丢失六位小数。 */
export function canonicalBoxLength(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const raw = String(value).trim()
  const match = /^(\d+)(?:\.(\d*))?$/.exec(raw)
  if (!match) return raw // 保留非法输入交给校验，不能静默清成 0。
  const integer = match[1].replace(/^0+(?=\d)/, '')
  const fraction = (match[2] || '').replace(/0+$/, '')
  if (integer === '0' && !fraction) return null
  return fraction ? `${integer}.${fraction}` : integer
}

export function isValidBoxLength(value: unknown): boolean {
  const normalized = canonicalBoxLength(value)
  return normalized === null || /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(normalized)
}

/** 后端保留旧数值字段供兼容；编辑优先从快照文本取精确十进制值。 */
export function boxLengthEditValue(box: { spec_length?: unknown; spec_length_text?: unknown }): string | null {
  const text = String(box.spec_length_text || '')
  const match = /^(\d+(?:\.\d+)?),(?:m|mm)$/.exec(text)
  return canonicalBoxLength(match ? match[1] : box.spec_length)
}

export function boxLengthDisplay(box: Record<string, unknown>): string {
  if (typeof box.spec_length_text === 'string' && box.spec_length_text) return box.spec_length_text
  const value = canonicalBoxLength(box.spec_length)
  if (Number(box.length_version) > 0 && Number(box.length_status) !== 4) return '配置异常'
  return value && isValidBoxLength(value) ? `${value},m` : '未指定'
}

export function boxLengthUpdate(data: Record<string, unknown>): Record<string, string> {
  const current = canonicalBoxLength(data.spec_length)
  if (current === canonicalBoxLength(data.__spec_length_snapshot)) return {}
  if (!isValidBoxLength(data.spec_length)) throw new Error('指定长度须为非负数字，最多十二位整数、六位小数')
  const params: Record<string, string> = { spec_length: current ?? '0' }
  if (data.length_revision !== null && data.length_revision !== undefined) params.expected_length_revision = String(data.length_revision)
  if (current !== null) {
    const unit = String(data.product_assist_unit_code || '')
    if (!['m', 'mm'].includes(unit)) throw new Error('请先维护产品有效的辅助计量长度单位（m/mm）')
    params.expected_length_unit = unit
  }
  return params
}
