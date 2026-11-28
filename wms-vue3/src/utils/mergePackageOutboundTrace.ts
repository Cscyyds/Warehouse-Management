export interface OutboundTrace {
  biz_item_id?: string | null
  outbound_type?: string | null
  outbound_doc_id?: string | null
  outbound_doc_no?: string | null
  outbound_item_no?: string | null
  outbound_partner_name?: string | null
}

const traceKeys = ['biz_item_id', 'outbound_type', 'outbound_doc_id', 'outbound_doc_no', 'outbound_item_no'] as const

/** 显式 null 保持详情口径；旧详情整组回退列表，同一绑定可补齐未提供的字段。 */
export function resolveOutboundTrace(detail: OutboundTrace | null, listItem: OutboundTrace | null): OutboundTrace | null {
  if (!detail || !traceKeys.some(key => Object.hasOwn(detail, key) && detail[key] !== undefined)) return listItem
  const trace: OutboundTrace = Object.fromEntries(traceKeys.map(key => [key, detail[key]]))
  // 往来单位当前仅列表提供；核实绑定身份后才补齐，避免混用两份不同的出库来源。
  const sameItem = !!detail.biz_item_id && detail.biz_item_id === listItem?.biz_item_id
  const sameDoc = !!detail.outbound_doc_id && detail.outbound_doc_id === listItem?.outbound_doc_id
  const compatible = (['biz_item_id', 'outbound_doc_id', 'outbound_type'] as const).every(
    key => !detail[key] || !listItem?.[key] || detail[key] === listItem[key],
  )
  if ((sameItem || sameDoc) && compatible) {
    for (const key of traceKeys) {
      if (detail[key] === undefined) trace[key] = listItem?.[key]
    }
  }
  if (Object.hasOwn(detail, 'outbound_partner_name')) trace.outbound_partner_name = detail.outbound_partner_name
  else if ((sameItem || sameDoc) && compatible) trace.outbound_partner_name = listItem?.outbound_partner_name
  return trace
}

export function hasOutboundTrace(trace: OutboundTrace | null): boolean {
  return !!trace && traceKeys.some(key => !!trace[key])
}
