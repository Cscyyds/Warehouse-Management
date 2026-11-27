/**
 * 采购订单金额的实时计算（纯函数，供表单 computed 字段与明细列共用）。
 *
 * ## 为什么需要它
 * `formConfigs.ts` 的 purchaseOrder 场景把「订单金额 / 应付金额」声明为 `type: 'computed'`，
 * 但长期没有 `compute`：新增态恒为默认值 `0.00`，编辑态只能显示后端返回值。
 * 用户改采购单价 / 采购数量后两处金额不刷新，需要保存并重新打开才能看到正确数字。
 *
 * ## 口径（对齐后端 app/services/purchase_order_service.py）
 * `recalc_purchase_order_amounts_and_allocate_rounding` / `..._in_memory`：
 * 1. 明细金额 `amount = round(purchase_price × qty, 2)` —— **逐行**四舍五入到分再汇总，
 *    不是先汇总再舍入（两者在大数量下会差几分钱，必须与后端同序）。
 * 2. 订单金额 `order_amount = Σ amount`。
 * 3. 应付金额 `payable_amount = order_amount − 抹零 − 赠送 − 预付款`。
 *    采购订单页面没有「抹零金额」录入项（`rounding_amount` 恒为 0），故前端只扣赠送与预付款。
 * 4. 赠送金额 `use_gift_amount = Σ明细 line_use_gift_amount`（派生只读值，后端每次写操作后重算回写）。
 * 5. 预付款按 `max(值, 0)` 清洗，与后端 `cash_prepayment` 一致。
 *
 * ## 边界
 * 前端只做展示侧实时预览，最终金额仍以后端为准（保存后详情会覆盖）。
 * 金额为负时不显示负数，按 `0.00` 展示并由调用方给出提示——后端同样会以
 * 「应付金额不能为负数」拦截保存，前端只负责让用户提前看见问题。
 */

/** 与后端 Decimal ROUND_HALF_UP 等价的两位小数舍入。 */
const HALF_UP_EPSILON = 1e-9

/**
 * 四舍五入到 2 位小数（half-up，与 Python `Decimal.quantize(Decimal('0.01'), ROUND_HALF_UP)` 一致）。
 *
 * 不能用 `toFixed(2)` 代替：`(1.005).toFixed(2) === '1.00'`（二进制浮点向下偏），
 * 而后端会得到 `1.01`，几万条明细的行金额会出现系统性偏低。这里先放大到「分」再整数舍入，
 * 并加一个极小 epsilon 抵消 `1.005 * 100 = 100.49999999999999` 这类表示误差。
 */
export function roundHalfUp2(value: number): number {
  if (!Number.isFinite(value)) return 0
  const scaled = value * 100
  const rounded = scaled >= 0
    ? Math.floor(scaled + 0.5 + HALF_UP_EPSILON)
    : -Math.floor(-scaled + 0.5 + HALF_UP_EPSILON)
  return rounded / 100
}

/** 任意输入转有限数字；空值、非数字一律按 0（与后端 `_as_decimal(..., default=0)` 一致）。 */
export function toAmountNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** 金额文本：两位小数；空值回落 `0.00`。 */
export function moneyText(value: unknown): string {
  return roundHalfUp2(toAmountNumber(value)).toFixed(2)
}

/**
 * 单行明细金额 = round(采购单价 × 采购数量, 2)。
 *
 * 返回 `null` 表示**该行缺少单价或数量字段本身**（不是空串），用于识别敏感字段被裁剪：
 * 角色被限制「采购单价」后后端详情不再下发 `purchase_price`，此时不能按 0 汇总，
 * 否则空表单会把真实订单金额覆盖成 0.00。
 */
export function lineAmountOf(row: Record<string, any> | null | undefined): number | null {
  if (!row || typeof row !== 'object') return null
  if (!Object.hasOwn(row, 'purchase_price') || !Object.hasOwn(row, 'qty')) return null
  return roundHalfUp2(toAmountNumber(row.purchase_price) * toAmountNumber(row.qty))
}

/** Σ明细行使用赠送金额（主单 use_gift_amount 的后端口径）。 */
export function lineGiftTotalOf(items: unknown): number {
  if (!Array.isArray(items)) return 0
  const total = items.reduce((sum: number, row: any) => sum + toAmountNumber(row?.line_use_gift_amount), 0)
  return roundHalfUp2(total)
}

export interface PurchaseOrderAmountFallback {
  /** 上一次（通常是后端返回的）订单金额；明细被敏感裁剪时原样保留 */
  order?: unknown
  /** 上一次（通常是后端返回的）应付金额；明细被敏感裁剪时原样保留 */
  payable?: unknown
}

export interface PurchaseOrderAmounts {
  /** 订单金额（两位小数文本） */
  orderAmountText: string
  /** 应付金额（两位小数文本，负数按 0.00 展示） */
  payableAmountText: string
  /** 使用赠送金额合计（两位小数文本） */
  giftAmountText: string
  /** 订单金额数值，便于其他计算复用 */
  orderAmount: number
  /** 应付金额数值（已钳制为非负） */
  payableAmount: number
  /** 扣减（赠送 + 预付款）超过订单金额：应付按 0.00 展示，提示用户调整 */
  negative: boolean
  /** 明细行缺少采购单价 / 采购数量字段（敏感权限裁剪）：本次未重算，沿用 fallback */
  redacted: boolean
}

/**
 * 汇总采购订单主单金额。
 *
 * @param items 明细行数组（formData.items 或 dynamicTableData.items）
 * @param usePrepayment 使用预付款（formData.use_prepayment_amount）
 * @param fallback 明细不可用时的保留值，通常传当前 formData 上的 order_amount / payable_amount
 * @param opts.allowFallback 明细为空时是否沿用 fallback。
 *   编辑态传 true：详情接口失败降级为列表行数据时明细数组为空，此时必须保留后端返回的
 *   主单金额，否则会把真实金额覆盖成 0.00；新增态不传，空明细就是 0.00。
 */
export function computePurchaseOrderAmounts(
  items: unknown,
  usePrepayment: unknown,
  fallback: PurchaseOrderAmountFallback = {},
  opts: { allowFallback?: boolean } = {},
): PurchaseOrderAmounts {
  const rows = Array.isArray(items) ? items : []
  const giftAmount = lineGiftTotalOf(rows)
  const orderFallback = moneyText(fallback.order)
  const payableFallback = moneyText(fallback.payable)

  /** 明细口径不可信时整体沿用后端原值（赠送合计仍按当前行现算，供提示文案使用） */
  const keepFallback = (): PurchaseOrderAmounts => ({
    orderAmountText: orderFallback,
    payableAmountText: payableFallback,
    giftAmountText: giftAmount.toFixed(2),
    orderAmount: toAmountNumber(orderFallback),
    payableAmount: toAmountNumber(payableFallback),
    negative: false,
    redacted: true,
  })

  // 空明细：新增态是 0.00（正确），编辑态多半是详情未就绪，不能抹掉后端金额
  if (rows.length === 0 && opts.allowFallback) return keepFallback()

  let orderAmount = 0
  for (const row of rows) {
    const amount = lineAmountOf(row as Record<string, any>)
    // 一行缺字段即视为整单口径不可信（同一接口裁剪是整列生效），整体沿用原值
    if (amount === null) return keepFallback()
    orderAmount += amount
  }
  orderAmount = roundHalfUp2(orderAmount)

  const prepayment = roundHalfUp2(Math.max(toAmountNumber(usePrepayment), 0))
  const rawPayable = roundHalfUp2(orderAmount - giftAmount - prepayment)
  const negative = rawPayable < 0

  return {
    orderAmountText: orderAmount.toFixed(2),
    payableAmountText: (negative ? 0 : rawPayable).toFixed(2),
    giftAmountText: giftAmount.toFixed(2),
    orderAmount,
    payableAmount: negative ? 0 : rawPayable,
    negative,
    redacted: false,
  }
}

/** 后端返回的行金额快照（`items[].amount`），缺失或非数字返回 NaN。 */
function backendLineAmount(row: Record<string, any>): number {
  const raw = row?.amount
  if (raw === null || raw === undefined || raw === '') return NaN
  const n = Number(raw)
  return Number.isFinite(n) ? n : NaN
}

/**
 * 明细「总原价」= 采购单价 × 采购数量，**始终实时现算**。
 *
 * 不优先读 `row.amount`：那是后端保存时的快照，编辑态改完单价/数量后它不会变，
 * 会和上方实时汇总的订单金额对不上。
 */
export function lineGrossText(row: Record<string, any>): string {
  const amount = lineAmountOf(row)
  if (amount === null) return moneyText(row?.amount)
  return amount.toFixed(2)
}

/**
 * 明细「总应支付价」。
 *
 * 后端 `payable_amount` 是「分摊抹零后的明细应付」，当前采购订单页面不录入抹零
 * （`rounding_amount` 恒为 0），正常情况下等于行金额。因此：
 * - 行金额与后端快照一致（用户没改单价/数量）→ 沿用后端分摊结果，历史单不因前端重算而变化；
 * - 行金额已被用户改动（快照对不上）→ 快照已失效，按新金额现算。
 */
export function linePayableText(row: Record<string, any>): string {
  const amount = lineAmountOf(row)
  if (amount === null) return moneyText(row?.payable_amount)
  const backendAmount = backendLineAmount(row)
  const backendPayable = row?.payable_amount
  const unchanged = Number.isFinite(backendAmount) && Math.abs(roundHalfUp2(backendAmount) - amount) < 0.005
  if (unchanged && backendPayable !== null && backendPayable !== undefined && backendPayable !== '') {
    return moneyText(backendPayable)
  }
  return amount.toFixed(2)
}

/** 明细「总优惠金额」= 总原价 − 总应支付价（与上面两列同源，避免三列互相打架）。 */
export function lineDiscountText(row: Record<string, any>): string {
  const gross = lineAmountOf(row)
  if (gross === null) {
    const amt = backendLineAmount(row)
    const pa = Number(row?.payable_amount)
    if (Number.isFinite(amt) && Number.isFinite(pa)) return roundHalfUp2(amt - pa).toFixed(2)
    return '0.00'
  }
  const payable = toAmountNumber(linePayableText(row))
  return roundHalfUp2(gross - payable).toFixed(2)
}
