/**
 * 模块：单据 PDF 按次隐藏 —— 请求快照与本地保存名
 * 源接口：nuomi_wms/docs/本日接口变更.md 2026-11-24 11:46:18 批次
 *
 * 三个硬约束（来自后端契约，违反会被 400 或产生错误文件）：
 * 1. hide_fields / hide_sections 必须是**重复标准键**（hide_fields=a&hide_fields=b），
 *    不能是 hide_fields[]、hide_fields[0]、逗号串或 JSON 数组字符串。
 * 2. 隐藏 document.order_no 时，本地保存名必须去掉单号/业务 ID（后端附件名同样去单号，
 *    但 downloadPdf 用调用方 fileName 保存、不读 Content-Disposition）。
 * 3. 点击确认时必须固定「单据类型 + ID + 两个选项列表 + 保存名」的同次快照，
 *    下载期间复选状态变化不得影响已发请求的保存名。
 */
import { getPdfCatalogue, type PdfDocKind } from '@/config/pdfExportOptions'

/** 一次导出的不可变快照；确认后不再读取界面状态 */
export interface PdfExportSnapshot {
  kind: PdfDocKind
  /** 单据业务 ID（purchase_order_id / sales_order_id / customer_order_id） */
  billId: string
  /** 用于默认文件名的单号；拿不到时传空串 */
  billNo: string
  hideFields: string[]
  hideSections: string[]
  /** 本次实际保存文件名（已按是否隐藏单号结算） */
  fileName: string
  /** en 若本次隐藏了单号，保存名不再含单号 */
  orderNoHidden: boolean
}

export interface BuildSnapshotInput {
  kind: PdfDocKind
  billId: string
  billNo?: string | null
  hideFields?: Iterable<string>
  hideSections?: Iterable<string>
}

/** 去重 + 去空白，保持后端要求的「大小写敏感、值去首尾空格」 */
function normalizeList(values?: Iterable<string>): string[] {
  if (!values) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = String(raw ?? '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/**
 * 生成一次导出的不可变快照。
 *
 * 文件名规则（与后端 pdf_export_filename 同构）：
 * - 隐藏 document.order_no → 固定 `{单据名}.pdf`，**禁止回填单号或业务 ID**（原单号本就为空也一样）；
 * - 未隐藏 → 保持各页面原规则 `{单据名}_{单号}.pdf`，单号缺失时回退到业务 ID。
 */
export function buildPdfExportSnapshot(input: BuildSnapshotInput): PdfExportSnapshot {
  const catalogue = getPdfCatalogue(input.kind)
  const hideFields = normalizeList(input.hideFields)
  const hideSections = normalizeList(input.hideSections)
  const orderNoHidden = hideFields.includes('document.order_no')

  const title = catalogue?.title ?? '单据'
  const billNo = String(input.billNo ?? '').trim()
  const fallback = catalogue?.fallbackFileName ?? `${title}.pdf`

  let fileName: string
  if (orderNoHidden) {
    // 隐藏单号分支：只允许固定无单号名
    fileName = fallback
  } else {
    const suffix = billNo || String(input.billId ?? '').trim()
    fileName = suffix ? `${title}_${suffix}.pdf` : fallback
  }

  return {
    kind: input.kind,
    billId: String(input.billId ?? '').trim(),
    billNo,
    hideFields,
    hideSections,
    fileName,
    orderNoHidden,
  }
}

/**
 * 把快照转成请求参数。
 * 数组原样保留（不 join、不 JSON.stringify），由 api 层的 paramsSerializer 展开为重复键。
 */
export function snapshotToRequestParams(snapshot: PdfExportSnapshot): {
  hide_fields?: string[]
  hide_sections?: string[]
} {
  const params: { hide_fields?: string[]; hide_sections?: string[] } = {}
  if (snapshot.hideFields.length) params.hide_fields = [...snapshot.hideFields]
  if (snapshot.hideSections.length) params.hide_sections = [...snapshot.hideSections]
  return params
}

/**
 * 局部 paramsSerializer：生成重复标准键。
 * 仅用于三个 PDF 请求的 config，不改全局数组序列化规则（FE-R02）。
 * 输出形如 `hide_fields=order.supplier_name&hide_fields=items.purchase_price`。
 */
export function repeatKeyParamsSerializer(params: Record<string, unknown>): string {
  const parts: string[] = []
  const append = (key: string, value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value)
    // 后端只对 hide_fields / hide_sections 做严格校验，其余键沿用旧兼容规则
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(text)}`)
  }
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) append(key, item)
    } else if (value !== undefined && value !== null) {
      append(key, value)
    }
  }
  return parts.join('&')
}

/**
 * 空选项判定：不隐藏任何内容时不必弹窗，直接走旧的全量导出。
 * 用于「用户直接点打印、无自定义需求」的快速路径。
 */
export function isEmptySelection(hideFields?: Iterable<string>, hideSections?: Iterable<string>): boolean {
  return normalizeList(hideFields).length === 0 && normalizeList(hideSections).length === 0
}

/**
 * 一键全隐金额时的完整字段集。
 * 严格等于后端「完整无结构化金额」展开项：采购 7 项 / 销售 12 项 / 订货单不支持。
 * 不能只隐藏 amounts 区域——那样明细金额仍可见（后端 §4 明确）。
 */
export function moneyHideFields(kind: PdfDocKind): string[] {
  const catalogue = getPdfCatalogue(kind)
  return catalogue ? [...catalogue.moneyFields] : []
}

/**
 * 计算「勾选一键全隐金额」后应追加的 hide_fields：
 * 只补缺失的金额字段，不动用户已勾的非金额字段。
 */
export function addMoneyFields(current: Iterable<string> | undefined, kind: PdfDocKind): string[] {
  const merged = new Set(normalizeList(current))
  for (const key of moneyHideFields(kind)) merged.add(key)
  return [...merged]
}

/** 取消「一键全隐金额」：只移除金额字段，保留用户其它勾选 */
export function removeMoneyFields(current: Iterable<string> | undefined, kind: PdfDocKind): string[] {
  const money = new Set(moneyHideFields(kind))
  return normalizeList(current).filter((key) => !money.has(key))
}

/** 当前选中项是否已覆盖全部金额字段（用于高亮「一键全隐」开关状态） */
export function hasAllMoneyFields(current: Iterable<string> | undefined, kind: PdfDocKind): boolean {
  const money = moneyHideFields(kind)
  if (!money.length) return false
  const selected = new Set(normalizeList(current))
  return money.every((key) => selected.has(key))
}
