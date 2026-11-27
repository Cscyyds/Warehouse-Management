import { safeErrorText } from '@/utils/serverErrorDisplay'
import { pdfFetch, authHeaders } from '@/utils/pdfApi'
import { activeSession } from '@/utils/session'
import type { SourceDocument, Chunk } from './processing'
import { createAskStreamState, feedAskSse, finishAskStream } from './askStream'
import type { AskResult, AskSource } from './askStream'

const BASE = '/api/v1/knowledge/workspace'
export type ContentType = 'product' | 'faq' | 'manual' | 'policy' | 'generic'
export interface ContentTypeSuggestion { content_type: ContentType; summary: string; reason: string; model?: string; evidence?: { source_id: string; page?: number; sheet?: string }[]; sample_count?: number }
export interface ContentProfile { parse_revision: string; confirmed_type: ContentType | null; rule_type: ContentType; rule_basis: string; suggestion: ContentTypeSuggestion | null }
export function contentProfile(id: string, signal?: AbortSignal) { return request<ContentProfile>(`/documents/${id}/content-profile`, {}, signal) }
export function suggestContentType(id: string, signal?: AbortSignal) { return post<{ parse_revision: string; suggestion: ContentTypeSuggestion }>(`/documents/${id}/content-type-suggestion`, {}, signal) }
export function confirmContentType(id: string, type: ContentType, revision: string, signal?: AbortSignal) { return request<ContentProfile>(`/documents/${id}/content-type`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content_type: type, parse_revision: revision }) }, signal) }
export interface ServerJob { id: string; document_id: string; document_name?: string; kind: 'parse' | 'process'; status: string; stage: string; progress: number; error: string; created_at: string }
export interface ServerDocument { id: string; name: string; kind: string; size: number; status: string; parse_job_id: string | null; process_job_id: string | null; library_id: string | null; category: string; description: string; created_at: string; tags?: Tag[] }
export interface Asset { id: string; path: string; origin: Record<string, unknown> }
export interface PageRoute { page: number; path: 'native' | 'native+tables' | 'vlm' | 'skipped'; reason?: string; table_count?: number; table_rows?: number; numeric_conflicts?: { table: number; row: number; column: number; vlm: string; native: string }[] }
export interface Preview {
  image_selection?: { asset_occurrences: number; unique_assets: number; selected_unique: number; skipped_reasons: Record<string, number>; whole_page_selected: number }
  document: ServerDocument; job: ServerJob; text: string; images: Asset[]; warnings: string[]; sheets: { name: string; rows: string[][] }[]
  text_complete?: boolean; text_total_chars?: number
  blocks?: { id: number; text: string; origin?: Record<string, unknown> }[]
  blocks_total?: number; blocks_offset?: number; blocks_has_more?: boolean
  images_total?: number; images_offset?: number; images_has_more?: boolean
  content_type?: string; content_type_basis?: string; cleaning?: string[]; page_routes?: PageRoute[]
}
export interface LibrarySummary { id: string; name: string; document_count: number; created_at: string }
export interface LibraryDetail {
  id: string; name: string; created_at: string
  statistics: { total_documents: number; total_size_bytes: number; last_updated: string | null; type_distribution: Record<string, number> }
  recent_documents: ServerDocument[]
}
export interface ProcessResult { embedding_model: string; chunks: (Omit<Chunk, 'sourceId' | 'sourceName'> & { origin: Record<string, unknown> })[]; text_chars: number; image_count: number; options: { library_name: string; category: string; description: string; titleIndex: boolean; autoIndex: boolean; imageIndex: boolean } }

export async function request<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const timeout = new AbortController()
  const abort = () => timeout.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) timeout.abort()
  const timer = setTimeout(() => timeout.abort(), 90000)
  try {
    const headers = new Headers(authHeaders())
    new Headers(init.headers).forEach((value, key) => headers.set(key, value))
    const response = await pdfFetch(BASE + path, { ...init, headers, signal: timeout.signal })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(safeErrorText(response.status === 401 ? '请先登录后上传资料' : typeof body.detail === 'string' ? body.detail : `请求失败（${response.status}）`, response.status))
    }
    return await response.json() as T
  } catch (error) {
    if (timeout.signal.aborted && !signal?.aborted) throw new Error('请求超时。任务会在后台保留，可在处理记录中重试或继续查看。')
    throw error
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort)
  }
}
export function post<T>(path: string, value: unknown = {}, signal?: AbortSignal) {
  return request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }, signal)
}
function delay(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('已停止等待', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 1200)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
}
export async function waitJob(id: string, update: (job: ServerJob) => void, signal?: AbortSignal) {
  while (true) {
    const job = await request<ServerJob>(`/jobs/${id}`, {}, signal)
    update(job)
    if (['done', 'partial', 'failed', 'cancelled'].includes(job.status)) return job
    await delay(signal)
  }
}
export function preview(id: string, signal?: AbortSignal) { return request<Preview>(`/documents/${id}/preview`, {}, signal) }
export function listLibraries(search = '') {
  const query = new URLSearchParams({ limit: '200' })
  if (search) query.set('search', search)
  return request<{ libraries: LibrarySummary[]; total: number }>(`/libraries?${query}`)
}
export function createLibrary(name: string) { return post<LibrarySummary>('/libraries', { name }) }
export function libraryDetail(id: string) { return request<LibraryDetail>(`/libraries/${id}`) }
export function deleteLibrary(id: string) {
  return request<{ deleted: boolean; affected_documents: number }>(`/libraries/${id}`, { method: 'DELETE' })
}
export function toSource(p: Preview): SourceDocument {
  // 超大文档服务端不再内联全文（text_complete=false），此时用首批分块拼出预览正文，
  // 并明确提示仅展示首页内容；分页参数见 preview() 的 block_offset/block_limit。
  const paged = p.text_complete === false ? (p.blocks || []).map(b => b.text).join('\n\n') : p.text
  const notes = p.warnings.length ? [p.warnings.join('；')] : []
  if (p.text_complete === false) {
    notes.push(`正文较长（共 ${(p.text_total_chars ?? 0).toLocaleString()} 字符），此处仅显示首批 ${(p.blocks || []).length} 个内容块；入库会处理全文。`)
  }
  return { id: p.document.id, name: p.document.name, kind: p.document.kind.toUpperCase(), size: p.document.size,
    text: paged, sheets: p.sheets.length ? p.sheets : undefined, parser: 'server', parseJobId: p.job.id,
    serverStatus: p.job.status, images: p.images, contentType: p.content_type, cleaning: p.cleaning,
    pageRoutes: p.page_routes,
    issue: notes.length ? notes.join('；') : undefined }
}
function resumeKey() {
  const session = activeSession()
  return `workspace-upload:${session?.kind}:${session?.company_id}:${session?.operator_id}`
}
export async function upload(file: File, update: (stage: string) => void, signal?: AbortSignal) {
  const signature = `${file.name}:${file.size}:${file.lastModified}`
  const key = resumeKey()
  let uploadId = '', chunkSize = 0, total = 0
  let received: number[] = []
  let saved: { signature: string; id: string } | null = null
  try { saved = JSON.parse(sessionStorage.getItem(key) || 'null') } catch { /* storage may be disabled */ }
  if (saved?.signature === signature) {
    try {
      const state = await request<{ chunk_size: number; total_chunks: number; received: number[]; hashes: Record<string, string>; status: string }>(`/uploads/${saved.id}`, {}, signal)
      uploadId = saved.id; chunkSize = state.chunk_size; total = state.total_chunks; received = state.received
      // Metadata alone cannot establish that two files have identical contents.
      for (const i of received) {
        const buffer = await file.slice(i * chunkSize, Math.min(file.size, (i + 1) * chunkSize)).arrayBuffer()
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), b => b.toString(16).padStart(2, '0')).join('')
        if (hash !== state.hashes[String(i)]) { uploadId = ''; received = []; break }
      }
    } catch (error) { if (signal?.aborted) throw error }
  }
  if (!uploadId) {
    const init = await post<{ upload_id: string; chunk_size: number; total_chunks: number }>('/uploads', { file_name: file.name, file_size: file.size, content_type: file.type }, signal)
    uploadId = init.upload_id; chunkSize = init.chunk_size; total = init.total_chunks
    try { sessionStorage.setItem(key, JSON.stringify({ signature, id: uploadId })) } catch { /* optional resume */ }
  }
  // Two bounded workers keep hashing, upload bodies and retries within a fixed memory budget.
  const pending = Array.from({ length: total }, (_, i) => i).filter(i => !received.includes(i))
  let done = received.length, cursor = 0
  const worker = async () => {
    while (cursor < pending.length) {
      const index = pending[cursor++]!
      const blob = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize))
      const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
      const digest = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
      let success = false
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const form = new FormData(); form.set('index', String(index)); form.set('sha256', digest); form.set('file', blob, 'chunk')
          await request(`/uploads/${uploadId}/chunks`, { method: 'POST', body: form }, signal)
          success = true; break
        } catch (error) {
          if (signal?.aborted || attempt === 2) throw error
          await delay(signal)
        }
      }
      if (success) update(`上传 ${file.name} · ${Math.round(++done * 100 / total)}%`)
    }
  }
  const results = await Promise.allSettled([worker(), worker()])
  for (const result of results) if (result.status === 'rejected') throw result.reason
  update(`校验并合并 ${file.name}`)
  const result = await post<{ document: ServerDocument; job: ServerJob }>(`/uploads/${uploadId}/complete`, {}, signal)
  try { sessionStorage.removeItem(key) } catch { /* optional resume */ }
  return result
}
export async function blobUrl(path: string, signal?: AbortSignal) {
  const response = await pdfFetch(BASE + path, { headers: authHeaders(), signal })
  if (!response.ok) throw new Error(safeErrorText('预览文件加载失败', response.status))
  return URL.createObjectURL(await response.blob())
}
export async function allDocuments() {
  const all: ServerDocument[] = []
  for (let offset = 0; ; offset += 200) {
    const { documents } = await request<{ documents: ServerDocument[] }>(`/documents?offset=${offset}&limit=200`)
    all.push(...documents)
    if (documents.length < 200) return all
  }
}

export interface SearchHit {
  score: number
  id: string
  document_id: string
  library_id?: string | null
  version?: string
  text: string
  index: string
  origin?: Record<string, unknown>
  document_name?: string
}

export function searchDocuments(query: string, libraryId?: string, tagIds: string[] = []) {
  const body: Record<string, unknown> = { query, limit: 10 }
  if (libraryId) body.library_id = libraryId
  if (tagIds.length) body.tag_ids = tagIds
  return post<{ hits: SearchHit[] }>('/search', body)
}

export interface Tag { id: string; name: string; dimension: string; keywords?: string; document_count?: number }
export interface TagSuggestion { id: string; name: string; dimension: string; reason: string; score: number }

export function listTags(dimension?: string) {
  const query = new URLSearchParams()
  if (dimension) query.set('dimension', dimension)
  const suffix = query.toString() ? `?${query}` : ''
  return request<{ tags: Tag[] }>(`/tags${suffix}`)
}
export function createTag(name: string, dimension: string, keywords = '') {
  return post<Tag & { created: boolean }>('/tags', { name, dimension, keywords })
}
export function documentTags(id: string) { return request<{ tags: Tag[] }>(`/documents/${id}/tags`) }
export function updateDocumentTags(id: string, tag_ids: string[]) {
  return request<{ tags: Tag[] }>(`/documents/${id}/tags`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag_ids }),
  })
}
export function tagSuggestions(id: string) {
  return request<{ suggestions: TagSuggestion[] }>(`/documents/${id}/tag-suggestions`)
}

// ── 知识问答（RAG，SSE 流式）──────────────────────────
export type { AskResult, AskSource } from './askStream'
export interface AskHistoryItem { role: 'user' | 'assistant'; content: string }
export interface AskPayload {
  question: string
  library_id?: string
  tag_ids?: string[]
  history?: AskHistoryItem[]
  model?: string
}

/**
 * 提问并消费流式回答。onSources 先于回答到达；onDelta 回传累计全文。
 * 用户停止（signal）抛 AbortError；整体 180s 超时抛普通 Error。
 */
export async function askKnowledge(
  body: AskPayload,
  callbacks: { onSources?: (hits: AskSource[]) => void; onDelta?: (answer: string) => void },
  signal?: AbortSignal,
): Promise<AskResult> {
  const timeout = new AbortController()
  const abort = () => timeout.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) timeout.abort()
  const timer = setTimeout(() => timeout.abort(), 180000)
  try {
    const headers = new Headers(authHeaders())
    headers.set('Content-Type', 'application/json')
    headers.set('Accept', 'text/event-stream')
    const response = await pdfFetch(BASE + '/ask', { method: 'POST', headers, body: JSON.stringify(body), signal: timeout.signal })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(safeErrorText(response.status === 401 ? '请先登录后提问' : typeof payload.detail === 'string' ? payload.detail : `请求失败（${response.status}）`, response.status))
    }
    if (!response.body) throw new Error('浏览器无法读取流式回答')
    const state = createAskStreamState()
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    const relay = { onSources: callbacks.onSources, onDelta: () => callbacks.onDelta?.(state.answer) }
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      feedAskSse(state, decoder.decode(value, { stream: true }), relay)
    }
    feedAskSse(state, decoder.decode(), relay)
    return finishAskStream(state)
  } catch (error) {
    if (timeout.signal.aborted && !signal?.aborted) throw new Error('回答超时，请重试')
    throw error
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort)
  }
}
