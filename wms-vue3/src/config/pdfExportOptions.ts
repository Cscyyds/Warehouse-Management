/**
 * 模块：单据 PDF 按次隐藏内容的静态字段目录
 * 源接口：nuomi_wms/docs/本日接口变更.md 2026-11-24 11:46:18 批次（PDF-EXPORT-20261124114618）
 * 后端实现：app/services/document_pdf_service.py（COMMON_PDF_FIELDS / validate_pdf_export_options）
 *           app/services/{purchase,sales,customer_order}_pdf_service.py（PDF_FIELDS / PDF_SECTIONS / PDF_COLUMNS）
 *
 * 约定：
 * - `key` 必须与后端白名单**逐字一致**（大小写敏感）；中文只用于界面显示，绝不传入 hide_fields。
 * - 三份目录互不复用（金额字段集合不同），公共 6 项可复用。
 * - 本文件是纯数据 + 纯函数，无 Vue / Pinia / 网络依赖，可被 node:test 直接覆盖。
 * - 公式：字段数 = 公共 6 + 主单项 + 明细项，与后端 PDF_FIELDS 基数一致
 *   （采购 32 / 销售 41 / 订货单 20，已逐项核对）。
 */

/** 单据类型 → 目录键（后端三接口与页面入口一一对应） */
export type PdfDocKind = 'purchase' | 'sales' | 'customerOrder'

export interface PdfFieldOption {
  /** 后端 hide_fields 值，大小写敏感，不要改 */
  key: string
  /** 界面显示名 */
  label: string
  /** 是否属于「金额/价格」类（用于统计，不再用于标红） */
  money?: boolean
  /** 复合项说明：隐藏它会连带影响哪些位置（仅提示，不影响后端判定） */
  note?: string
  /**
   * 是否属于「默认显示白名单」。
   *
   * ⚠️ 界面语义是「勾选 = 显示」。打开弹窗时**只有**标记为 true 的字段会被勾上，
   * 其余字段一律不勾（= 本次隐藏）。
   * 因此这里是「白名单」而非「排除表」：新增字段默认不会自动显示，必须显式加入。
   */
  defaultShow?: boolean
  /**
   * 强制显示：业务必需的字段（Logo/品牌名/公司名/单号/页码）。
   *
   * 标为 true 后界面**不渲染勾选框**，只显示文字（用户无法取消，
   * 避免导出缺主体信息的废件），且恒在显示集合内、不参与 hide_fields。
   */
  alwaysShow?: boolean
}

export interface PdfSectionOption {
  key: string
  label: string
  /**
   * 该区域可直接勾选的字段 key（按界面展示顺序）。
   * 注意：`order.payable_amount` 同时出现在 basic 与 notes —— 这是后端的真实结构，
   * 勾选它（hide_fields）会在**所有已知位置**同时隐藏；而勾区域（hide_sections）只隐藏该位置。
   */
  fields: string[]
  /**
   * true = 该区域没有子字段，区域本身就是唯一的隐藏单位。
   * 当前三个单据均无此类型区域（合计行已移除），保留字段以兼容后端 hide_sections 语义。
   */
  sectionOnly?: boolean
  /** 区域说明（已不再渲染到界面，保留仅供代码阅读时理解区域含义） */
  note?: string
}

export interface PdfDocCatalogue {
  kind: PdfDocKind
  /** 单据中文名，用于弹窗标题与文件名 */
  title: string
  /** 该单据是否有金额可隐藏（客户订货单为 false，后端无金额字段） */
  hasMoney: boolean
  sections: PdfSectionOption[]
  /** 公共 6 项（三个接口一致） */
  common: PdfFieldOption[]
  /** 主单字段（按区域归组，但实际上传为扁平的 hide_fields） */
  orderFields: PdfFieldOption[]
  /** 明细字段 */
  itemFields: PdfFieldOption[]
  /**
   * 「一键全隐金额」展开的完整字段集（严格等于后端不变量）：
   * 采购 7 项、销售 12 项、订货单无。不能只隐区域 amounts，否则明细金额仍可见。
   */
  moneyFields: string[]
  /** 默认保存名（未隐藏单号时用单号，隐藏时用 title 兜底） */
  fallbackFileName: string
}

/* ── 公共 6 项：三接口一致（document_pdf_service.COMMON_PDF_FIELDS） ── */
// 界面语义「勾选 = 显示」，默认全勾（等同改造前的完整导出）。
// 业务要求（2026-11-26）：Logo / 品牌名 / 公司名 / 单号 / 页码 为「必须显示」，
// 界面不渲染勾选框，用户无法取消；其余字段走默认白名单机制。
const COMMON: PdfFieldOption[] = [
  { key: 'document.logo', label: 'Logo', defaultShow: true, alwaysShow: true, note: '平台 Logo 及其缺失占位' },
  { key: 'document.brand_name', label: '品牌名', defaultShow: true, alwaysShow: true, note: '首页品牌与每页「由品牌生成」整句' },
  { key: 'document.tenant_name', label: '公司名', defaultShow: true, alwaysShow: true, note: '首页租户公司名' },
  { key: 'document.order_no', label: '单号', defaultShow: true, alwaysShow: true, note: '同时决定 PDF 内单号与下载文件名' },
  { key: 'document.generated_at', label: '生成时间', note: '不承诺清除 PDF 文件元数据' },
  { key: 'document.page_number', label: '页码', defaultShow: true, alwaysShow: true, note: '' },
]

/* ── 采购明细单：PDF_FIELDS 共 32 项 ── */
const PURCHASE: PdfDocCatalogue = {
  kind: 'purchase',
  title: '采购明细单',
  hasMoney: true,
  fallbackFileName: '采购明细单.pdf',
  sections: [
    {
      key: 'basic', label: '基本信息区',
      fields: ['order.supplier_name', 'order.order_date', 'order.delivery_days',
        'order.expected_arrival_date', 'order.payment_method', 'order.freight_bear_type',
        'order.order_amount', 'order.rounding_amount', 'order.use_prepayment_amount',
        'order.use_gift_amount', 'order.payable_amount', 'document.generated_at'],
      note: '隐藏本区不会连带隐藏落款应付大写',
    },
    {
      key: 'items', label: '明细区',
      fields: ['items.row_no', 'items.product_code', 'items.product_name', 'items.specification',
        'items.length_text', 'items.color', 'items.unit_name', 'items.purchase_price',
        'items.qty', 'items.received_qty', 'items.amount', 'items.remark'],
      note: '隐藏后整个明细表省略，不留空表',
    },
    {
      key: 'notes', label: '备注/落款区',
      fields: ['order.remark', 'order.payable_amount', 'order.created_by_name', 'order.created_at'],
      note: '应付大写在此区；应付金额为跨区字段，勾会同时隐藏基本信息区数字',
    },
  ],
  common: COMMON,
  /**
   * 默认勾选项（业务确认 2026-11-26，按采购截图逐项对齐）：
   * 基本信息区 → 供应商 / 订单日期 / 付款方式 / 订单金额 / 应付金额
   */
  orderFields: [
    { key: 'order.supplier_name', label: '供应商', defaultShow: true },
    { key: 'order.order_date', label: '订单日期', defaultShow: true },
    { key: 'order.delivery_days', label: '交货天数', note: '父项：隐藏后预计到货后缀一起消失' },
    { key: 'order.expected_arrival_date', label: '预计到货日', note: '单独隐藏只去掉后缀文字' },
    { key: 'order.payment_method', label: '付款方式', defaultShow: true },
    { key: 'order.freight_bear_type', label: '运费承担' },
    { key: 'order.order_amount', label: '订单金额', money: true, defaultShow: true },
    { key: 'order.rounding_amount', label: '抹零金额', money: true },
    { key: 'order.use_prepayment_amount', label: '使用预付款', money: true },
    { key: 'order.use_gift_amount', label: '使用赠送金额', money: true },
    { key: 'order.payable_amount', label: '应付金额', money: true, defaultShow: true, note: '跨区：同时影响落款大写' },
    { key: 'order.remark', label: '备注', defaultShow: true },
    { key: 'order.created_by_name', label: '创建人', defaultShow: true },
    { key: 'order.created_at', label: '创建时间', defaultShow: true },
  ],
  /**
   * 默认勾选项（业务确认 2026-11-26，按采购截图逐项对齐）：
   * 明细区 → 序号 / 商品编码 / 商品名称 / 规格 / 颜色 / 单位 / 采购单价 / 数量 / 金额
   */
  itemFields: [
    { key: 'items.row_no', label: '序号', defaultShow: true },
    { key: 'items.product_code', label: '商品编码', defaultShow: true },
    { key: 'items.product_name', label: '商品名称', defaultShow: true },
    { key: 'items.specification', label: '规格', defaultShow: true, note: '隐藏会连带移除整个规格及长度片段' },
    { key: 'items.length_text', label: '长度片段', note: '只控制系统附加的长度文字' },
    { key: 'items.color', label: '颜色', defaultShow: true },
    { key: 'items.unit_name', label: '单位', defaultShow: true },
    { key: 'items.purchase_price', label: '采购单价', money: true, defaultShow: true },
    { key: 'items.qty', label: '数量', defaultShow: true },
    { key: 'items.received_qty', label: '已入库' },
    { key: 'items.amount', label: '金额', money: true, defaultShow: true },
    { key: 'items.remark', label: '备注' },
  ],
  // 后端不变量：完整无结构化金额 = 5 主单 + 2 明细
  moneyFields: [
    'order.order_amount', 'order.rounding_amount', 'order.use_prepayment_amount',
    'order.use_gift_amount', 'order.payable_amount',
    'items.purchase_price', 'items.amount',
  ],
}

/* ── 销售订单：PDF_FIELDS 共 41 项 ── */
const SALES: PdfDocCatalogue = {
  kind: 'sales',
  title: '销售订单',
  hasMoney: true,
  fallbackFileName: '销售订单.pdf',
  sections: [
    {
      /**
       * 销售订单的金额字段并入「基本信息区」，不再单独设「金额区」。
       *
       * 后端 PDF_BODY_SECTIONS 里确实有独立的 amounts 区域，
       * 但业务要求前端展示与采购保持一致（采购的金额字段本就在 basic 内），
       * 不给用户额外的心智负担。隐藏仍走字段级 hide_fields，不受影响。
       */
      key: 'basic', label: '基本信息区',
      fields: ['order.customer_name', 'order.bill_type', 'order.settlement_method',
        'order.delivery_method', 'order.carrier_company_name', 'order.city',
        'order.receive_address', 'order.outbound_date', 'order.settlement_bank_name',
        'order.total_sales_amount', 'order.receivable_amount', 'order.pending_receivable_amount',
        'order.received_amount', 'order.use_prepayment_amount', 'order.use_gift_amount',
        'order.rounding_amount', 'order.total_tax_amount', 'document.generated_at'],
      note: '',
    },
    {
      key: 'items', label: '明细区',
      fields: ['items.row_no', 'items.product_code', 'items.product_name', 'items.specification',
        'items.length_text', 'items.color', 'items.unit_name', 'items.discount_price',
        'items.qty', 'items.line_sales_amount', 'items.tax_rate', 'items.tax_amount',
        'items.line_receivable_amount', 'items.actual_out_qty', 'items.line_remark'],
      note: '隐藏后整个明细表省略，不留空表',
    },
    {
      key: 'notes', label: '备注/落款区',
      fields: ['order.customer_remark', 'order.receivable_amount', 'order.created_by_name', 'order.created_at'],
      note: '应收大写在此区；应收金额为跨区字段，勾会同时隐藏基本信息区的数字',
    },
  ],
  common: COMMON,
  /**
   * 默认勾选项（2026-11-26，仿采购明细单模式：每个区域勾选必要字段）。
   * 基本信息区 → 客户 / 单据类别 / 结算方式 / 送货方式 / 收货地址 /
   *              销售总额 / 应收金额 / 已收金额 / 税额合计
   */
  orderFields: [
    { key: 'order.customer_name', label: '客户', defaultShow: true },
    { key: 'order.bill_type', label: '单据类别', defaultShow: true },
    { key: 'order.settlement_method', label: '结算方式', defaultShow: true },
    { key: 'order.delivery_method', label: '送货方式', defaultShow: true },
    { key: 'order.carrier_company_name', label: '承运公司' },
    { key: 'order.city', label: '城市' },
    { key: 'order.receive_address', label: '收货地址', defaultShow: true },
    { key: 'order.outbound_date', label: '出库日期' },
    { key: 'order.settlement_bank_name', label: '结算银行' },
    { key: 'order.total_sales_amount', label: '销售总额', money: true, defaultShow: true },
    { key: 'order.receivable_amount', label: '应收金额', money: true, defaultShow: true, note: '跨区：同时影响落款大写' },
    { key: 'order.pending_receivable_amount', label: '待收金额', money: true },
    { key: 'order.received_amount', label: '已收金额', money: true, defaultShow: true },
    { key: 'order.use_prepayment_amount', label: '使用预收款', money: true },
    { key: 'order.use_gift_amount', label: '使用赠送金额', money: true },
    { key: 'order.rounding_amount', label: '抹零金额', money: true },
    { key: 'order.total_tax_amount', label: '税额合计', money: true, defaultShow: true },
    { key: 'order.customer_remark', label: '客户备注', defaultShow: true },
    { key: 'order.created_by_name', label: '创建人', defaultShow: true },
    { key: 'order.created_at', label: '创建时间', defaultShow: true },
  ],
  /**
   * 明细区 → 序号 / 商品编码 / 商品名称 / 规格 / 颜色 / 单位 /
   *          折后单价 / 数量 / 销售金额 / 税额 / 应收金额
   */
  itemFields: [
    { key: 'items.row_no', label: '序号', defaultShow: true },
    { key: 'items.product_code', label: '商品编码', defaultShow: true },
    { key: 'items.product_name', label: '商品名称', defaultShow: true },
    { key: 'items.specification', label: '规格', defaultShow: true, note: '隐藏会连带移除整个规格及长度片段' },
    { key: 'items.length_text', label: '长度片段', note: '只控制系统附加的长度文字' },
    { key: 'items.color', label: '颜色', defaultShow: true },
    { key: 'items.unit_name', label: '单位', defaultShow: true },
    { key: 'items.discount_price', label: '折后单价', money: true, defaultShow: true },
    { key: 'items.qty', label: '数量', defaultShow: true },
    { key: 'items.line_sales_amount', label: '销售金额', money: true, defaultShow: true },
    { key: 'items.tax_rate', label: '税率', defaultShow: true, note: '税率独立，不计入金额快捷项' },
    { key: 'items.tax_amount', label: '税额', money: true, defaultShow: true },
    { key: 'items.line_receivable_amount', label: '应收金额', money: true, defaultShow: true },
    { key: 'items.actual_out_qty', label: '已出库' },
    { key: 'items.line_remark', label: '备注' },
  ],
  // 后端不变量：完整无结构化金额 = 8 主单 + 4 明细（税率独立）
  moneyFields: [
    'order.total_sales_amount', 'order.receivable_amount', 'order.pending_receivable_amount',
    'order.received_amount', 'order.use_prepayment_amount', 'order.use_gift_amount',
    'order.rounding_amount', 'order.total_tax_amount',
    'items.discount_price', 'items.line_sales_amount', 'items.tax_amount', 'items.line_receivable_amount',
  ],
}

/* ── 客户订货单：PDF_FIELDS 共 20 项，无金额 ── */
const CUSTOMER_ORDER: PdfDocCatalogue = {
  kind: 'customerOrder',
  title: '客户订货单',
  hasMoney: false,
  fallbackFileName: '客户订货单.pdf',
  sections: [
    {
      key: 'basic', label: '基本信息区',
      fields: ['order.customer_name', 'order.created_by_name', 'order.created_at', 'document.generated_at'],
      note: '',
    },
    {
      key: 'items', label: '明细区',
      fields: ['items.row_no', 'items.product_code', 'items.product_name', 'items.specification',
        'items.color', 'items.unit_name', 'items.qty', 'items.product_type',
        'items.project_name', 'items.line_remark'],
      note: '隐藏后整个明细表省略，不留空表',
    },
    {
      key: 'notes', label: '备注区', fields: ['order.remark'], note: '',
    },
  ],
  common: COMMON,
  /** 默认勾选项（2026-11-26，仿采购模式）：基本信息区 → 客户；备注区 → 订单备注 */
  orderFields: [
    { key: 'order.customer_name', label: '客户', defaultShow: true },
    { key: 'order.created_by_name', label: '创建人', defaultShow: true },
    { key: 'order.created_at', label: '创建时间', defaultShow: true },
    { key: 'order.remark', label: '订单备注', defaultShow: true },
  ],
  /**
   * 明细区 → 序号 / 商品编码 / 商品名称 / 规格 / 颜色 / 单位 / 数量 /
   *          产品类型 / 项目名称
   */
  itemFields: [
    { key: 'items.row_no', label: '序号', defaultShow: true },
    { key: 'items.product_code', label: '商品编码', defaultShow: true },
    { key: 'items.product_name', label: '商品名称', defaultShow: true },
    { key: 'items.specification', label: '规格', defaultShow: true },
    { key: 'items.color', label: '颜色', defaultShow: true },
    { key: 'items.unit_name', label: '单位', defaultShow: true },
    { key: 'items.qty', label: '数量', defaultShow: true },
    { key: 'items.product_type', label: '产品类型', defaultShow: true },
    { key: 'items.project_name', label: '项目名称', defaultShow: true },
    { key: 'items.line_remark', label: '备注' },
  ],
  // 订货单不支持金额选项（后端无金额字段）
  moneyFields: [],
}

export const PDF_CATALOGUES: Record<PdfDocKind, PdfDocCatalogue> = {
  purchase: PURCHASE,
  sales: SALES,
  customerOrder: CUSTOMER_ORDER,
}

/** 取目录；未知类型返回 null，调用方降级为「不弹窗、直接下载」 */
export function getPdfCatalogue(kind: PdfDocKind): PdfDocCatalogue | null {
  return PDF_CATALOGUES[kind] ?? null
}

/** 该单据全部可选字段（公共 + 主单 + 明细），用于校验与统计 */
export function allFieldKeys(catalogue: PdfDocCatalogue): string[] {
  return [
    ...catalogue.common.map((f) => f.key),
    ...catalogue.orderFields.map((f) => f.key),
    ...catalogue.itemFields.map((f) => f.key),
  ]
}

/**
 * 打开弹窗时的默认「要显示」字段（白名单）。
 *
 * 界面语义是「勾选 = 显示」，业务确认（2026-11-26）默认只显示这 8 项：
 * Logo、品牌名、公司名、供应商/客户、序号、商品编码、商品名称、规格。
 * 其余字段一律默认隐藏，用户可手动勾上。
 *
 * ⚠️ 这是白名单：新增字段不会自动显示，必须显式加 defaultShow: true。
 */
export function defaultShownFields(catalogue: PdfDocCatalogue): string[] {
  const all = [...catalogue.common, ...catalogue.orderFields, ...catalogue.itemFields]
  // alwaysShow（Logo/品牌名/公司名/单号/页码）恒在显示集合内，不受白名单影响
  const picked = all
    .filter((f) => f.alwaysShow || f.defaultShow)
    .map((f) => f.key)

  // 保险：若结果意外为空，至少回退为「全部显示」，避免导出空单据
  if (picked.length) return [...new Set(picked)]
  return allFieldKeys(catalogue)
}

/** 强制显示字段（界面不渲染勾选框，用户不可取消） */
export function alwaysShownKeys(catalogue: PdfDocCatalogue): string[] {
  return [...catalogue.common, ...catalogue.orderFields, ...catalogue.itemFields]
    .filter((f) => f.alwaysShow)
    .map((f) => f.key)
}

/** 某字段是否强制显示（用于模板判断是否渲染勾选框） */
export function isAlwaysShown(catalogue: PdfDocCatalogue | null | undefined, key: string): boolean {
  if (!catalogue) return false
  return [...catalogue.common, ...catalogue.orderFields, ...catalogue.itemFields]
    .some((f) => f.key === key && f.alwaysShow)
}

/** 打开弹窗时的默认隐藏项 = 全集 − 白名单（供摘要与请求参数直接用） */
export function defaultHiddenFields(catalogue: PdfDocCatalogue): string[] {
  const shown = new Set(defaultShownFields(catalogue))
  return allFieldKeys(catalogue).filter((key) => !shown.has(key))
}

/**
 * 界面「已勾选（要显示）」→ 请求需要的「要隐藏」。
 * 这是本次语义翻转的唯一转换点：组件内一律用「显示」视角，只在发请求前翻转一次。
 */
export function shownToHidden(catalogue: PdfDocCatalogue, shown: Iterable<string>): string[] {
  const visible = new Set(shown)
  return allFieldKeys(catalogue).filter((key) => !visible.has(key))
}

/** 界面「要隐藏」→「已显示」（恢复选中状态用，谨慎调用） */
export function hiddenToShown(catalogue: PdfDocCatalogue, hidden: Iterable<string>): string[] {
  const invisible = new Set(hidden)
  return allFieldKeys(catalogue).filter((key) => !invisible.has(key))
}

/** 金额字段的显示名映射（二次确认清单用） */
export function moneyFieldLabels(catalogue: PdfDocCatalogue): Array<{ key: string; label: string }> {
  const map = new Map<string, string>()
  for (const f of [...catalogue.orderFields, ...catalogue.itemFields]) {
    if (f.money) map.set(f.key, f.label)
  }
  return catalogue.moneyFields.map((key) => ({ key, label: map.get(key) ?? key }))
}

/* ── 区域 ↔ 字段联动（合并视图用） ── */

/**
 * 取某区域下要在界面展示的字段（带显示名与金额标记）。
 * sectionOnly 区域（如 totals）没有子字段，返回空数组。
 */
export function sectionFields(catalogue: PdfDocCatalogue, sectionKey: string): PdfFieldOption[] {
  const section = catalogue.sections.find((s) => s.key === sectionKey)
  if (!section || section.sectionOnly) return []
  const all = new Map<string, PdfFieldOption>()
  for (const f of [...catalogue.common, ...catalogue.orderFields, ...catalogue.itemFields]) {
    all.set(f.key, f)
  }
  return section.fields
    .map((key) => all.get(key) ?? { key, label: key })
}

/** 某字段出现在哪些区域（用于标记「跨区字段」并提示会同时隐藏多处） */
export function sectionsContaining(catalogue: PdfDocCatalogue, fieldKey: string): string[] {
  return catalogue.sections
    .filter((s) => !s.sectionOnly && s.fields.includes(fieldKey))
    .map((s) => s.key)
}

/** 该字段是否跨多个区域（如采购的 order.payable_amount） */
export function isCrossSectionField(catalogue: PdfDocCatalogue, fieldKey: string): boolean {
  return sectionsContaining(catalogue, fieldKey).length > 1
}

/** 该区域内的全部字段是否都已被勾选（用于区域勾选框状态） */
export function isSectionFullyHidden(
  catalogue: PdfDocCatalogue, sectionKey: string, hideFields: Iterable<string> | undefined,
): boolean {
  const fields = sectionFields(catalogue, sectionKey)
  if (!fields.length) return false
  const selected = new Set(Array.from(hideFields ?? []))
  return fields.every((f) => selected.has(f.key))
}

/** 该区域是否被部分勾选（用于半选状态） */
export function isSectionPartiallyHidden(
  catalogue: PdfDocCatalogue, sectionKey: string, hideFields: Iterable<string> | undefined,
): boolean {
  const fields = sectionFields(catalogue, sectionKey)
  if (!fields.length) return false
  const selected = new Set(Array.from(hideFields ?? []))
  const hit = fields.filter((f) => selected.has(f.key)).length
  return hit > 0 && hit < fields.length
}

/**
 * 点击区域标题：全选/取消该区域的全部字段。
 * - sectionOnly 区域（totals）：切换 hide_sections 中的该区域，不碰 hide_fields；
 * - 普通区域：切换 hide_fields（不合并成 hide_sections，避免顺带隐藏跨区的其它位置）。
 * 注意：跨区字段被区域全选时会一并隐藏它在其它区域的显示——这是后端 hide_fields 的既定语义。
 */
export function toggleSectionFields(
  catalogue: PdfDocCatalogue,
  sectionKey: string,
  hideFields: Iterable<string> | undefined,
  checked: boolean,
): string[] {
  const selected = new Set(Array.from(hideFields ?? []))
  const section = catalogue.sections.find((s) => s.key === sectionKey)
  if (!section || section.sectionOnly) return [...selected]
  for (const key of section.fields) {
    if (checked) selected.add(key)
    else selected.delete(key)
  }
  return [...selected]
}
