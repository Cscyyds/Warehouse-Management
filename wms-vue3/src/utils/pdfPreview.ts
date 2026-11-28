/**
 * 模块：单据 PDF 实时预览（弹窗左侧预览图用）
 *
 * 可行性依据（已核实）：
 * - 后端三个 print/pdf 端点都是**幂等只读渲染**（StreamingResponse 返回 application/pdf），
 *   同一组 hide_fields / hide_sections 生成同一份 PDF，因此预览可直接复用下载接口，无需新接口。
 * - 项目内已有同款先例：`PrintLabelDialog.vue` 用 `<iframe :src="data:application/pdf;base64,...">`。
 *
 * 本模块只负责「要不要发、发哪次、哪个结果算数」，不碰 UI：
 * - 防抖：勾选是连续动作，不能每勾一下打一次后端；
 * - 竞态：用户连点后，慢的旧响应不能覆盖快的新响应；
 * - 取消：过期请求直接丢弃，避免内存与网络浪费。
 */
import type { PdfDocKind } from '@/config/pdfExportOptions'
import type { PdfExportSnapshot } from '@/utils/pdfExport'

/** 预览请求的最少间隔：勾选是连续动作，等用户停下来再渲染 */
export const PREVIEW_DEBOUNCE_MS = 420

export interface PdfPreviewState {
  /** 预览用 object URL；空串表示无预览 */
  url: string
  /** 正在渲染 */
  loading: boolean
  /** 最近一次预览失败的中文原因 */
  error: string
}

export interface PdfPreviewRequest {
  kind: PdfDocKind
  billId: string
  hideFields: string[]
  hideSections: string[]
}

/** 由快照派生预览请求（与下载共用同一份参数，保证所见即所得） */
export function snapshotToPreviewRequest(snapshot: PdfExportSnapshot): PdfPreviewRequest {
  return {
    kind: snapshot.kind,
    billId: snapshot.billId,
    hideFields: [...snapshot.hideFields],
    hideSections: [...snapshot.hideSections],
  }
}

/** 两次预览请求的参数是否等价（用于跳过无变化的重复渲染） */
export function isSamePreviewRequest(a: PdfPreviewRequest | null, b: PdfPreviewRequest | null): boolean {
  if (!a || !b) return a === b
  if (a.kind !== b.kind || a.billId !== b.billId) return false
  if (a.hideFields.length !== b.hideFields.length) return false
  if (a.hideSections.length !== b.hideSections.length) return false
  const af = new Set(a.hideFields)
  const bf = new Set(b.hideFields)
  for (const key of af) if (!bf.has(key)) return false
  const as = new Set(a.hideSections)
  const bs = new Set(b.hideSections)
  for (const key of as) if (!bs.has(key)) return false
  return true
}

/**
 * 预览 URL 生命周期管理。
 * 必须在组件卸载时调用 `dispose()`，否则 object URL 会泄漏（浏览器不会自动回收 Blob）。
 */
export function createPdfPreviewController(options: {
  /** 实际发请求：返回 PDF Blob */
  fetchPdf: (req: PdfPreviewRequest) => Promise<Blob>
  /** 状态变化回调（由组件用来更新 ref） */
  onChange: (state: PdfPreviewState) => void
  /** 防抖时长，默认 PREVIEW_DEBOUNCE_MS；测试可传 0 */
  debounceMs?: number
}) {
  const debounceMs = options.debounceMs ?? PREVIEW_DEBOUNCE_MS
  let timer: ReturnType<typeof setTimeout> | null = null
  let currentUrl = ''
  let disposed = false
  // 竞态令牌：只有最新一次请求的结果才允许落地
  let seq = 0
  let lastRequest: PdfPreviewRequest | null = null

  function revoke(url: string) {
    if (!url) return
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* 已释放或环境不支持，忽略 */
    }
  }

  function emit(state: PdfPreviewState) {
    if (disposed) return
    options.onChange(state)
  }

  async function run(req: PdfPreviewRequest, token: number) {
    if (disposed || token !== seq) return
    emit({ url: currentUrl, loading: true, error: '' })
    try {
      const blob = await options.fetchPdf(req)
      // 响应回来时若已有更新的请求，丢弃本次结果
      if (disposed || token !== seq) return
      const next = URL.createObjectURL(blob)
      revoke(currentUrl)
      currentUrl = next
      emit({ url: currentUrl, loading: false, error: '' })
    } catch (error) {
      if (disposed || token !== seq) return
      const message = error instanceof Error ? error.message : 'PDF 预览生成失败'
      // 预览失败不撤掉旧图，避免界面闪空；用 error 提示用户；
      // lastRequest 回退为空，使「重试同参数」不会被短路挡住
      lastRequest = null
      emit({ url: currentUrl, loading: false, error: message })
    }
  }

  /** 请求刷新预览（内部防抖 + 竞态保护） */
  function request(req: PdfPreviewRequest, immediate = false) {
    if (disposed) return
    // 参数与「最近一次已发起或已成功」的一致且当前有图 → 不必重渲染。
    // 注意要连 immediate 一起挡：否则外部 immediate 调用会绕过短路，造成重复渲染。
    if (currentUrl && isSamePreviewRequest(lastRequest, req)) return
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    lastRequest = req
    seq += 1
    const token = seq
    if (immediate || debounceMs <= 0) {
      void run(req, token)
      return
    }
    timer = setTimeout(() => {
      timer = null
      void run(req, token)
    }, debounceMs)
  }

  /** 立即重试（错误提示里的「重试」按钮用） */
  function retry(req: PdfPreviewRequest) {
    lastRequest = null
    request(req, true)
  }

  /** 释放：清定时器、作废进行中的请求、回收 object URL */
  function dispose() {
    disposed = true
    seq += 1
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    revoke(currentUrl)
    currentUrl = ''
    lastRequest = null
  }

  return { request, retry, dispose }
}

/** 把 Blob 转成 iframe 可直接消费的 data URL（与 PrintLabelDialog 的做法一致） */
export function blobToPdfDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('PDF 读取失败'))
    reader.readAsDataURL(blob)
  })
}
