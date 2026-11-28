import { getPurchaseOrderList, searchPurchaseOrders } from './purchase'
import { getSalesOrderListV2, searchSalesOrdersV2 } from './sales'
import { getCustomerOrderList, searchCustomerOrders } from './customerOrder'
import { buildSearchParams } from '@/utils/data'
import type { PdfDocKind } from '@/config/pdfExportOptions'

export interface PdfPreviewSample { id: string; no: string; partyName: string }

/** 设置页自动示例和手动选择器共用相同的列表顺序与字段映射。 */
export async function getPdfPreviewSamples(kind: PdfDocKind, options: { page?: number; page_size?: number; keyword?: string } = {}) {
  const params = { page: options.page ?? 1, page_size: options.page_size ?? 20, sort_by: 'created_at', sort_order: 'DESC' }
  const query = options.keyword?.trim()
  const config = { silent: true }
  if (kind === 'purchase') {
    const result = query ? await searchPurchaseOrders({ ...params, ...buildSearchParams({ order_no: query }) }, config)
      : await getPurchaseOrderList(params, config)
    return { items: result.data.purchase_order.map(row => ({ id: row.purchase_order_id, no: row.order_no, partyName: row.supplier_name })), total: result.data.total }
  }
  if (kind === 'sales') {
    const result = query ? await searchSalesOrdersV2({ ...params, ...buildSearchParams({ sales_order_no: query }) }, config)
      : await getSalesOrderListV2(params, config)
    return { items: result.data.sales_orders.map(row => ({ id: row.sales_order_id, no: row.sales_order_no, partyName: row.customer_name })), total: result.data.total }
  }
  const result = query ? await searchCustomerOrders({ ...params, ...buildSearchParams({ order_no: query }) }, config)
    : await getCustomerOrderList(params, config)
  return { items: result.data.customer_orders.map(row => ({ id: row.customer_order_id, no: row.order_no, partyName: row.customer_name })), total: result.data.total }
}

export async function getFirstPdfPreviewSample(kind: PdfDocKind): Promise<PdfPreviewSample | null> {
  const result = await getPdfPreviewSamples(kind, { page: 1, page_size: 1 })
  return result.items[0] || null
}
