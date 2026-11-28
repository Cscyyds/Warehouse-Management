import type { Column } from '@/views/common/ListTemplate.vue'
import type { NativeDocKey, NativeHeaderRow } from '@/api/modules/productionNative'

export const NATIVE_BILL_PAGES = [
  { docKey: 'production-picking', title: '生产领料单', permissionTitle: '本地生产·领料单' },
  { docKey: 'production-return', title: '生产退料单', permissionTitle: '本地生产·退料单' },
  { docKey: 'finished-goods-stockin', title: '生产缴库单', permissionTitle: '本地生产·缴库单' },
] as const satisfies ReadonlyArray<{ docKey: NativeDocKey; title: string; permissionTitle: string }>

export const nativeBillPath = (docKey: NativeDocKey) => `/production/native/${docKey}`
export const nativePermission = (method: 'GET' | 'POST', docKey: NativeDocKey, action: string) =>
  `${method} /api/v1/tenant-production-native/${docKey}/${action}`

export function nativeBillColumns(docKey: NativeDocKey): Column[] {
  return [
    { prop: 'bill_no', label: '单据编号', minWidth: 175, sortable: true, priority: 'high' },
    { prop: 'bill_date', label: '单据日期', width: 125, sortable: true },
    ...(docKey === 'production-return' ? [{ prop: 'source_picking_no', label: '来源领料单号', minWidth: 165 }] : []),
    { prop: 'audit_status_name', label: '审核状态', width: 105 },
    { prop: 'warehouse_status_name', label: '仓库状态', width: 125 },
    { prop: 'business_status_name', label: '业务状态', width: 105 },
    { prop: 'created_by_name', label: '创建人', width: 110, sortable: true },
    { prop: 'created_at', label: '创建时间', width: 175, sortable: true },
    { prop: 'send_by_name', label: '发送人', width: 110, sortable: true },
    { prop: 'send_at', label: '发送时间', width: 175, sortable: true },
    { prop: 'version', label: '版本', width: 75, align: 'center' },
  ]
}

export type BillAction = 'approve' | 'reject' | 'unaudit' | 'send' | 'cancelSend' | 'delete'
export const BILL_ACTIONS = [
  { key: 'approve', label: '审核通过', endpoint: 'audit' },
  { key: 'reject', label: '驳回', endpoint: 'audit' },
  { key: 'unaudit', label: '反审核', endpoint: 'unaudit' },
  { key: 'send', label: '发送仓库', endpoint: 'warehouse/send' },
  { key: 'cancelSend', label: '撤销发送', endpoint: 'warehouse/cancel-send' },
  { key: 'delete', label: '删除', endpoint: 'delete' },
] as const

export function canRunBillAction(action: BillAction, bill: NativeHeaderRow): boolean {
  const flags = bill.allowed_actions
  if (!flags || bill.business_status !== 'NORMAL') return false
  switch (action) {
    case 'approve':
    case 'reject': return flags.can_audit === true
    case 'send': return flags.can_send === true
    case 'cancelSend': return flags.can_cancel_send === true
    case 'delete': return flags.can_edit === true
    case 'unaudit': return bill.audit_status === 1 && bill.warehouse_status === 0 && flags.can_append_items === true
  }
}
