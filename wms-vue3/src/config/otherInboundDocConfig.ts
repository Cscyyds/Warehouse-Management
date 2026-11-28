/**
 * 其他入库单 XC（天心 ERP 同步，ALL NEW 2026-11-18）列配置表。
 * 数据源：nuomi_wms/app/api/v1/endpoints/tenant_other_inbound_management.py
 *        + app/services/other_inbound/other_inbound_query_fields.py（白名单权威口径）。
 *
 * 与贸易/借出借入的差异（**不要照抄列**）：
 * - 单单据单管线：docKey 恒 'other-inbound'，URL 无单据段（segment 为空串），side 恒 'all'；
 * - 表头排序白名单只有 created_at / warehouse_send_at / erp_bill_date（R28 独立定义），
 *   其余列一律不标 sortable（组件公共列的 sortable 也按白名单收敛）；
 * - 明细键名走 XC 序列化原键：specification / unit_name（非借出的 spc / unit）；
 *   prd_no / prd_name / erp_item_seq / wms_bill_id 由 api/modules/otherInbound.ts 归一化别名；
 * - 长度字段组：length_text（解析文本，脏值/单位缺失为 null）+ prd_mark（ERP 原文）；
 * - 无供应商/客户列（XC 无往来单位）；erp_lock_status 标 detailOnly——列表公共后缀
 *   已拼锁单状态列，避免重复（详情描述区无公共锁单项，由本列补齐）。
 *
 * 通用字段（表头 erp_bill_no/erp_bill_date/erp_lock_status/total_qty/synced_at，
 * 明细 erp_item_seq/prd_no/prd_name/产品档案/warehouse_no/warehouse_name）由页面组件统一拼接。
 */

export interface OtherInboundColumn {
  prop: string
  label: string
  width?: number
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  priority?: 'high' | 'normal' | 'low'
  /** 仅详情页展示（列表公共列已覆盖或列表序列化未返回时置 true） */
  detailOnly?: boolean
}

export interface OtherInboundDocConfig {
  docKey: string
  name: string
  headerSearchPlaceholder: string
  itemSearchPlaceholder: string
  headerColumns: OtherInboundColumn[]
  itemColumns: OtherInboundColumn[]
}

/** 单据标题（路由守卫 / 菜单 / 页签 / 详情页共用）。
 *  ⚠️ 同时是 pagePermissionMap / menuPermissionMap 的查找键，改名须与那两张表同步。
 *  整族只在天心模式可见（导航级显隐 + 权限树 REQUIRE_OTHER_INBOUND_ERP_SYNC 双重把关），
 *  标题不挂「（天心）」后缀，与借出借入 2026-11-05 口径一致。 */
export const OTHER_INBOUND_DOC_TITLES: Record<string, string> = {
  'other-inbound': '其他入库单',
}

/** docKey ↔ URL 段 ↔ 所属侧（单管线：URL 无单据段/侧段，segment 恒空串） */
export const OTHER_INBOUND_DOC_META: Record<string, { segment: string; side: 'all' }> = {
  'other-inbound': { segment: '', side: 'all' },
}

/** docKey → 列表页路径（详情页「返回列表」回跳用） */
export const OTHER_INBOUND_DOC_LIST_PATH: Record<string, string> = {
  'other-inbound': '/other-inbound',
}

const HEADER_XC: OtherInboundColumn[] = [
  { prop: 'ij_reason_text', label: '入库原因', minWidth: 120 },
  { prop: 'dep_name', label: '部门', width: 110 },
  { prop: 'employee_name', label: '经办人', width: 100 },
  { prop: 'chk_man', label: '审核人', width: 100 },
  { prop: 'bil_type', label: '单据类别', width: 90, align: 'center' },
  { prop: 'warehouse_status', label: '仓库状态', width: 100, align: 'center' },
  // 发送时间 = 后端 send_at 的归一化别名（排序白名单成员，prop 必须用 warehouse_send_at）
  { prop: 'warehouse_send_at', label: '发送时间', width: 160, sortable: true },
  { prop: 'rem', label: '备注', minWidth: 140, priority: 'low' },
  { prop: 'erp_lock_status', label: '锁单状态', width: 90, align: 'center', detailOnly: true },
]

const ITEM_XC: OtherInboundColumn[] = [
  { prop: 'specification', label: '规格', minWidth: 120 },
  { prop: 'unit_name', label: '单位', width: 70, align: 'center' },
  { prop: 'wh', label: '仓库', width: 90 },
  { prop: 'qty', label: '数量', width: 90, align: 'right' },
  { prop: 'planned_in_stock_qty', label: '预计入库量', width: 110, align: 'right' },
  { prop: 'in_stock_qty', label: '待入库量', width: 100, align: 'right' },
  { prop: 'actual_in_stock_qty', label: '实际入库量', width: 110, align: 'right' },
  { prop: 'warehouse_task_status', label: '仓库任务状态', width: 120, align: 'center' },
  { prop: 'length_text', label: '长度', width: 90 },
  { prop: 'prd_mark', label: '长度原文', width: 100 },
  { prop: 'bat_no', label: '批号', width: 100, priority: 'low' },
  { prop: 'rem', label: '摘要', minWidth: 140, priority: 'low' },
]

export const OTHER_INBOUND_DOC_CONFIG_MAP: Record<string, OtherInboundDocConfig> = {
  'other-inbound': {
    docKey: 'other-inbound',
    name: OTHER_INBOUND_DOC_TITLES['other-inbound'],
    headerSearchPlaceholder: '搜索表头字段（单号/品号/品名/部门等）',
    itemSearchPlaceholder: '搜索明细字段（品号/品名/规格/批号等）',
    headerColumns: HEADER_XC,
    itemColumns: ITEM_XC,
  },
}