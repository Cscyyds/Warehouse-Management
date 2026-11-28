/** 采购预付款门槛独立于订单应付总额，默认全额预付。 */
export function isPurchasePrepayment(method: unknown): boolean {
  return method === 'PREPAYMENT' || method === '预付款使用'
}

/** 与采购状态接口 Decimal.quantize 的 HALF_EVEN 口径一致，按分计算。 */
export function requiredPurchasePrepayment(payable: unknown, ratio: unknown): string {
  const amount = String(payable ?? '').trim()
  const percent = ratio === '' || ratio == null ? NaN : Number(ratio)
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || !Number.isInteger(percent) || percent < 1 || percent > 100) return '-'
  const [whole, fraction = ''] = amount.split('.')
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'))
  const raw = cents * BigInt(percent)
  let result = raw / 100n
  const remainder = raw % 100n
  if (remainder > 50n || (remainder === 50n && result % 2n === 1n)) result++
  return `${result / 100n}.${String(result % 100n).padStart(2, '0')}`
}
