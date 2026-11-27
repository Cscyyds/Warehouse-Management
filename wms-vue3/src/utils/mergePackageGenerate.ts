export interface MergeGenerateDraft {
  productId: string
  quantity: string
  count: string
  specifyLength: boolean
  length: string
  lengthUnit: string
}

/** 仅产品实际配置的辅助长度单位允许填写长度；兼容中文名称及英文大小写。 */
export function mergeProductLengthUnit(product: { assist_unit_id?: string | null; assist_unit_name?: string | null }): string | undefined {
  if (!product.assist_unit_id) return undefined
  const aliases: Record<string, string> = {
    m: 'm', dm: 'dm', cm: 'cm', mm: 'mm',
    米: 'm', 公尺: 'm', 分米: 'dm', 厘米: 'cm', 公分: 'cm', 毫米: 'mm', 公厘: 'mm',
  }
  return aliases[product.assist_unit_name?.trim().toLowerCase() ?? '']
}

export function mergeGenerateError(draft: MergeGenerateDraft): string {
  if (!draft.productId) return '请选择产品'
  if (!/^\d{1,14}(?:\.\d{1,4})?$/.test(draft.quantity.trim()) || !/[1-9]/.test(draft.quantity)) return '单包数量须大于0，最多四位小数'
  if (!/^[1-9]\d*$/.test(draft.count.trim()) || !Number.isSafeInteger(Number(draft.count))) return '生成件数须为正整数'
  if (draft.specifyLength && (!/^\d{1,12}(?:\.\d{1,6})?$/.test(draft.length.trim()) || !/[1-9]/.test(draft.length) || !['m', 'dm', 'cm', 'mm'].includes(draft.lengthUnit))) return '请输入大于0、最多六位小数的长度'
  return ''
}

export function mergeGeneratePayload(draft: MergeGenerateDraft) {
  const error = mergeGenerateError(draft)
  if (error) throw new Error(error)
  return { product_id: draft.productId, merge_qty: draft.quantity.trim(), package_count: draft.count.trim(),
    ...(draft.specifyLength ? { merge_length: `${draft.length.trim()}${draft.lengthUnit}` } : {}) }
}

export function generatedQuantityTotal(quantity: string, count: string): string {
  if (!/^\d+(?:\.\d{1,4})?$/.test(quantity.trim()) || !/^[1-9]\d*$/.test(count.trim())) return '-'
  const [whole, fraction = ''] = quantity.trim().split('.')
  const total = (BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'))) * BigInt(count.trim())
  const decimal = (total % 10000n).toString().padStart(4, '0').replace(/0+$/, '')
  return `${total / 10000n}${decimal ? `.${decimal}` : ''}`
}
import type { GeneratedMergePackage, GenerateMergePackageResult } from '../api/modules/scannerMergePackage'


export type MergeGenerationStatus = 'pending' | 'running' | 'success' | 'failed' | 'unknown'
export interface MergeGenerationJob {
  key: string
  productCode: string
  productName: string
  sourceBarcode: string
  draft: MergeGenerateDraft
  status: MergeGenerationStatus
  generated: GeneratedMergePackage[]
  error: string
}

/** 每个请求结束后间隔300ms再发送下一项；只发送pending，成功/未确认项永不自动重发。 */
export async function runMergeGenerationBatch(jobs: MergeGenerationJob[], send: (payload: ReturnType<typeof mergeGeneratePayload>) => Promise<GenerateMergePackageResult>,
  options: { isActive?: () => boolean; wait?: (ms: number) => Promise<void> } = {}) {
  const snapshots = jobs.filter(job => job.status === 'pending').map(job => ({ job, payload: mergeGeneratePayload({ ...job.draft }) }))
  const wait = options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  for (let index = 0; index < snapshots.length; index++) {
    if (index) await wait(300)
    if (options.isActive && !options.isActive()) return '登录会话已变化，后续任务未发送'
    const { job, payload } = snapshots[index]!
    job.status = 'running'
    job.error = ''
    try {
      const result = await send(payload)
      if (options.isActive && !options.isActive()) { job.status = 'unknown'; job.error = '登录会话变化，结果未确认'; return job.error }
      job.generated = result.new_merge_packages
      job.status = 'success'
    } catch (err) {
      const failure = err as { message?: string; response?: { status?: number } }
      const status = failure.response?.status
      job.status = !status || status >= 500 || status === 408 ? 'unknown' : 'failed'
      job.error = failure.message || '请求失败'
      if (job.status === 'unknown') return '有请求结果未确认，后续任务未发送。请先核对合包列表，勿重复生成该项'
      if (status === 401 || status === 403) return '登录或权限校验失败，后续任务未发送'
    }
  }
  return ''
}
