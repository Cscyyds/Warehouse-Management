/**
 * 贸易数据（租客侧，天心 ERP 同步）4 类单据的列配置表。
 * 数据源：nuomi_wms/docs/19_天心侧接口前端对接文档_生产与贸易.md §2.2.2 / §2.2.5。
 *
 * 约定：
 * - headerColumns / itemColumns 只登记「映射区」字段；公共字段
 *   （表头 erp_bill_no/erp_bill_date/synced_at/total_qty，
 *     明细 erp_item_seq/prd_no/prd_name/product_name/location_no）由页面组件统一前置/后置拼接。
 * - 结构兼容 ListTemplate 的 Column（prop/label/width/minWidth/align/sortable/priority）。
 * - 排序/搜索字段必须落在 trade.ts 的白名单内；黑名单字段不出现在列配置中。
 */

export interface TradeColumn {
  prop: string
  label: string
  width?: number
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  priority?: 'high' | 'normal' | 'low'
}

export interface TradeDocConfig {
  docKey: string
  name: string
  /** 表头多字段搜索的默认 placeholder */
  headerSearchPlaceholder: string
  /** 明细多字段搜索的默认 placeholder */
  itemSearchPlaceholder: string
  headerColumns: TradeColumn[]
  itemColumns: TradeColumn[]
}

/* ── 进货单 PC ─────────────────────────────────────────── */

const HEADER_PC: TradeColumn[] = [
  { prop: 'supplier_name', label: '供应商', minWidth: 150, sortable: true },
  { prop: 'employee_name', label: '经办人', width: 100, sortable: true },
  { prop: 'dep_name', label: '部门', width: 110, sortable: true },
  { prop: 'bil_type', label: '单据类别', width: 90, align: 'center', sortable: true },
  { prop: 'source_os_no', label: '来源单号', minWidth: 130, sortable: true },
  { prop: 'warehouse_status', label: '仓库状态', width: 100, align: 'center', sortable: true },
  { prop: 'rem', label: '备注', minWidth: 140, priority: 'low', sortable: true },
]

const ITEM_PC: TradeColumn[] = [
  { prop: 'spc', label: '规格', minWidth: 120 },
  { prop: 'prd_mark', label: '长度', width: 90 },
  { prop: 'qty', label: '数量', width: 90, align: 'right' },
  { prop: 'unit', label: '单位', width: 70, align: 'center' },
  { prop: 'wh', label: '仓库', width: 90 },
  { prop: 'planned_in_stock_qty', label: '预计入库量', width: 110, align: 'right' },
  { prop: 'in_stock_qty', label: '已入库量', width: 100, align: 'right' },
  { prop: 'actual_in_stock_qty', label: '实际入库量', width: 110, align: 'right' },
  { prop: 'warehouse_task_status', label: '仓库任务状态', width: 120, align: 'center' },
  { prop: 'pending_out_qty', label: '待出库量', width: 100, align: 'right' },
  { prop: 'out_qty', label: '已出库量', width: 100, align: 'right' },
  { prop: 'bat_no', label: '批号', width: 100, priority: 'low' },
  { prop: 'rem', label: '摘要', minWidth: 140, priority: 'low' },
]

/* ── 进货退回单 PB ─────────────────────────────────────── */

const HEADER_PB: TradeColumn[] = [
  { prop: 'supplier_name', label: '供应商', minWidth: 150, sortable: true },
  { prop: 'employee_name', label: '经办人', width: 100, sortable: true },
  { prop: 'dep_name', label: '部门', width: 110, sortable: true },
  { prop: 'bil_type', label: '单据类别', width: 90, align: 'center', sortable: true },
  { prop: 'source_os_no', label: '来源单号', minWidth: 130, sortable: true },
  { prop: 'apply_os_no', label: '申请单号', minWidth: 130, sortable: true },
  { prop: 'warehouse_status', label: '仓库状态', width: 100, align: 'center', sortable: true },
  { prop: 'rem', label: '备注', minWidth: 140, priority: 'low', sortable: true },
]

const ITEM_PB: TradeColumn[] = [
  { prop: 'spc', label: '规格', minWidth: 120 },
  { prop: 'prd_mark', label: '长度', width: 90 },
  { prop: 'qty', label: '数量', width: 90, align: 'right' },
  { prop: 'unit', label: '单位', width: 70, align: 'center' },
  { prop: 'wh', label: '仓库', width: 90 },
  { prop: 'return_qty', label: '退回量', width: 90, align: 'right' },
  { prop: 'planned_return_qty', label: '预计退回量', width: 110, align: 'right' },
  { prop: 'deducted_receipt_qty', label: '已扣缴回量', width: 110, align: 'right' },
  { prop: 'confirmed_release_qty', label: '确认释放量', width: 110, align: 'right' },
  { prop: 'converted_receipt_qty', label: '转缴回量', width: 100, align: 'right' },
  { prop: 'actual_return_qty', label: '实际退回量', width: 110, align: 'right' },
  { prop: 'bat_no', label: '批号', width: 100, priority: 'low' },
  { prop: 'rem', label: '摘要', minWidth: 140, priority: 'low' },
]

/* ── 销货单 SA ─────────────────────────────────────────── */

const HEADER_SA: TradeColumn[] = [
  { prop: 'customer_name', label: '客户', minWidth: 150, sortable: true },
  { prop: 'employee_name', label: '经办人', width: 100, sortable: true },
  { prop: 'dep_name', label: '部门', width: 110, sortable: true },
  { prop: 'bil_type', label: '单据类别', width: 90, align: 'center', sortable: true },
  { prop: 'transfer_os_no', label: '转传单号', minWidth: 130, sortable: true },
  { prop: 'ck_cls_id', label: '出库类别', width: 100, sortable: true },
  { prop: 'warehouse_status', label: '仓库状态', width: 100, align: 'center', sortable: true },
  { prop: 'rem', label: '备注', minWidth: 140, priority: 'low', sortable: true },
]

const ITEM_SA: TradeColumn[] = [
  { prop: 'spc', label: '规格', minWidth: 120 },
  { prop: 'prd_mark', label: '长度', width: 90 },
  { prop: 'qty', label: '数量', width: 90, align: 'right' },
  { prop: 'unit', label: '单位', width: 70, align: 'center' },
  { prop: 'wh', label: '仓库', width: 90 },
  { prop: 'ck_no', label: '出库单号', minWidth: 120 },
  { prop: 'ship_status', label: '出货状态', width: 100, align: 'center' },
  { prop: 'pending_out_qty', label: '待出库量', width: 100, align: 'right' },
  { prop: 'actual_out_qty', label: '实际出库量', width: 110, align: 'right' },
  { prop: 'pending_return_qty', label: '待退回量', width: 100, align: 'right' },
  { prop: 'returned_qty', label: '已退回量', width: 100, align: 'right' },
  { prop: 'warehouse_task_status', label: '仓库任务状态', width: 120, align: 'center' },
  { prop: 'bat_no', label: '批号', width: 100, priority: 'low' },
  { prop: 'rem', label: '摘要', minWidth: 140, priority: 'low' },
]

/* ── 销货退回单 SB ─────────────────────────────────────── */

const HEADER_SB: TradeColumn[] = [
  { prop: 'customer_name', label: '客户', minWidth: 150, sortable: true },
  { prop: 'employee_name', label: '经办人', width: 100, sortable: true },
  { prop: 'dep_name', label: '部门', width: 110, sortable: true },
  { prop: 'bil_type', label: '单据类别', width: 90, align: 'center', sortable: true },
  { prop: 'transfer_os_no', label: '转传单号', minWidth: 130, sortable: true },
  { prop: 'warehouse_status', label: '仓库状态', width: 100, align: 'center', sortable: true },
  { prop: 'rem', label: '备注', minWidth: 140, priority: 'low', sortable: true },
]

const ITEM_SB: TradeColumn[] = [
  { prop: 'spc', label: '规格', minWidth: 120 },
  { prop: 'prd_mark', label: '长度', width: 90 },
  { prop: 'qty', label: '数量', width: 90, align: 'right' },
  { prop: 'unit', label: '单位', width: 70, align: 'center' },
  { prop: 'wh', label: '仓库', width: 90 },
  { prop: 'so_os_no', label: '销货单号', minWidth: 120 },
  { prop: 'planned_return_qty', label: '预计退回量', width: 110, align: 'right' },
  { prop: 'in_stock_qty', label: '已入库量', width: 100, align: 'right' },
  { prop: 'actual_in_stock_qty', label: '实际入库量', width: 110, align: 'right' },
  { prop: 'deducted_out_qty', label: '已扣出库量', width: 110, align: 'right' },
  { prop: 'confirmed_release_qty', label: '确认释放量', width: 110, align: 'right' },
  { prop: 'bat_no', label: '批号', width: 100, priority: 'low' },
  { prop: 'rem', label: '摘要', minWidth: 140, priority: 'low' },
]

/* ── 模式驱动的同页切换：WMS 页面 ↔ 天心单据 ─────────────────
 * 天心贸易模式（purchase_sales_mode=TIANXIN）下，下面 4 个 WMS 采购/销售页面
 * 不跳转新页面，而是就地切换为天心侧数据（走 /tenant-trade/*）：
 *   表格数据、查询条件、详情入口都跟着切换；NATIVE 模式保持 WMS 原样。
 *
 * 承载页对应关系（★ 2026-09-21 修正：天心侧**采购只涉及采购订单与采购退货单**，
 * 采购入库单不涉及；原先误把「进货单」挂在采购入库单页，已纠正）：
 *   PC 进货单     ↔ WMS **采购订单**   （/purchase/order）
 *   PB 进货退回单 ↔ WMS 采购退货单     （/purchase/return）
 *   SA 销货单     ↔ WMS 销售订单       （/sales/order）
 *   SB 销货退回单 ↔ WMS 销售退货单     （/sales/return）
 *
 * 消费方：
 *   - router 守卫（`router/index.ts` 的 `effectiveTitle`）：天心模式下按天心标题做页面级权限判定；
 *   - MainLayout（`isMenuVisible` 的菜单可见性判定 + `resolveTabTitle` 的标签标题）；
 *   - 4 个页面组件（`TradeBillList` 的 `v-if` 开关）；
 *   - TradeBillDetail（按 docKey 反查列表页做「返回列表」）。
 *
 * ⚠️ **不存在独立的「贸易数据」导航**：天心单据不新建业务模块，
 * 就挂在「采购管理」「销售管理」之下、由上述 4 个既有页面就地切换数据源。
 */
export interface TradeSharedPage {
  /** 天心单据 docKey（TRADE_DOCS 之一） */
  docKey: 'purchase-order' | 'purchase-return' | 'sales-order' | 'sales-return'
  /** 天心模式下页面/菜单/标签的显示名 */
  title: string
}

/**
 * WMS 共享页面路径 → 天心单据（键为路由 path）。
 *
 * ⚠️ 改这里的键会同时影响：路由守卫的模式标题判定、MainLayout 的菜单/标签、
 * `/trade/<docKey>` 兼容重定向（router 自动生成）、`TRADE_DOC_LIST_PATH`（详情页回跳）。
 */
export const TRADE_SHARED_PAGES: Record<string, TradeSharedPage> = {
  '/purchase/order': { docKey: 'purchase-order', title: '进货单' },
  '/purchase/return': { docKey: 'purchase-return', title: '进货退回单' },
  '/sales/order': { docKey: 'sales-order', title: '销货单' },
  '/sales/return': { docKey: 'sales-return', title: '销货退回单' },
}

/** 天心单据 docKey → 列表页路径（详情页「返回列表」回跳用） */
export const TRADE_DOC_LIST_PATH: Record<string, string> = Object.fromEntries(
  Object.entries(TRADE_SHARED_PAGES).map(([path, page]) => [page.docKey, path]),
)

/* ── 配置映射 ─────────────────────────────────────────── */

export const TRADE_DOC_CONFIG_MAP: Record<string, TradeDocConfig> = {
  'purchase-order': {
    docKey: 'purchase-order',
    name: '进货单',
    headerSearchPlaceholder: '搜索表头字段（单号/供应商/经办人等）',
    itemSearchPlaceholder: '搜索明细字段（品号/品名/规格等）',
    headerColumns: HEADER_PC,
    itemColumns: ITEM_PC,
  },
  'purchase-return': {
    docKey: 'purchase-return',
    name: '进货退回单',
    headerSearchPlaceholder: '搜索表头字段（单号/供应商/申请单号等）',
    itemSearchPlaceholder: '搜索明细字段（品号/品名/规格等）',
    headerColumns: HEADER_PB,
    itemColumns: ITEM_PB,
  },
  'sales-order': {
    docKey: 'sales-order',
    name: '销货单',
    headerSearchPlaceholder: '搜索表头字段（单号/客户/经办人等）',
    itemSearchPlaceholder: '搜索明细字段（品号/品名/规格等）',
    headerColumns: HEADER_SA,
    itemColumns: ITEM_SA,
  },
  'sales-return': {
    docKey: 'sales-return',
    name: '销货退回单',
    headerSearchPlaceholder: '搜索表头字段（单号/客户/转传单号等）',
    itemSearchPlaceholder: '搜索明细字段（品号/品名/规格等）',
    headerColumns: HEADER_SB,
    itemColumns: ITEM_SB,
  },
}
