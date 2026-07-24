import { getSupplierDetail } from '@/api'

/**
 * 前端兜底：后端供应商授信/赠送汇总接口未返回 supplier_code（编码）与
 * contact_phone（联系电话）等供应商档案字段，这里逐行回查供应商档案补全。
 *
 * 带进程内缓存（按 supplier_id），同一供应商跨分页/跨页面只请求一次，
 * 缓解 N+1 请求带来的开销。
 */
interface SupplierProfile {
  code: string
  phone: string
}
const supplierCodeCache = new Map<string, SupplierProfile>()

export async function fillSupplierCode<T extends {
  supplier_id: string
  supplier_code?: string
  contact_phone?: string | null
}>(
  rows: T[],
): Promise<T[]> {
  if (!rows.length) return rows
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const cached = supplierCodeCache.get(row.supplier_id)
      if (cached) {
        return { ...row, supplier_code: cached.code, contact_phone: cached.phone }
      }
      try {
        const res = await getSupplierDetail(row.supplier_id)
        const sd = (res.data as { supplier?: Array<{
          supplier_code?: string
          contact_phone?: string | null
          phone1?: string | null
          phone2?: string | null
          principal_phone?: string | null
        }> }).supplier?.[0]
        const code = sd?.supplier_code || ''
        // 联系电话：按业务口径优先取 phone1（电话1），缺失时回退 contact_phone / phone2 / 负责人电话
        const phone = [sd?.phone1, sd?.contact_phone, sd?.phone2, sd?.principal_phone].find(p => p && String(p).trim()) || ''
        supplierCodeCache.set(row.supplier_id, { code, phone })
        return { ...row, supplier_code: code, contact_phone: phone }
      } catch {
        return { ...row, supplier_code: row.supplier_code ?? '', contact_phone: row.contact_phone ?? '' }
      }
    }),
  )
  return enriched
}
