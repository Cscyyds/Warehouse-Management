import { getSupplierDetail } from '@/api'

/**
 * 前端兜底：后端供应商授信/赠送汇总接口未返回 supplier_code（编码），
 * 这里逐行回查供应商档案补全编码。
 *
 * 带进程内缓存（按 supplier_id），同一供应商跨分页/跨页面只请求一次，
 * 缓解 N+1 请求带来的开销。
 */
const supplierCodeCache = new Map<string, string>()

export async function fillSupplierCode<T extends { supplier_id: string; supplier_code?: string }>(
  rows: T[],
): Promise<T[]> {
  if (!rows.length) return rows
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const cached = supplierCodeCache.get(row.supplier_id)
      if (cached !== undefined) {
        return { ...row, supplier_code: cached }
      }
      try {
        const res = await getSupplierDetail(row.supplier_id)
        const sd = (res.data as { supplier?: Array<{ supplier_code?: string }> }).supplier?.[0]
        const code = sd?.supplier_code || ''
        supplierCodeCache.set(row.supplier_id, code)
        return { ...row, supplier_code: code }
      } catch {
        return { ...row, supplier_code: row.supplier_code ?? '' }
      }
    }),
  )
  return enriched
}
