import type { BusinessIntent } from './businessIntent.ts'

export interface CompiledBusinessActionIntent {
  kind: 'business-action'
  pageId: string
  pageTitle: string
  agentPageId: string
  actionId: string
  args: Record<string, unknown>
}

export function compileBusinessIntent(
  intent: BusinessIntent,
): CompiledBusinessActionIntent | null {
  if (intent.intent === 'customer.query') {
    return {
      kind: 'business-action',
      pageId: 'customer.info',
      pageTitle: '客户资料',
      agentPageId: 'customer.info.list',
      actionId: 'customer.search',
      args: {
        ...(intent.slots.customerName ? { customerName: intent.slots.customerName } : {}),
        page: 1,
      },
    }
  }

  if (intent.intent === 'product.query') {
    return {
      kind: 'business-action',
      pageId: 'product.info',
      pageTitle: '产品资料',
      agentPageId: 'product.info.list',
      actionId: 'product.search',
      args: {
        ...(intent.slots.productName ? { productName: intent.slots.productName } : {}),
        ...(intent.slots.productCode ? { productCode: intent.slots.productCode } : {}),
        ...(intent.slots.itemNo ? { itemNo: intent.slots.itemNo } : {}),
        ...(intent.slots.productStatus ? { productStatus: intent.slots.productStatus } : {}),
        page: 1,
      },
    }
  }

  if (intent.intent === 'inventory.query') {
    return {
      kind: 'business-action',
      pageId: 'warehouse.stock',
      pageTitle: '产品库存',
      agentPageId: 'warehouse.stock.list',
      actionId: 'inventory.search',
      args: {
        ...(intent.slots.inventoryKeyword ? { keyword: intent.slots.inventoryKeyword } : {}),
        page: 1,
      },
    }
  }

  if (intent.intent === 'delivery_task.query') {
    return {
      kind: 'business-action',
      pageId: 'delivery.task',
      pageTitle: '配送任务',
      agentPageId: 'delivery.task.list',
      actionId: 'delivery-task.search',
      args: {
        ...(intent.slots.deliveryKeyword ? { keyword: intent.slots.deliveryKeyword } : {}),
        ...(intent.slots.deliveryStatus ? { status: intent.slots.deliveryStatus } : {}),
        ...(intent.slots.createdStart ? { departureStart: intent.slots.createdStart } : {}),
        ...(intent.slots.createdEnd ? { departureEnd: intent.slots.createdEnd } : {}),
        page: 1,
      },
    }
  }

  if (intent.intent === 'supplier.query') {
    return {
      kind: 'business-action',
      pageId: 'purchase.supplier',
      pageTitle: '供应商档案',
      agentPageId: 'purchase.supplier.list',
      actionId: 'supplier.search',
      args: {
        ...(intent.slots.supplierName ? { supplierName: intent.slots.supplierName } : {}),
        ...(intent.slots.supplierCode ? { supplierCode: intent.slots.supplierCode } : {}),
        page: 1,
      },
    }
  }

  if (intent.intent === 'purchase_inbound.query') {
    return {
      kind: 'business-action',
      pageId: 'purchase.inbound',
      pageTitle: '采购入库单',
      agentPageId: 'purchase.inbound.list',
      actionId: 'purchase-inbound.search',
      args: {
        ...(intent.slots.receiptNo ? { receiptNo: intent.slots.receiptNo } : {}),
        ...(intent.slots.supplierName ? { supplierName: intent.slots.supplierName } : {}),
        ...(intent.slots.warehouseStatus !== undefined ? { warehouseStatus: intent.slots.warehouseStatus } : {}),
        ...(intent.slots.createdStart ? { createdStart: intent.slots.createdStart } : {}),
        ...(intent.slots.createdEnd ? { createdEnd: intent.slots.createdEnd } : {}),
        page: 1,
      },
    }
  }

  if (intent.intent === 'purchase_return.query') {
    return {
      kind: 'business-action',
      pageId: 'purchase.return',
      pageTitle: '采购退货单',
      agentPageId: 'purchase.return.list',
      actionId: 'purchase-return.search',
      args: {
        ...(intent.slots.returnNo ? { returnNo: intent.slots.returnNo } : {}),
        ...(intent.slots.supplierName ? { supplierName: intent.slots.supplierName } : {}),
        ...(intent.slots.warehouseStatus !== undefined ? { warehouseStatus: intent.slots.warehouseStatus } : {}),
        ...(intent.slots.createdStart ? { createdStart: intent.slots.createdStart } : {}),
        ...(intent.slots.createdEnd ? { createdEnd: intent.slots.createdEnd } : {}),
        page: 1,
      },
    }
  }

  if (intent.intent === 'employee.query') {
    return {
      kind: 'business-action',
      pageId: 'system.personnel',
      pageTitle: '人事资料管理',
      agentPageId: 'system.personnel.list',
      actionId: 'employee.search',
      args: {
        ...(intent.slots.employeeName ? { employeeName: intent.slots.employeeName } : {}),
        ...(intent.slots.employeeStatus !== undefined ? { status: intent.slots.employeeStatus } : {}),
        page: 1,
      },
    }
  }

  if (intent.intent === 'sales_return.query') {
    return {
      kind: 'business-action',
      pageId: 'sales.return',
      pageTitle: '销售退货单',
      agentPageId: 'sales.return.list',
      actionId: 'sales-return.search',
      args: {
        ...(intent.slots.customerName ? { customerName: intent.slots.customerName } : {}),
        ...(intent.slots.salesReturnMethod ? { returnMethod: intent.slots.salesReturnMethod } : {}),
        ...(intent.slots.auditStatus !== undefined ? { auditStatus: intent.slots.auditStatus } : {}),
        ...(intent.slots.createdStart ? { createdStart: intent.slots.createdStart } : {}),
        ...(intent.slots.createdEnd ? { createdEnd: intent.slots.createdEnd } : {}),
        page: 1,
      },
    }
  }

  if (intent.intent === 'purchase_inbound_detail.query') {
    return {
      kind: 'business-action',
      pageId: 'purchase.report.inbound-detail',
      pageTitle: '采购入库单明细',
      agentPageId: 'purchase.inbound-detail.list',
      actionId: 'purchase-inbound-detail.search',
      args: {
        ...(intent.slots.supplierName ? { supplierName: intent.slots.supplierName } : {}),
        ...(intent.slots.productName ? { productName: intent.slots.productName } : {}),
        ...(intent.slots.warehouseStatus !== undefined ? { warehouseStatus: intent.slots.warehouseStatus } : {}),
        ...(intent.slots.createdStart ? { receiptStart: intent.slots.createdStart } : {}),
        ...(intent.slots.createdEnd ? { receiptEnd: intent.slots.createdEnd } : {}),
        page: 1,
      },
    }
  }

  if (intent.intent === 'sales_order_detail.query') {
    return {
      kind: 'business-action',
      pageId: 'sales.report.order-detail',
      pageTitle: '销售订单明细表',
      agentPageId: 'sales.order-detail.list',
      actionId: 'sales-order-detail.search',
      args: {
        ...(intent.slots.customerName ? { customerName: intent.slots.customerName } : {}),
        ...(intent.slots.productName ? { productName: intent.slots.productName } : {}),
        ...(intent.slots.productCode ? { productCode: intent.slots.productCode } : {}),
        ...(intent.slots.createdStart ? { createdStart: intent.slots.createdStart } : {}),
        ...(intent.slots.createdEnd ? { createdEnd: intent.slots.createdEnd } : {}),
        page: 1,
      },
    }
  }

  if (intent.intent === 'product_sales_summary.query') {
    return {
      kind: 'business-action',
      pageId: 'sales.report.product-summary',
      pageTitle: '产品销售汇总表',
      agentPageId: 'sales.product-summary.list',
      actionId: 'product-sales-summary.search',
      args: {
        ...(intent.slots.productName ? { productName: intent.slots.productName } : {}),
        ...(intent.slots.productCode ? { productCode: intent.slots.productCode } : {}),
        rankBy: intent.slots.salesRankBy ?? 'quantity',
        page: 1,
      },
    }
  }

  if (intent.intent === 'supplier_balance.query') {
    return {
      kind: 'business-action',
      pageId: 'purchase.report.supplier-balance',
      pageTitle: '供应商余额表',
      agentPageId: 'purchase.supplier-balance.list',
      actionId: 'supplier-balance.search',
      args: {
        ...(intent.slots.supplierName ? { supplierName: intent.slots.supplierName } : {}),
        page: 1,
      },
    }
  }

  if (intent.intent !== 'purchase_order.query') return null

  return {
    kind: 'business-action',
    pageId: 'purchase.order',
    pageTitle: '采购订单',
    agentPageId: 'purchase.order.list',
    actionId: 'purchase-order.search',
    args: {
      createdStart: intent.slots.createdStart,
      createdEnd: intent.slots.createdEnd,
      page: 1,
    },
  }
}
