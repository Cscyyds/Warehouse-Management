import {
  allFieldKeys, alwaysShownKeys, defaultShownFields,
  type PdfDocCatalogue, type PdfDocKind,
} from '@/config/pdfExportOptions'
import type { PdfPrintSetting } from '@/api/modules/pdfPrintSettings'

export const PDF_CATALOGUE_VERSION = 1
export const PDF_PRINT_TITLES: Record<PdfDocKind, string> = {
  purchase: '采购订单', sales: '销售订单', customerOrder: '客户订货单',
}
export const PDF_PRINT_ENDPOINTS: Record<PdfDocKind, string> = {
  purchase: 'GET /api/v1/tenant-purchase-orders/print/pdf',
  sales: 'GET /api/v1/tenant-sales-orders/print/pdf',
  customerOrder: 'GET /api/v1/tenant-customer-orders/print/pdf',
}

/** 严格校验后再初始化预览，失败时禁止回退为全显示。 */
export function validatePdfShownFields(catalogue: PdfDocCatalogue, value: unknown): string[] {
  if (!Array.isArray(value) || value.some(key => typeof key !== 'string')) throw new Error('打印字段配置格式不完整，请重新加载')
  const all = allFieldKeys(catalogue)
  const selected = new Set<string>(value)
  if ([...selected].some(key => !all.includes(key))) throw new Error('打印字段目录已更新，请重新加载并检查默认方案')
  if (alwaysShownKeys(catalogue).some(key => !selected.has(key))) throw new Error('Logo、品牌名、公司名、单号和页码必须保留显示')
  const dependent = new Set(['order.expected_arrival_date', 'items.length_text'])
  if (![...selected].some(key => /^(order|items)\./.test(key) && !dependent.has(key))) {
    throw new Error('请至少保留一项正文信息或一个明细列')
  }
  return all.filter(key => selected.has(key))
}

export function resolvePdfPrintSetting(catalogue: PdfDocCatalogue, setting: PdfPrintSetting): string[] {
  if (!setting || setting.doc_kind !== catalogue.kind || setting.catalogue_version !== PDF_CATALOGUE_VERSION
      || !Number.isSafeInteger(setting.revision) || setting.revision < 0
      || !['system', 'company'].includes(setting.source)) throw new Error('打印默认配置返回不完整，请重新加载')
  if (setting.source === 'system' && setting.shown_fields === null && setting.revision === 0) {
    return validatePdfShownFields(catalogue, defaultShownFields(catalogue))
  }
  if (setting.source !== 'company' || setting.revision < 1) throw new Error('打印默认配置状态不一致，请重新加载')
  return validatePdfShownFields(catalogue, setting.shown_fields)
}

export function samePdfShownFields(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every(key => right.includes(key))
}
