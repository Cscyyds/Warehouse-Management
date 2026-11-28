import type { MergePackageInboundTrace } from '@/api/modules/scannerMergePackage'

type InboundFields = Partial<{ [K in keyof MergePackageInboundTrace]: MergePackageInboundTrace[K] | null }> & {
  inbound_traces?: MergePackageInboundTrace[] | null
}

/** Prefer the complete trace array; older responses expose only individual fields. */
export function resolveInboundTraces(detail: InboundFields | null, listItem: InboundFields | null): MergePackageInboundTrace[] {
  if (detail?.inbound_traces?.length) return detail.inbound_traces
  if (listItem?.inbound_traces?.length) return listItem.inbound_traces

  const trace = {
    inbound_type: detail?.inbound_type || listItem?.inbound_type || '',
    inbound_biz_item_id: detail?.inbound_biz_item_id || listItem?.inbound_biz_item_id || '',
    inbound_doc_no: detail?.inbound_doc_no || listItem?.inbound_doc_no,
    inbound_item_no: detail?.inbound_item_no || listItem?.inbound_item_no,
    inbound_order_no: detail?.inbound_order_no || listItem?.inbound_order_no,
    inbound_partner_name: detail?.inbound_partner_name || listItem?.inbound_partner_name,
  }
  return trace.inbound_type || trace.inbound_doc_no || trace.inbound_order_no || trace.inbound_item_no ? [trace] : []
}
