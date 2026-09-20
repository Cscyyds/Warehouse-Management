/**
 * 生产管理（租客侧）13 类单据的列配置表。
 * 数据源：nuomi_wms/docs/17_WMS前端接入生产管理接口操作文档.md 第五章字段字典。
 *
 * 约定：
 * - headerColumns / itemColumns 只登记「映射区」字段；公共字段
 *   （表头 erp_bill_no/erp_bill_date/synced_at/item_count/total_qty，
 *     明细 erp_item_seq/product/erp_deleted）由页面组件统一前置/后置拼接。
 * - 结构兼容 ListTemplate 的 Column（prop/label/width/minWidth/align/sortable/priority）。
 * - 同构单据（生产领/退/补、非生产领/退、托工领/退/补）复用同一份列定义。
 */

export interface ProductionColumn {
  prop: string
  label: string
  width?: number
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  priority?: 'high' | 'normal' | 'low'
}

export interface ProductionDocConfig {
  docKey: string
  name: string
  /** 表头模糊搜索框 placeholder（写清搜索范围；后端不搜 ERP 单号） */
  headerSearchPlaceholder: string
  /** 明细模糊搜索框 placeholder */
  itemSearchPlaceholder: string
  headerColumns: ProductionColumn[]
  itemColumns: ProductionColumn[]
}

/* ── 同构单据共享列定义 ─────────────────────────────────────────── */

// 生产领料 / 退料 / 补料（ERP 单号 ML_NO）
const HEADER_ML: ProductionColumn[] = [
  { prop: 'dep', label: '生产部门', minWidth: 110 },
  { prop: 'bil_type', label: '单据类别', width: 90, align: 'center' },
  { prop: 'usr_no', label: '经办人', width: 90 },
  { prop: 'tz_no', label: '转入单号', minWidth: 120 },
  { prop: 'ml_id', label: '领退注记', width: 90 },
  { prop: 'rem', label: '备注', minWidth: 140, priority: 'low' },
]
const ITEM_ML: ProductionColumn[] = [
  { prop: 'mo_no', label: '制令单号', minWidth: 120 },
  { prop: 'mrp_no', label: '成品代号', minWidth: 110 },
  { prop: 'prd_no', label: '品号', minWidth: 120 },
  { prop: 'prd_name', label: '品名', minWidth: 160 },
  { prop: 'spc', label: '货品规格', minWidth: 120 },
  { prop: 'qty', label: '数量', width: 90, align: 'right' },
  { prop: 'qty_rsv', label: '应发量', width: 90, align: 'right' },
  { prop: 'qty_kl', label: '可领量', width: 90, align: 'right' },
  { prop: 'qty_wl', label: '未领量', width: 90, align: 'right' },
  { prop: 'qty_wh', label: '现存量', width: 90, align: 'right' },
  { prop: 'unit', label: '单位', width: 70, align: 'center' },
  { prop: 'wh', label: '仓库', width: 90 },
  { prop: 'prd_mark', label: '长度', width: 90 },
  { prop: 'usein_no', label: '组装位置', width: 100, priority: 'low' },
]

// 非生产领料 / 退料（ERP 单号 IJ_NO）
const HEADER_IJ: ProductionColumn[] = [
  { prop: 'bil_type', label: '单据类别', width: 90, align: 'center' },
  { prop: 'dep', label: '部门', minWidth: 110 },
  { prop: 'man_no', label: '经办人', width: 90 },
  { prop: 'ij_id', label: '注记', width: 90 },
  { prop: 'rem', label: '备注', minWidth: 140, priority: 'low' },
]
const ITEM_IJ: ProductionColumn[] = [
  { prop: 'prd_no', label: '品号', minWidth: 120 },
  { prop: 'prd_name', label: '品名', minWidth: 160 },
  { prop: 'spc', label: '货品规格', minWidth: 120 },
  { prop: 'qty', label: '数量', width: 90, align: 'right' },
  { prop: 'unit', label: '单位', width: 70, align: 'center' },
  { prop: 'wh', label: '仓库', width: 90 },
  { prop: 'prd_mark', label: '长度', width: 90 },
  { prop: 'rem', label: '摘要', minWidth: 140, priority: 'low' },
]

// 托工领料 / 退料 / 补料（ERP 单号 ML_NO）
const HEADER_OS: ProductionColumn[] = [
  { prop: 'cus_no', label: '厂商代号', minWidth: 110 },
  { prop: 'bil_type', label: '单据类别', width: 90, align: 'center' },
  { prop: 'usr_no', label: '经办人', width: 90 },
  { prop: 'tz_no', label: '转入单号', minWidth: 120 },
  { prop: 'ml_id', label: '领退注记', width: 90 },
  { prop: 'rem', label: '备注', minWidth: 140, priority: 'low' },
]
const ITEM_OS: ProductionColumn[] = [
  { prop: 'tz_no', label: '托工单号', minWidth: 120 },
  { prop: 'mrp_no', label: '成品代号', minWidth: 110 },
  { prop: 'prd_no', label: '品号', minWidth: 120 },
  { prop: 'prd_name', label: '品名', minWidth: 160 },
  { prop: 'spc', label: '货品规格', minWidth: 120 },
  { prop: 'qty', label: '数量', width: 90, align: 'right' },
  { prop: 'qty_rsv', label: '应发量', width: 90, align: 'right' },
  { prop: 'qty_kl', label: '可领量', width: 90, align: 'right' },
  { prop: 'qty_wl', label: '未领量', width: 90, align: 'right' },
  { prop: 'qty_wh', label: '现存量', width: 90, align: 'right' },
  { prop: 'unit', label: '单位', width: 70, align: 'center' },
  { prop: 'wh', label: '仓库', width: 90 },
  { prop: 'prd_mark', label: '长度', width: 90 },
  { prop: 'usein_no', label: '组装位置', width: 100, priority: 'low' },
]

/* ── 13 单据配置（顺序 = 菜单顺序）───────────────────────────────── */

export const PRODUCTION_DOC_CONFIGS: ProductionDocConfig[] = [
  {
    docKey: 'finished-goods-stockin',
    name: '成品缴库单',
    headerSearchPlaceholder: '搜索经办人员 / 备注',
    itemSearchPlaceholder: '搜索制令单号 / 品号 / 品名 / 仓库',
    headerColumns: [
      { prop: 'usr_no', label: '经办人员', width: 100 },
      { prop: 'rem', label: '备注', minWidth: 140, priority: 'low' },
    ],
    itemColumns: [
      { prop: 'mo_no', label: '制令单号', minWidth: 120 },
      { prop: 'cus_os_no', label: '客户订单号', minWidth: 120 },
      { prop: 'prd_no', label: '生产成品', minWidth: 120 },
      { prop: 'prd_name', label: '成品名称', minWidth: 160 },
      { prop: 'spc', label: '货品规格', minWidth: 120 },
      { prop: 'qty_mo', label: '应生产量', width: 100, align: 'right' },
      { prop: 'qty', label: '数量', width: 90, align: 'right' },
      { prop: 'unit', label: '单位', width: 70, align: 'center' },
      { prop: 'wh', label: '仓库', width: 90 },
      { prop: 'id_no', label: '配方号', width: 100, priority: 'low' },
      { prop: 'rem', label: '备注', minWidth: 140, priority: 'low' },
    ],
  },
  { docKey: 'production-picking', name: '生产领料单', headerSearchPlaceholder: '搜索部门 / 单据类别 / 经办人 / 备注', itemSearchPlaceholder: '搜索制令单号 / 品号 / 品名 / 仓库', headerColumns: HEADER_ML, itemColumns: ITEM_ML },
  { docKey: 'production-return', name: '生产退料单', headerSearchPlaceholder: '搜索部门 / 单据类别 / 经办人 / 备注', itemSearchPlaceholder: '搜索制令单号 / 品号 / 品名 / 仓库', headerColumns: HEADER_ML, itemColumns: ITEM_ML },
  { docKey: 'production-supplement', name: '生产补料单', headerSearchPlaceholder: '搜索部门 / 单据类别 / 经办人 / 备注', itemSearchPlaceholder: '搜索制令单号 / 品号 / 品名 / 仓库', headerColumns: HEADER_ML, itemColumns: ITEM_ML },
  { docKey: 'non-production-picking', name: '非生产领料单', headerSearchPlaceholder: '搜索单据类别 / 部门 / 经办人 / 备注', itemSearchPlaceholder: '搜索品号 / 品名 / 规格 / 仓库', headerColumns: HEADER_IJ, itemColumns: ITEM_IJ },
  { docKey: 'non-production-return', name: '非生产退料单', headerSearchPlaceholder: '搜索单据类别 / 部门 / 经办人 / 备注', itemSearchPlaceholder: '搜索品号 / 品名 / 规格 / 仓库', headerColumns: HEADER_IJ, itemColumns: ITEM_IJ },
  { docKey: 'outsourcing-picking', name: '托工领料单', headerSearchPlaceholder: '搜索厂商代号 / 单据类别 / 经办人 / 备注', itemSearchPlaceholder: '搜索托工单号 / 品号 / 品名 / 仓库', headerColumns: HEADER_OS, itemColumns: ITEM_OS },
  { docKey: 'outsourcing-return', name: '托工退料单', headerSearchPlaceholder: '搜索厂商代号 / 单据类别 / 经办人 / 备注', itemSearchPlaceholder: '搜索托工单号 / 品号 / 品名 / 仓库', headerColumns: HEADER_OS, itemColumns: ITEM_OS },
  { docKey: 'outsourcing-supplement', name: '托工补料单', headerSearchPlaceholder: '搜索厂商代号 / 单据类别 / 经办人 / 备注', itemSearchPlaceholder: '搜索托工单号 / 品号 / 品名 / 仓库', headerColumns: HEADER_OS, itemColumns: ITEM_OS },
  {
    docKey: 'outsourcing-receipt',
    name: '托外加工缴回单',
    headerSearchPlaceholder: '搜索托工厂商 / 业务员 / 备注',
    itemSearchPlaceholder: '搜索品号 / 品名 / 仓库 / 托工单号',
    headerColumns: [
      { prop: 'cus_no', label: '托工厂商', minWidth: 110 },
      { prop: 'sal_no', label: '业务员', width: 90 },
      { prop: 'rem', label: '备注', minWidth: 140, priority: 'low' },
    ],
    itemColumns: [
      { prop: 'prd_no', label: '品号', minWidth: 120 },
      { prop: 'prd_name', label: '托外货品', minWidth: 160 },
      { prop: 'qty', label: '数量', width: 90, align: 'right' },
      { prop: 'unit', label: '单位', width: 70, align: 'center' },
      { prop: 'wh', label: '仓库', width: 90 },
      { prop: 'prd_mark', label: '长度', width: 90 },
      { prop: 'tw_no', label: '托工单号', minWidth: 120 },
      { prop: 'free_id', label: '是否搭赠', width: 90, align: 'center' },
    ],
  },
  {
    docKey: 'material-cutting',
    name: '物料切割单',
    headerSearchPlaceholder: '搜索来源单号 / 批号 / 切割部门 / 备注',
    itemSearchPlaceholder: '搜索品号 / 材料名称 / 批号 / 仓库',
    headerColumns: [
      { prop: 'bil_no', label: '来源单号', minWidth: 120 },
      { prop: 'mrp_no', label: '切割成品', minWidth: 110 },
      { prop: 'spc', label: '规格', minWidth: 110 },
      { prop: 'prd_mark', label: '长度', width: 80 },
      { prop: 'bat_no', label: '批号', width: 100 },
      { prop: 'dep', label: '切割部门', minWidth: 110 },
      { prop: 'qty', label: '切割数量', width: 100, align: 'right' },
      { prop: 'unit', label: '单位', width: 70, align: 'center' },
      { prop: 'qty1', label: '副单位数量', width: 100, align: 'right', priority: 'low' },
      { prop: 'wh_prd', label: '成品仓库', width: 100 },
      { prop: 'wh_mtl', label: '原料仓库', width: 100 },
      { prop: 'id_no', label: '配方', width: 90, priority: 'low' },
      { prop: 'cas_no', label: '工程案号', width: 110, priority: 'low' },
      { prop: 'task_id', label: '阶段编号', width: 100, priority: 'low' },
      { prop: 'voh_id', label: '凭证模板', width: 100, priority: 'low' },
      { prop: 'cus_os_no', label: '客户订单', minWidth: 120, priority: 'low' },
      { prop: 'cntt_no', label: '合同编号', width: 110, priority: 'low' },
      { prop: 'md_no', label: '使用模具', width: 100, priority: 'low' },
      { prop: 'cst', label: '成品成本', width: 100, align: 'right', priority: 'low' },
      { prop: 'fix_cst1', label: '成本类别', width: 90, priority: 'low' },
      { prop: 'exp_mth', label: '成本方式', width: 90, priority: 'low' },
      { prop: 'bil_type', label: '单据类别', width: 90, align: 'center', priority: 'low' },
      { prop: 'usr_no', label: '经办人员', width: 90, priority: 'low' },
      { prop: 'fj_num', label: '附件张数', width: 90, align: 'right', priority: 'low' },
      { prop: 'rem', label: '备注', minWidth: 140, priority: 'low' },
    ],
    itemColumns: [
      { prop: 'prd_no', label: '品号', minWidth: 120 },
      { prop: 'prd_name', label: '材料名称', minWidth: 160 },
      { prop: 'spc', label: '货品规格', minWidth: 120 },
      { prop: 'qty', label: '切割数量', width: 100, align: 'right' },
      { prop: 'qty1', label: '副单位数量', width: 100, align: 'right' },
      { prop: 'unit', label: '单位', width: 70, align: 'center' },
      { prop: 'wh', label: '材料库', width: 90 },
      { prop: 'wh_name', label: '仓库名称', minWidth: 120 },
      { prop: 'bat_no', label: '批号', width: 100 },
      { prop: 'prd_mark', label: '长度', width: 80 },
    ],
  },
  {
    docKey: 'outsourcing-chargeback',
    name: '托工退回单',
    headerSearchPlaceholder: '搜索来源单号 / 部门 / 客户编号 / 备注',
    itemSearchPlaceholder: '搜索品号 / 品名 / 批号 / 修剪制令',
    headerColumns: [
      { prop: 'bil_no', label: '来源单号', minWidth: 120 },
      { prop: 'dep', label: '部门', minWidth: 110 },
      { prop: 'cus_no', label: '客户编号', minWidth: 110 },
      { prop: 'sal_no', label: '业务员', width: 90 },
      { prop: 'usr', label: '经办人', width: 90 },
      { prop: 'rem', label: '备注', minWidth: 140, priority: 'low' },
    ],
    itemColumns: [
      { prop: 'prd_no', label: '品号', minWidth: 120 },
      { prop: 'prd_name', label: '品名', minWidth: 160 },
      { prop: 'spc', label: '货品规格', minWidth: 120 },
      { prop: 'qty', label: '数量', width: 90, align: 'right' },
      { prop: 'qc_qty', label: '检验数量', width: 100, align: 'right' },
      { prop: 'qty_tc', label: '退回数量', width: 100, align: 'right' },
      { prop: 'up_main', label: '主单位单价', width: 110, align: 'right' },
      { prop: 'unit', label: '单位', width: 70, align: 'center' },
      { prop: 'wh', label: '仓库', width: 90 },
      { prop: 'prd_mark', label: '长度', width: 80 },
      { prop: 'trim_mo', label: '修剪制令', minWidth: 120 },
      { prop: 'bat_no', label: '批号', width: 100 },
      { prop: 'sc_dd', label: '生产日期', width: 110, priority: 'low' },
    ],
  },
  {
    docKey: 'sales-return',
    name: '销售退回单',
    headerSearchPlaceholder: '搜索销货客户 / 转入单号 / 业务人员 / 备注',
    itemSearchPlaceholder: '搜索品号 / 品名 / 受订单号 / 规格',
    headerColumns: [
      { prop: 'cus_no', label: '销货客户', minWidth: 120 },
      { prop: 'os_no', label: '转入单号', minWidth: 120 },
      { prop: 'sal_no', label: '业务人员', width: 100 },
      { prop: 'dep', label: '部门', minWidth: 110 },
      { prop: 'rem', label: '备注', minWidth: 140, priority: 'low' },
    ],
    itemColumns: [
      { prop: 'prd_no', label: '品号', minWidth: 120 },
      { prop: 'prd_name', label: '品名', minWidth: 160 },
      { prop: 'name_eng', label: '货品英文名称', minWidth: 160 },
      { prop: 'spc', label: '货品规格', minWidth: 120 },
      { prop: 'qty', label: '数量', width: 90, align: 'right' },
      { prop: 'unit', label: '单位', width: 70, align: 'center' },
      { prop: 'prd_mark', label: '长度', width: 80 },
      { prop: 'so_os_no', label: '受订单号', minWidth: 120 },
    ],
  },
]

/** docKey → 配置 */
export const PRODUCTION_DOC_CONFIG_MAP: Record<string, ProductionDocConfig> = Object.fromEntries(
  PRODUCTION_DOC_CONFIGS.map((c) => [c.docKey, c]),
)
