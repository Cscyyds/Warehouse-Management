let preloadScheduled = false

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number
}

/**
 * Preload the most frequently used Agent pages after the initial UI becomes idle.
 * This keeps startup responsive while removing the first navigation's lazy-chunk delay.
 */
export function scheduleAgentPagePreload(): void {
  if (preloadScheduled || typeof window === 'undefined') return
  preloadScheduled = true

  const preload = () => {
    void Promise.allSettled([
      import('@/views/customer/CustomerInfo.vue'),
      import('@/views/purchase/PurchaseOrder.vue'),
      import('@/views/purchase/Supplier.vue'),
      import('@/views/purchase/PurchaseInbound.vue'),
      import('@/views/purchase/PurchaseReturn.vue'),
      import('@/views/purchase/PurchaseInboundDetail.vue'),
      import('@/views/system/Personnel.vue'),
      import('@/views/sales/SalesReturn.vue'),
      import('@/views/sales/SalesReportOrderDetail.vue'),
      import('@/views/sales/SalesReportProductSummary.vue'),
      import('@/views/purchase/SupplierBalance.vue'),
      import('@/views/product/ProductInfo.vue'),
      import('@/views/warehouse/WarehouseStock.vue'),
      import('@/views/delivery/DeliveryTask.vue'),
    ])
  }

  const idleWindow = window as IdleWindow
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(preload, { timeout: 2000 })
    return
  }

  window.setTimeout(preload, 600)
}
