import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'
import type { PdfDocKind } from '@/config/pdfExportOptions'

export interface PdfPrintSetting {
  doc_kind: PdfDocKind
  /** null 表示公司尚未配置，使用当前系统内置默认值。 */
  shown_fields: string[] | null
  catalogue_version: number
  revision: number
  source: 'system' | 'company'
  updated_by_name: string
  updated_at: string | null
}

export function getEffectivePdfPrintSetting(doc_kind: PdfDocKind): Promise<ApiResponse<PdfPrintSetting>> {
  return get('/api/v1/tenant-pdf-print-settings/effective', { doc_kind }, { silent: true })
}

export function getPdfPrintSettings(): Promise<ApiResponse<{ items: PdfPrintSetting[] }>> {
  return get('/api/v1/tenant-pdf-print-settings/list', undefined, { silent: true })
}

export function savePdfPrintSetting(data: {
  doc_kind: PdfDocKind; shown_fields: string[]; expected_revision: number; catalogue_version: number
}): Promise<ApiResponse<PdfPrintSetting>> {
  return post('/api/v1/tenant-pdf-print-settings/update', data, { silent: true })
}
