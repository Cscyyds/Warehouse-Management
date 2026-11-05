/**
 * 借出借入四单据（天心 ERP 同步，ALL NEW 2026-10-30）列配置表。
 * 数据源：nuomi_wms/docs/本日接口变更_20260915.md 2026-10-30 17:00:33 批次
 *        + app/services/borrow/borrow_query_fields.py（白名单权威口径）。
 *
 * 与贸易（tradeDocConfig.ts）的差异（**不要照抄贸易列**）：
 * - docKey 与 URL 段不同名：borrow-in-order ↔ in-order 等（见 BORROW_DOC_META）；
 * - 明细无 free_id / name_eng / location_no（后端明细表无这些列）；
 * - 表头无 rem（备注）列；有 cls_id / est_dd / pay_dd / rep_bl_no / erp_lock_status；
 * - 往来单位：借入族（BN/BB）= 供应商，借出族（LN/LB）= 客户；
 * - 单据业务 ID 前缀 blh_（贸易为 txh_），详情入参仍叫 wms_bill_id。
 *
 * 通用字段（表头 erp_bill_no/erp_bill_date/synced_at/total_qty，
 * 明细 erp_item_seq/prd_no/prd_name/product_name）由页面组件统一前置/后置拼接。
 */

export interface BorrowColumn {
  prop: string
  label: string
  width?: number
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  priority?: 'high' | 'normal' | 'low'
  /** 仅详情页展示（列表序列化未返回该字段时置 true，避免列表出现恒空列） */
  detailOnly?: boolean
}

export interface BorrowDocConfig {
  docKey: string
  name: string
  headerSearchPlaceholder: string
  itemSearchPlaceholder: string
  headerColumns: BorrowColumn[]
  itemColumns: BorrowColumn[]
}

/** 单据标题（路由守卫 / 菜单 / 页签 / 详情页共用）。
 *  ⚠️ 同时是 pagePermissionMap / menuPermissionMap 的查找键，改名须与那两张表同步。
 *  2026-11-05：去掉「（天心）」后缀——本模块整族只在天心模式可见（导航级显隐 + 权限树
 *  REQUIRE_BORROW_ERP_SYNC 双重把关），标题再挂后缀是冗余信息。 */
export const BORROW_DOC_TITLES: Record<string, string> = {
  'borrow-in-order': '借入单',
  'borrow-in-return': '借入还出单',
  'lend-out-order': '借出单',
  'lend-out-return': '借出还入单',
}

/** docKey ↔ URL 段 ↔ 所属侧（失败记录/重启按 in|out 分侧，各管两线） */
export const BORROW_DOC_META: Record<string, { segment: string; side: 'in' | 'out' }> = {
  'borrow-in-order': { segment: 'in-order', side: 'in' },
  'borrow-in-return': { segment: 'in-return', side: 'in' },
  'lend-out-order': { segment: 'out-order', side: 'out' },
  'lend-out-return': { segment: 'out-return', side: 'out' },
}

/** docKey → 列表页路径（详情页「返回列表」回跳用） */
export const BORROW_DOC_LIST_PATH: Record<string, string> = {
  'borrow-in-order': '/borrow/in-order',
  'borrow-in-return': '/borrow/in-return',
  'lend-out-order': '/borrow/out-order',
  'lend-out-return': '/borrow/out-return',
}

/**
 * 筛选区**不展示**的表头字段（2026-11-05 逐字段核可用性后确定）。
 *
 * 判据 = 「筛了必空」或「筛了等于没筛」，两类都只影响筛选区，**不动列与排序**：
 *   - `total_qty` 数量合计 / `cls_date` 分类日期：借出借入报文虽有键但产品确认取不到值，
 *     搜了必空（用户首轮反馈的 5 个字段之一）；
 *   - `sal_no` 销售编号 / `usr` 操作者：天心借出借入单据不挂销售单、也不回传 WMS 操作者；
 *   - `bl_id` 单据别：恒等于单据代号（BN/BB/LN/LB，见后端 registry.py 的 bl_id），
 *     按它筛等于全选；页面上已另有「单据类别」；
 *   - `dep_name` 部门名称：天心 BL 族表头报文**没有 DEP_NAME 键**
 *     （阶段一方案 §2「表头字段（四单公共）」实测清单只有 DEP，无 DEP_NAME）
 *     ⇒ 后端 `_apply_hdr_columns` 恒写 NULL，筛了必空。
 */
export const BORROW_SEARCH_HIDDEN_FIELDS: readonly string[] = [
  'total_qty', 'sal_no', 'usr', 'cls_date', 'bl_id', 'dep_name',
]

/**
 * 单据级追加剔除（同一字段不是四单据都缺时用这里，避免误伤有数据的单据）：
 * BN/LN 表头报文**没有 BIL_TYPE 键**（BB/LB 才有，见阶段一方案 §2）⇒
 * 借入单/借出单的「单据类别」恒空、搜不到；借入还出单/借出还入单保留。
 */
export const BORROW_SEARCH_HIDDEN_BY_DOC: Record<string, readonly string[]> = {
  'borrow-in-order': ['bil_type'],
  'lend-out-order': ['bil_type'],
}

/**
 * 白名单 → 筛选区字段：剔除隐藏清单（族级 + 单据级），其余保持原顺序。
 * 抽成纯函数以便单测钉住（api/modules/borrow.ts 的白名单依赖 @/ 别名，跑不了裸 node）。
 */
export function borrowSearchFieldsOf(docKey: string, sortFields: readonly string[]): string[] {
  const hidden = new Set([...BORROW_SEARCH_HIDDEN_FIELDS, ...(BORROW_SEARCH_HIDDEN_BY_DOC[docKey] || [])])
  return sortFields.filter((f) => !hidden.has(f))
}

/* ── 借入单 BN（入库侧源头单）──────────────────────────────
 * 明细数量状态机：planned_in_stock_qty/in_stock_qty/actual_in_stock_qty（入库三列）、
 * pending_out_qty/out_qty（还出两列）、erp_qty_rtn（ERP 应还量，信息列） */
const HEADER_BN: BorrowColumn[] = [
  { prop: 'supplier_name', label: '供应商', minWidth: 150, sortable: true },
  { prop: 'employee_name', label: '经办人', width: 100, sortable: true },
  { prop: 'dep_name', label: '部门', width: 110, sortable: true },
  { prop: 'bil_type', label: '单据类别', width: 90, align: 'center', sortable: true },
  { prop: 'cls_id', label: '结案标记', width: 100, sortable: true },
  // ⚠️ est_dd / pay_dd：后端**列表序列化**（_serialize_hdr）未返回这两列，仅 detail 的
  // _serialize_full 返回 ⇒ 标记 detailOnly，列表不渲染（否则恒空列），详情正常展示。
  { prop: 'est_dd', label: '预定日期', width: 110, sortable: true, detailOnly: true },
  { prop: 'pay_dd', label: '付款日期', width: 110, sortable: true, detailOnly: true },
  { prop: 'warehouse_status', label: '仓库状态', width: 100, align: 'center', sortable: true },
  { prop: 'erp_lock_status', label: '锁单状态', width: 90, align: 'center', sortable: true },
]

const ITEM_BN: BorrowColumn[] = [
  { prop: 'spc', label: '规格', minWidth: 120 },
  { prop: 'prd_mark', label: '长度', width: 90 },
  { prop: 'qty', label: '数量', width: 90, align: 'right' },
  { prop: 'unit', label: '单位', width: 70, align: 'center' },
  { prop: 'wh', label: '仓库', width: 90 },
  { prop: 'planned_in_stock_qty', label: '预计入库量', width: 110, align: 'right' },
  { prop: 'in_stock_qty', label: '已入库量', width: 100, align: 'right' },
  { prop: 'actual_in_stock_qty', label: '实际入库量', width: 110, align: 'right' },
  { prop: 'pending_out_qty', label: '待还出量', width: 100, align: 'right' },
  { prop: 'out_qty', label: '已还出量', width: 100, align: 'right' },
  { prop: 'erp_qty_rtn', label: 'ERP 应还量', width: 110, align: 'right' },
  { prop: 'warehouse_task_status', label: '仓库任务状态', width: 120, align: 'center' },
  { prop: 'source_os_no', label: '来源单号', minWidth: 120, priority: 'low' },
  { prop: 'bat_no', label: '批号', width: 100, priority: 'low' },
  { prop: 'rem', label: '摘要', minWidth: 140, priority: 'low' },
]

/* ── 借入还出单 BB（导入即自动冲减借入待入库并联动 available）────── */
const HEADER_BB: BorrowColumn[] = [
  { prop: 'supplier_name', label: '供应商', minWidth: 150, sortable: true },
  { prop: 'employee_name', label: '经办人', width: 100, sortable: true },
  { prop: 'dep_name', label: '部门', width: 110, sortable: true },
  { prop: 'bil_type', label: '单据类别', width: 90, align: 'center', sortable: true },
  { prop: 'rep_bl_no', label: '还款计划单号', minWidth: 130, sortable: true },
  { prop: 'cls_id', label: '结案标记', width: 100, sortable: true },
  // ⚠️ est_dd / pay_dd：后端**列表序列化**（_serialize_hdr）未返回这两列，仅 detail 的
  // _serialize_full 返回 ⇒ 标记 detailOnly，列表不渲染（否则恒空列），详情正常展示。
  { prop: 'est_dd', label: '预定日期', width: 110, sortable: true, detailOnly: true },
  { prop: 'warehouse_status', label: '仓库状态', width: 100, align: 'center', sortable: true },
  { prop: 'erp_lock_status', label: '锁单状态', width: 90, align: 'center', sortable: true },
]

const ITEM_BB: BorrowColumn[] = [
  { prop: 'spc', label: '规格', minWidth: 120 },
  { prop: 'prd_mark', label: '长度', width: 90 },
  { prop: 'qty', label: '数量', width: 90, align: 'right' },
  { prop: 'unit', label: '单位', width: 70, align: 'center' },
  { prop: 'wh', label: '仓库', width: 90 },
  { prop: 'return_qty', label: '退回量', width: 90, align: 'right' },
  { prop: 'planned_return_qty', label: '预计退回量', width: 110, align: 'right' },
  { prop: 'deducted_receipt_qty', label: '已扣缴回量', width: 110, align: 'right' },
  { prop: 'converted_receipt_qty', label: '转缴回量', width: 100, align: 'right' },
  { prop: 'confirmed_release_qty', label: '确认释放量', width: 110, align: 'right' },
  { prop: 'actual_return_qty', label: '实际退回量', width: 110, align: 'right' },
  { prop: 'source_os_no', label: '来源单号', minWidth: 120, priority: 'low' },
  { prop: 'bat_no', label: '批号', width: 100, priority: 'low' },
  { prop: 'rem', label: '摘要', minWidth: 140, priority: 'low' },
]

/* ── 借出单 LN（导入即预扣 available）────────────────────── */
const HEADER_LN: BorrowColumn[] = [
  { prop: 'customer_name', label: '客户', minWidth: 150, sortable: true },
  { prop: 'employee_name', label: '经办人', width: 100, sortable: true },
  { prop: 'dep_name', label: '部门', width: 110, sortable: true },
  { prop: 'bil_type', label: '单据类别', width: 90, align: 'center', sortable: true },
  { prop: 'cls_id', label: '结案标记', width: 100, sortable: true },
  // ⚠️ est_dd / pay_dd：后端**列表序列化**（_serialize_hdr）未返回这两列，仅 detail 的
  // _serialize_full 返回 ⇒ 标记 detailOnly，列表不渲染（否则恒空列），详情正常展示。
  { prop: 'est_dd', label: '预定日期', width: 110, sortable: true, detailOnly: true },
  { prop: 'pay_dd', label: '付款日期', width: 110, sortable: true, detailOnly: true },
  { prop: 'warehouse_status', label: '仓库状态', width: 100, align: 'center', sortable: true },
  { prop: 'erp_lock_status', label: '锁单状态', width: 90, align: 'center', sortable: true },
]

const ITEM_LN: BorrowColumn[] = [
  { prop: 'spc', label: '规格', minWidth: 120 },
  { prop: 'prd_mark', label: '长度', width: 90 },
  { prop: 'qty', label: '数量', width: 90, align: 'right' },
  { prop: 'unit', label: '单位', width: 70, align: 'center' },
  { prop: 'wh', label: '仓库', width: 90 },
  { prop: 'pending_out_qty', label: '待出库量', width: 100, align: 'right' },
  { prop: 'actual_out_qty', label: '实际出库量', width: 110, align: 'right' },
  { prop: 'pending_return_qty', label: '待收回量', width: 100, align: 'right' },
  { prop: 'returned_qty', label: '已收回量', width: 100, align: 'right' },
  { prop: 'erp_qty_rtn', label: 'ERP 应还量', width: 110, align: 'right' },
  { prop: 'warehouse_task_status', label: '仓库任务状态', width: 120, align: 'center' },
  { prop: 'source_os_no', label: '来源单号', minWidth: 120, priority: 'low' },
  { prop: 'bat_no', label: '批号', width: 100, priority: 'low' },
  { prop: 'rem', label: '摘要', minWidth: 140, priority: 'low' },
]

/* ── 借出还入单 LB（导入生成 LEND_RETURN 入库条码）──────────── */
const HEADER_LB: BorrowColumn[] = [
  { prop: 'customer_name', label: '客户', minWidth: 150, sortable: true },
  { prop: 'employee_name', label: '经办人', width: 100, sortable: true },
  { prop: 'dep_name', label: '部门', width: 110, sortable: true },
  { prop: 'bil_type', label: '单据类别', width: 90, align: 'center', sortable: true },
  { prop: 'rep_bl_no', label: '还款计划单号', minWidth: 130, sortable: true },
  { prop: 'cls_id', label: '结案标记', width: 100, sortable: true },
  // ⚠️ est_dd / pay_dd：后端**列表序列化**（_serialize_hdr）未返回这两列，仅 detail 的
  // _serialize_full 返回 ⇒ 标记 detailOnly，列表不渲染（否则恒空列），详情正常展示。
  { prop: 'est_dd', label: '预定日期', width: 110, sortable: true, detailOnly: true },
  { prop: 'warehouse_status', label: '仓库状态', width: 100, align: 'center', sortable: true },
  { prop: 'erp_lock_status', label: '锁单状态', width: 90, align: 'center', sortable: true },
]

const ITEM_LB: BorrowColumn[] = [
  { prop: 'spc', label: '规格', minWidth: 120 },
  { prop: 'prd_mark', label: '长度', width: 90 },
  { prop: 'qty', label: '数量', width: 90, align: 'right' },
  { prop: 'unit', label: '单位', width: 70, align: 'center' },
  { prop: 'wh', label: '仓库', width: 90 },
  { prop: 'planned_return_qty', label: '预计收回量', width: 110, align: 'right' },
  { prop: 'in_stock_qty', label: '已入库量', width: 100, align: 'right' },
  { prop: 'actual_in_stock_qty', label: '实际入库量', width: 110, align: 'right' },
  { prop: 'deducted_out_qty', label: '已扣出库量', width: 110, align: 'right' },
  { prop: 'confirmed_release_qty', label: '确认释放量', width: 110, align: 'right' },
  { prop: 'source_os_no', label: '来源单号', minWidth: 120, priority: 'low' },
  { prop: 'bat_no', label: '批号', width: 100, priority: 'low' },
  { prop: 'rem', label: '摘要', minWidth: 140, priority: 'low' },
]

export const BORROW_DOC_CONFIG_MAP: Record<string, BorrowDocConfig> = {
  'borrow-in-order': {
    docKey: 'borrow-in-order',
    name: BORROW_DOC_TITLES['borrow-in-order'],
    headerSearchPlaceholder: '搜索表头字段（单号/供应商/经办人等）',
    itemSearchPlaceholder: '搜索明细字段（品号/品名/规格等）',
    headerColumns: HEADER_BN,
    itemColumns: ITEM_BN,
  },
  'borrow-in-return': {
    docKey: 'borrow-in-return',
    name: BORROW_DOC_TITLES['borrow-in-return'],
    headerSearchPlaceholder: '搜索表头字段（单号/供应商/还款计划单号等）',
    itemSearchPlaceholder: '搜索明细字段（品号/品名/规格等）',
    headerColumns: HEADER_BB,
    itemColumns: ITEM_BB,
  },
  'lend-out-order': {
    docKey: 'lend-out-order',
    name: BORROW_DOC_TITLES['lend-out-order'],
    headerSearchPlaceholder: '搜索表头字段（单号/客户/经办人等）',
    itemSearchPlaceholder: '搜索明细字段（品号/品名/规格等）',
    headerColumns: HEADER_LN,
    itemColumns: ITEM_LN,
  },
  'lend-out-return': {
    docKey: 'lend-out-return',
    name: BORROW_DOC_TITLES['lend-out-return'],
    headerSearchPlaceholder: '搜索表头字段（单号/客户/还款计划单号等）',
    itemSearchPlaceholder: '搜索明细字段（品号/品名/规格等）',
    headerColumns: HEADER_LB,
    itemColumns: ITEM_LB,
  },
}
