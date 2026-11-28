export interface BusinessIntentAlternative {
  intent: string
  confidence: number
}

export interface BusinessIntentSlots {
  timeExpression?: string
  createdStart?: string
  createdEnd?: string
  supplierName?: string
  supplierCode?: string
  receiptNo?: string
  returnNo?: string
  warehouseStatus?: 0 | 1 | 2 | 3
  employeeName?: string
  employeeStatus?: 0 | 1
  salesReturnMethod?: 'RETURN_AND_REFUND' | 'RETURN_ONLY' | 'REFUND_ONLY'
  auditStatus?: 0 | 1 | 2 | 3
  salesRankBy?: 'quantity' | 'amount' | 'profit'
  productName?: string
  productCode?: string
  itemNo?: string
  productStatus?: 'ON_SALE' | 'OFF_SALE' | 'DISCONTINUED'
  customerName?: string
  inventoryKeyword?: string
  deliveryKeyword?: string
  deliveryStatus?: 'WAIT_LOAD' | 'LOADING' | 'WAIT_DEPARTURE' | 'DELIVERING' | 'FINISHED' | 'CANCELLED'
}

export interface BusinessIntent {
  version: 1
  intent:
    | 'purchase_order.query'
    | 'customer.query'
    | 'product.query'
    | 'inventory.query'
    | 'delivery_task.query'
    | 'supplier.query'
    | 'purchase_inbound.query'
    | 'purchase_return.query'
    | 'employee.query'
    | 'sales_return.query'
    | 'purchase_inbound_detail.query'
    | 'sales_order_detail.query'
    | 'product_sales_summary.query'
    | 'supplier_balance.query'
  operation: 'query'
  slots: BusinessIntentSlots
  requestedFields: string[]
  confidence: number
  alternatives: BusinessIntentAlternative[]
}

const purchaseOrderQueryPattern =
  /(?:采购|订购|订货|买).*(?:了什么|过什么|什么货|哪些货|哪些商品|哪些产品)|(?:什么货|哪些货|哪些商品|哪些产品).*(?:采购|订购|订货|买)/
const purchaseOrderExcludedPattern =
  /(?:客户|采购入库|入库|采购退货|退给供应商|供应商(?:资料|档案|类型|授信|余额)|采购管理)/
const explicitCustomerQueryPattern =
  /(?:查询|查一下|查找|看看|看一下|查看)(?:(.+?)的)?(?:正式)?客户(?:信息|资料|档案)/
const productQueryPattern = /(?:产品|商品)(?:信息|资料|档案)/
const supplierQueryPattern = /(?:供应商|供货商|厂家)(?:信息|资料|档案)/
const purchaseInboundQueryPattern = /(?:采购入库)(?:单|记录|情况)?/
const purchaseReturnQueryPattern = /(?:采购退货)(?:单|记录|情况)?|(?:退给供应商|退回供应商|供应商退货)/
const employeeQueryPattern = /(?:员工|职员|人员)(?:信息|资料|档案)/
const salesReturnQueryPattern = /(?:销售退货|客户退货|客退|客户把货退回来)/
const genericReturnOverviewPattern = /(?:退货)(?:单|记录|情况|概况|统计)?/
const purchaseInboundDetailQueryPattern = /(?:采购入库(?:单)?明细|入库商品明细|进了什么货|入了什么货|到了什么货|收了什么货)/
const salesOrderDetailQueryPattern = /(?:销售订单明细|销售商品明细|卖货明细|卖了什么|销售了什么|卖了哪些|销售了哪些)/
const productSalesSummaryQueryPattern = /(?:产品销售汇总|商品销售汇总|产品销量|商品销量|销量排行|卖得最好|卖得最多|卖得多|最畅销|销售额汇总|利润排行|汇总.*销售额)/
const supplierBalanceQueryPattern = /(?:供应商|供货商)(?:余额|往来)|(?:欠|还欠)(?:供应商|供货商)(?:多少钱|多少款)?/
const inventoryQueryPattern = /(?:库存|现货|还有多少货)|(?:仓库|库房).*(?:还有什么货|有什么货|有哪些货)/
const inventoryExcludedPattern = /(?:库存盘点|库位库存|出入库|库存流水)/
const deliveryTaskQueryPattern =
  /(?:配送任务|配送单|送货任务|出货|发货|出了什么货)|(?:哪些货|哪些订单|什么货).*(?:要送|配送)|(?:要送|配送).*(?:哪些货|哪些订单|什么货)/

function stripQueryPrefix(value: string): string {
  return value
    .replace(/^(?:请|麻烦)?(?:帮我)?(?:查询|查一下|查找|看看|看一下|查看|搜索|我想看一下|我想查一下|我想看|我想查)/, '')
    .trim()
}

function extractBusinessName(task: string, marker: RegExp): string | undefined {
  const value = extractBeforeMarker(task, marker)
  if (!value || /^(?:今天|昨天|最近|当前|全部|所有)$/.test(value)) return undefined
  return value.replace(/的$/g, '').trim() || undefined
}

function extractBeforeMarker(task: string, marker: RegExp): string | undefined {
  const match = marker.exec(task)
  if (!match || match.index <= 0) return undefined
  const value = stripQueryPrefix(task.slice(0, match.index))
    .replace(/(?:的|还有多少|还有|当前|现在)$/g, '')
    .trim()
  if (/^(?:仓库|仓库里|库房|库房里)$/.test(value)) return undefined
  return value || undefined
}

function resolveProductStatus(task: string): BusinessIntentSlots['productStatus'] {
  if (task.includes('在售')) return 'ON_SALE'
  if (task.includes('停售')) return 'OFF_SALE'
  if (task.includes('停产')) return 'DISCONTINUED'
  return undefined
}

function resolveDeliveryStatus(task: string): BusinessIntentSlots['deliveryStatus'] {
  const statuses: Array<[string, NonNullable<BusinessIntentSlots['deliveryStatus']>]> = [
    ['待装车', 'WAIT_LOAD'],
    ['装车中', 'LOADING'],
    ['待发车', 'WAIT_DEPARTURE'],
    ['配送中', 'DELIVERING'],
    ['已完成', 'FINISHED'],
    ['已取消', 'CANCELLED'],
  ]
  return statuses.find(([label]) => task.includes(label))?.[1]
}

function resolveInboundStatus(task: string): BusinessIntentSlots['warehouseStatus'] {
  if (task.includes('待入库')) return 0
  if (task.includes('已发送仓库')) return 1
  if (task.includes('仓库退回')) return 2
  if (task.includes('入库完成') || task.includes('已入库')) return 3
  return undefined
}

function resolveReturnStatus(task: string): BusinessIntentSlots['warehouseStatus'] {
  if (task.includes('待出库')) return 0
  if (task.includes('已出库')) return 1
  return undefined
}

function resolveAuditStatus(task: string): BusinessIntentSlots['auditStatus'] {
  if (task.includes('未审核')) return 0
  if (task.includes('审核通过') || task.includes('已审核')) return 1
  if (task.includes('反审核')) return 2
  if (task.includes('审核失败')) return 3
  return undefined
}

function resolveSalesReturnMethod(task: string): BusinessIntentSlots['salesReturnMethod'] {
  if (task.includes('退货退款')) return 'RETURN_AND_REFUND'
  if (task.includes('仅退货')) return 'RETURN_ONLY'
  if (task.includes('仅退款')) return 'REFUND_ONLY'
  return undefined
}

function resolveSupplierBalanceName(task: string): string | undefined {
  const match = task.match(/(.+?)的(?:供应商|供货商)(?:余额|往来)/)
  return match ? stripQueryPrefix(match[1]).trim() || undefined : undefined
}

function resolveSalesRankBy(task: string): BusinessIntentSlots['salesRankBy'] {
  if (task.includes('利润')) return 'profit'
  if (task.includes('销售额') || task.includes('销售金额')) return 'amount'
  return 'quantity'
}

function dateInWmsTimezone(now: Date, dayOffset: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const shifted = new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day) + dayOffset,
  ))
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function resolveTimeSlots(task: string, now: Date): BusinessIntentSlots {
  if (task.includes('昨天')) {
    const date = dateInWmsTimezone(now, -1)
    return { timeExpression: '昨天', createdStart: date, createdEnd: date }
  }
  if (task.includes('今天')) {
    const date = dateInWmsTimezone(now, 0)
    return { timeExpression: '今天', createdStart: date, createdEnd: date }
  }
  if (task.includes('最近')) {
    return {
      timeExpression: '最近',
      createdStart: dateInWmsTimezone(now, -6),
      createdEnd: dateInWmsTimezone(now, 0),
    }
  }
  return {}
}

/**
 * Resolve only high-confidence, closed-set WMS business wording locally.
 * Broad module requests and overlapping inbound/return semantics intentionally fall through.
 */
export function resolveLocalBusinessIntent(
  task: string,
  now: Date = new Date(),
): BusinessIntent | null {
  const normalizedTask = task.trim()
  if (!normalizedTask) return null

  const customerMatch = normalizedTask.match(explicitCustomerQueryPattern)
  if (customerMatch) {
    const customerName = customerMatch[1]?.trim()
    return {
      version: 1,
      intent: 'customer.query',
      operation: 'query',
      slots: customerName ? { customerName } : {},
      requestedFields: ['customers'],
      confidence: 0.97,
      alternatives: [],
    }
  }

  if (supplierQueryPattern.test(normalizedTask)) {
    return {
      version: 1,
      intent: 'supplier.query',
      operation: 'query',
      slots: {
        supplierName: extractBusinessName(normalizedTask, /(?:供应商|供货商|厂家)(?:信息|资料|档案)/),
      },
      requestedFields: ['suppliers'],
      confidence: 0.97,
      alternatives: [{ intent: 'customer.query', confidence: 0.08 }],
    }
  }

  if (employeeQueryPattern.test(normalizedTask)) {
    return {
      version: 1,
      intent: 'employee.query',
      operation: 'query',
      slots: {
        employeeName: extractBusinessName(normalizedTask, /(?:员工|职员|人员)(?:信息|资料|档案)/),
        employeeStatus: normalizedTask.includes('启用') ? 1 : normalizedTask.includes('禁用') ? 0 : undefined,
      },
      requestedFields: ['employees'],
      confidence: 0.98,
      alternatives: [{ intent: 'online_user.query', confidence: 0.08 }],
    }
  }

  if (purchaseInboundDetailQueryPattern.test(normalizedTask)) {
    return {
      version: 1,
      intent: 'purchase_inbound_detail.query',
      operation: 'query',
      slots: {
        ...resolveTimeSlots(normalizedTask, now),
        productName: extractBusinessName(normalizedTask, /(?:采购入库(?:单)?明细|入库商品明细)/),
        warehouseStatus: resolveInboundStatus(normalizedTask),
      },
      requestedFields: ['purchase_receipt_items'],
      confidence: 0.97,
      alternatives: [{ intent: 'purchase_inbound.query', confidence: 0.11 }],
    }
  }

  if (
    genericReturnOverviewPattern.test(normalizedTask)
    && !salesReturnQueryPattern.test(normalizedTask)
  ) {
    return {
      version: 1,
      intent: 'purchase_return.query',
      operation: 'query',
      slots: {
        ...resolveTimeSlots(normalizedTask, now),
        supplierName: extractBusinessName(normalizedTask, /(?:采购退货|退给供应商|退回供应商|供应商退货)/),
        warehouseStatus: resolveReturnStatus(normalizedTask),
      },
      requestedFields: ['purchase_returns'],
      confidence: purchaseReturnQueryPattern.test(normalizedTask) ? 0.98 : 0.91,
      alternatives: [{ intent: 'sales_return.query', confidence: 0.18 }],
    }
  }

  if (salesReturnQueryPattern.test(normalizedTask)) {
    return {
      version: 1,
      intent: 'sales_return.query',
      operation: 'query',
      slots: {
        ...resolveTimeSlots(normalizedTask, now),
        customerName: extractBusinessName(normalizedTask, /(?:销售退货|客户退货|客退)/),
        salesReturnMethod: resolveSalesReturnMethod(normalizedTask),
        auditStatus: resolveAuditStatus(normalizedTask),
      },
      requestedFields: ['sales_returns'],
      confidence: 0.97,
      alternatives: [{ intent: 'purchase_return.query', confidence: 0.08 }],
    }
  }

  if (salesOrderDetailQueryPattern.test(normalizedTask)) {
    return {
      version: 1,
      intent: 'sales_order_detail.query',
      operation: 'query',
      slots: {
        ...resolveTimeSlots(normalizedTask, now),
        productName: extractBusinessName(normalizedTask, /(?:销售订单明细|销售商品明细|卖货明细)/),
      },
      requestedFields: ['sales_order_items'],
      confidence: 0.98,
      alternatives: [{ intent: 'product_sales_summary.query', confidence: 0.1 }],
    }
  }

  if (productSalesSummaryQueryPattern.test(normalizedTask) && !/(?:今天|昨天|最近)/.test(normalizedTask)) {
    return {
      version: 1,
      intent: 'product_sales_summary.query',
      operation: 'query',
      slots: { salesRankBy: resolveSalesRankBy(normalizedTask) },
      requestedFields: ['product_sales_summary'],
      confidence: 0.97,
      alternatives: [{ intent: 'sales_order_detail.query', confidence: 0.08 }],
    }
  }

  if (supplierBalanceQueryPattern.test(normalizedTask)) {
    return {
      version: 1,
      intent: 'supplier_balance.query',
      operation: 'query',
      slots: { supplierName: resolveSupplierBalanceName(normalizedTask) },
      requestedFields: ['supplier_balances'],
      confidence: 0.98,
      alternatives: [{ intent: 'supplier.query', confidence: 0.08 }],
    }
  }

  if (purchaseReturnQueryPattern.test(normalizedTask)) {
    return {
      version: 1,
      intent: 'purchase_return.query',
      operation: 'query',
      slots: {
        ...resolveTimeSlots(normalizedTask, now),
        supplierName: extractBusinessName(normalizedTask, /(?:采购退货|退给供应商|退回供应商|供应商退货)/),
        warehouseStatus: resolveReturnStatus(normalizedTask),
      },
      requestedFields: ['purchase_returns'],
      confidence: 0.97,
      alternatives: [{ intent: 'sales_return.query', confidence: 0.1 }],
    }
  }

  if (purchaseInboundQueryPattern.test(normalizedTask)) {
    return {
      version: 1,
      intent: 'purchase_inbound.query',
      operation: 'query',
      slots: {
        ...resolveTimeSlots(normalizedTask, now),
        supplierName: extractBusinessName(normalizedTask, /采购入库/),
        warehouseStatus: resolveInboundStatus(normalizedTask),
      },
      requestedFields: ['purchase_receipts'],
      confidence: 0.97,
      alternatives: [{ intent: 'purchase_order.query', confidence: 0.1 }],
    }
  }

  if (productQueryPattern.test(normalizedTask) && !inventoryQueryPattern.test(normalizedTask)) {
    return {
      version: 1,
      intent: 'product.query',
      operation: 'query',
      slots: {
        productName: extractBeforeMarker(normalizedTask, /(?:产品|商品)(?:信息|资料|档案)/),
        productStatus: resolveProductStatus(normalizedTask),
      },
      requestedFields: ['products'],
      confidence: 0.96,
      alternatives: [{ intent: 'inventory.query', confidence: 0.1 }],
    }
  }

  if (inventoryQueryPattern.test(normalizedTask) && !inventoryExcludedPattern.test(normalizedTask)) {
    return {
      version: 1,
      intent: 'inventory.query',
      operation: 'query',
      slots: {
        inventoryKeyword: extractBeforeMarker(normalizedTask, /(?:库存|现货|还有多少货|还有什么货|有什么货|有哪些货)/),
      },
      requestedFields: ['inventory'],
      confidence: 0.97,
      alternatives: [],
    }
  }

  if (deliveryTaskQueryPattern.test(normalizedTask)) {
    return {
      version: 1,
      intent: 'delivery_task.query',
      operation: 'query',
      slots: {
        ...resolveTimeSlots(normalizedTask, now),
        deliveryStatus: resolveDeliveryStatus(normalizedTask),
      },
      requestedFields: ['delivery_tasks'],
      confidence: 0.97,
      alternatives: [{ intent: 'sales_order.query', confidence: 0.08 }],
    }
  }

  if (purchaseOrderExcludedPattern.test(normalizedTask)) return null
  if (!purchaseOrderQueryPattern.test(normalizedTask)) return null

  return {
    version: 1,
    intent: 'purchase_order.query',
    operation: 'query',
    slots: resolveTimeSlots(normalizedTask, now),
    requestedFields: ['products'],
    confidence: 0.96,
    alternatives: [{ intent: 'purchase_inbound.query', confidence: 0.12 }],
  }
}
