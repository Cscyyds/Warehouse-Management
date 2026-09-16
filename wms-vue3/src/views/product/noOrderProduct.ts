/**
 * 「无来源单据产品选择」弹窗回传行。
 * 销售退货（无销售订单）/ 采购退货（无采购订单）共用，字段取自产品档案快照。
 */
export interface NoOrderProductRow {
  product_id: string
  product_code: string
  product_name: string
  category_name: string
  specification: string | null
  color: string | null
  unit_id: string
  unit_name: string
  /** 可用库存（已扣减采购退货预占量）；采购侧后端按此强校验退货数量 */
  available_stock: string
  return_qty: number
  return_price: number
}
