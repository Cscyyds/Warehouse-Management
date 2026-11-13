/**
 * 日常办公（小星智问）agent_poc 接口客户端。
 *
 * 与 app 工程 AiApiClient.kt 逐层对齐：
 * - 会话列表：GET  /api/sessions?limit=100 → {sessions:[{sid,title,preview,updated_at}]}
 * - 历史消息：GET  /api/history?sid=&limit=200 → {messages:[…], pending}
 * - 删除会话：POST /api/reset {sid}（软删除，同 sid 再发消息即全新会话）
 * - 附件上传：POST /api/upload（multipart）→ {success, kind, name, url}
 * - 流式对话：POST /api/chat/stream（SSE：delta{text} / done{reply, options} / error{error}）
 * - 语音纠错：POST /api/v1/asr/correction（ASR 网关根路径，fire-and-forget）
 *
 * 所有请求带 Authorization: Bearer <WMS JWT>；401/403 视为登录态失效。
 * 前端走同源相对路径：/agent-poc 由 vite dev 代理 / nginx 转发到 7779 网关。
 */
import type {
  OfficeChatMessage,
  OfficeConversationSession,
  OfficePendingFile,
  OfficeUserAttachment,
} from '@/agent/types'

const AGENT_POC_BASE = '/agent-poc'
const ASR_CORRECTION_PATH = '/api/v1/asr/correction'
const SESSION_LIMIT = 100
const HISTORY_LIMIT = 200
/** agent_poc 没有“新建会话”接口：sid 由客户端生成，首条消息时服务端惰性建档。 */
const SESSION_ID_PREFIX = 'web-'

type JsonRecord = Record<string, unknown>

/** agent_poc 接口错误；statusCode 401/403 表示登录态失效。 */
export class OfficeApiError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode = 0) {
    super(message)
    this.name = 'OfficeApiError'
    this.statusCode = statusCode
  }

  get isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403
  }
}

/** 网络中断 / 流未正常收尾（app IOException → 恢复轮询而不是报错弹窗）。 */
export class OfficeStreamDisconnectedError extends Error {
  constructor(message = '对话连接中断，正在同步后台结果') {
    super(message)
    this.name = 'OfficeStreamDisconnectedError'
  }
}

export interface OfficeChatStreamResult {
  content: string
  options: string[]
  status: 'waiting_input' | 'success'
}

export interface OfficeChatStreamCallbacks {
  /** delta 逐字累计后的全文。 */
  onProgress?: (content: string) => void
}

export interface OfficeUploadResult {
  name: string
  url: string
  kind: 'excel' | 'image'
  size: number
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  const token = localStorage.getItem('token')?.trim()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

function apiErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body
  if (!isRecord(body)) return fallback
  // FastAPI 错误体为 {"detail":"…"}；WMS 登录失败把具体原因放在字符串型 data。
  const dataDetail = typeof body.data === 'string' && body.data.trim() ? body.data : ''
  for (const key of ['detail', 'error_message', 'message', 'msg']) {
    const value = body[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return dataDetail || fallback
}

function toOfficeApiError(body: unknown, statusCode: number, fallback: string): OfficeApiError {
  return new OfficeApiError(apiErrorMessage(body, fallback), statusCode)
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** 统一拆包：{success:false} / {code!==200} 抛错，否则返回 data 字段或原对象。 */
function unwrapApiData(body: unknown): unknown {
  if (!isRecord(body)) return body
  if (typeof body.success === 'boolean') {
    if (!body.success) throw new OfficeApiError(apiErrorMessage(body, '业务处理失败'))
    return body.data ?? {}
  }
  if (body.code !== undefined && body.code !== null) {
    if (Number(body.code) !== 200) throw new OfficeApiError(apiErrorMessage(body, '业务处理失败'))
    return body.data ?? {}
  }
  return body
}

async function requestJson(
  path: string,
  init?: RequestInit,
  options?: { unwrap?: boolean },
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, { ...init, headers: authHeaders(init?.headers) })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new OfficeStreamDisconnectedError('网络连接不可用，请检查网络后重试')
  }
  const body = await parseResponseBody(response)
  if (!response.ok) throw toOfficeApiError(body, response.status, `请求失败（HTTP ${response.status}）`)
  if (options?.unwrap === false) return body
  return unwrapApiData(body)
}

// ─── 会话列表 / 历史 ────────────────────────────────────────────────────

/** agent_poc 输出统一为带 UTC 偏移的 ISO 时间；无时区后缀时按 UTC 解析。 */
export function parseOfficeIsoUtc(value: string): number | null {
  const text = String(value || '').trim()
  if (!text) return null
  // 无时区标记的日期时间 JS 会按本地时区解析，须显式补 Z 按 UTC 处理
  const millis = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(text)
    ? Date.parse(text)
    : Date.parse(`${text}Z`)
  return Number.isFinite(millis) ? millis : null
}

export function formatOfficeRelativeTime(iso: string): string {
  const millis = parseOfficeIsoUtc(iso)
  if (millis === null) return '刚刚'
  const diffMinutes = Math.floor((Date.now() - millis) / 60_000)
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes}分钟前`
  if (diffMinutes < 60 * 24) return `${Math.floor(diffMinutes / 60)}小时前`
  if (diffMinutes < 60 * 48) return '昨天'
  const date = new Date(millis)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => (item == null ? '' : String(item).trim()))
    .filter(item => item.length > 0)
}

export function normalizeOfficeSessions(data: unknown): OfficeConversationSession[] {
  const root = isRecord(data) ? data : {}
  const sessions = Array.isArray(root.sessions) ? root.sessions : []
  const result: OfficeConversationSession[] = []
  sessions.forEach((item) => {
    const source = isRecord(item) ? item : {}
    const sid = source.sid == null ? '' : String(source.sid)
    if (!sid) return
    result.push({
      id: sid,
      title: String(source.title || '').trim() || '新会话',
      preview: String(source.preview || ''),
      updatedAt: formatOfficeRelativeTime(String(source.updated_at || '')),
    })
  })
  return result
}

export async function fetchOfficeSessions(): Promise<OfficeConversationSession[]> {
  const data = await requestJson(`${AGENT_POC_BASE}/api/sessions?limit=${SESSION_LIMIT}`)
  return normalizeOfficeSessions(data)
}

export function normalizeOfficeHistory(data: unknown, sessionId: string): OfficeChatMessage[] {
  const root = isRecord(data) ? data : {}
  const items = Array.isArray(root.messages) ? root.messages : []
  const messages: OfficeChatMessage[] = []
  items.forEach((item, index) => {
    const source = isRecord(item) ? item : {}
    const role = String(source.role || '') === 'user' ? 'user' : 'assistant'
    const turnNo = source.turn_no == null ? '' : String(source.turn_no)
    const createdAt = parseOfficeIsoUtc(String(source.created_at || '')) ?? Date.now()
    messages.push({
      id: `history_${sessionId}_t${turnNo}_${role}_${index}`,
      sessionId,
      role,
      content: String(source.content || ''),
      options: stringList(source.options),
      payload: { statusSteps: [], images: [], files: [] },
      status: String(source.finish_reason || '') === 'error' ? 'error' : 'success',
      createdAt,
    })
  })
  // 会话存在挂起态（clarify/select/confirm）时，重绘最后一条带选项的回复为待作答状态
  if (isRecord(root.pending)) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role !== 'assistant') continue
      if (messages[index].options.length) messages[index].status = 'waiting_input'
      break
    }
  }
  return messages.filter(message => message.content.trim().length > 0 || message.options.length > 0)
}

export async function fetchOfficeMessages(sessionId: string): Promise<OfficeChatMessage[]> {
  const id = sessionId.trim()
  if (!id) return []
  const data = await requestJson(
    `${AGENT_POC_BASE}/api/history?sid=${encodeURIComponent(id)}&limit=${HISTORY_LIMIT}`,
  )
  if (!isRecord(data)) throw new OfficeApiError('历史消息响应无效')
  return normalizeOfficeHistory(data, id)
}

export function generateOfficeSessionId(): string {
  const random = Math.random().toString(16).slice(2, 14)
  return `${SESSION_ID_PREFIX}${random.padEnd(12, '0').slice(0, 12)}`
}

/** 删除会话 = POST /api/reset（软删除，同 sid 再发消息即全新会话）。 */
export async function deleteOfficeSession(sessionId: string): Promise<void> {
  await requestJson(`${AGENT_POC_BASE}/api/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sid: sessionId }),
  })
}

// ─── 附件上传（POST /api/upload） ──────────────────────────────────────

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic'])

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/csv': 'csv',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/zip': 'zip',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/heic': 'heic',
}

/** 上传目标（文件名 + part MIME + kind）：补齐无后缀文件名，图片按内容/后缀识别。 */
export function resolveOfficeUploadTarget(file: File): { name: string; mime: string; kind: 'excel' | 'image' } {
  const safeName = file.name.replace(/["\\]/g, '_') || '未命名文件'
  const mime = file.type && !file.type.includes('*') && file.type !== 'application/octet-stream'
    ? file.type
    : 'application/octet-stream'
  const extension = safeName.includes('.')
    ? safeName.slice(safeName.lastIndexOf('.') + 1).toLowerCase()
    : ''
  const isImage = mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)
  const kind: 'excel' | 'image' = isImage ? 'image' : 'excel'
  const name = extension || !MIME_EXTENSION_MAP[mime]
    ? safeName
    : `${safeName}.${MIME_EXTENSION_MAP[mime]}`
  return { name, mime, kind }
}

export function friendlyOfficeUploadError(message: string): string {
  if (/openpyxl does not support the old \.xls/i.test(message)) {
    return '该表格是老版 .xls 格式，服务端暂时无法解析，请先在 WPS/Excel 中另存为 .xlsx 后再发送'
  }
  return message
}

export async function uploadOfficeChatFile(file: File, signal?: AbortSignal): Promise<OfficeUploadResult> {
  const target = resolveOfficeUploadTarget(file)
  const form = new FormData()
  form.append('file', file, target.name)
  // /api/upload 直接返回 {success, kind, name, url}，不做统一 data 拆包（app 同款处理）。
  const body = await requestJson(`${AGENT_POC_BASE}/api/upload`, {
    method: 'POST',
    body: form,
    signal,
  }, { unwrap: false })
  const source = isRecord(body) ? body : {}
  if (typeof source.success === 'boolean' && !source.success) {
    throw toOfficeApiError(source, 0, '文件上传失败')
  }
  const url = String(source.url || '').trim()
  if (!url) throw new OfficeApiError('上传接口未返回文件地址')
  const serverName = String(source.name || '')
  return {
    // 服务端回显名含 U+FFFD 说明其存档名已乱码，回退本地原名
    name: serverName && !serverName.includes('\uFFFD') ? serverName : target.name,
    url,
    kind: String(source.kind || '') === 'image' ? 'image' : 'excel',
    size: file.size,
  }
}

// ─── 流式对话（POST /api/chat/stream，SSE） ────────────────────────────

export interface AgentPocStreamState {
  buffer: string
  content: string
  options: string[]
  done: boolean
  error: string
}

export function createAgentPocStreamState(): AgentPocStreamState {
  return { buffer: '', content: '', options: [], done: false, error: '' }
}

/**
 * 消费一段 SSE 文本。可见事件：delta{text} 逐字追加、done{reply, options} 终答、
 * error{error} 异常（Agent 思考过程已被服务端过滤）。done.reply 是权威终答
 * （快速通道无 delta，全文只在 done 里）。
 */
export function feedAgentPocSse(
  state: AgentPocStreamState,
  text: string,
  callbacks?: OfficeChatStreamCallbacks,
): void {
  if (!text) return
  state.buffer += text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  let separator = state.buffer.indexOf('\n\n')
  while (separator >= 0) {
    const block = state.buffer.slice(0, separator)
    state.buffer = state.buffer.slice(separator + 2)
    consumeAgentPocEvent(state, block, callbacks)
    separator = state.buffer.indexOf('\n\n')
  }
}

function consumeAgentPocEvent(
  state: AgentPocStreamState,
  block: string,
  callbacks?: OfficeChatStreamCallbacks,
): void {
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!dataLines.length) return
  let data: JsonRecord
  try {
    const parsed = JSON.parse(dataLines.join('\n')) as unknown
    data = isRecord(parsed) ? parsed : {}
  } catch {
    return
  }
  const type = String(data.type || '')
  if (type === 'delta') {
    state.content += String(data.text || '')
    if (state.content.trim()) callbacks?.onProgress?.(state.content)
  } else if (type === 'done') {
    const reply = String(data.reply || '')
    if (reply.trim()) state.content = reply
    state.options = stringList(data.options)
    state.done = true
  } else if (type === 'error') {
    state.error = String(data.error || '') || '对话服务返回错误'
  }
}

/** 流读完后收尾：未收到 done 视为连接中断（交给恢复轮询）。 */
export function finishAgentPocStream(
  state: AgentPocStreamState,
  callbacks?: OfficeChatStreamCallbacks,
): OfficeChatStreamResult {
  if (state.buffer.trim()) consumeAgentPocEvent(state, state.buffer, callbacks)
  if (state.error) throw new OfficeApiError(state.error)
  if (!state.done) throw new OfficeStreamDisconnectedError()
  return {
    content: state.content,
    options: state.options,
    status: state.options.length ? 'waiting_input' : 'success',
  }
}

export interface OfficeStreamAttachments {
  kind: 'excel' | 'image'
  name: string
  url: string
}

export async function streamOfficeChat(
  input: {
    sessionId: string
    text: string
    messageId: string
    attachments: OfficeStreamAttachments[]
    webSearch?: boolean
  },
  callbacks: OfficeChatStreamCallbacks,
  signal?: AbortSignal,
): Promise<OfficeChatStreamResult & { messageId: string; sessionId: string }> {
  const sid = input.sessionId.trim()
  if (!sid) throw new OfficeApiError('会话尚未创建，请稍后重试')
  const message = input.text.trim()
  const readyAttachments = input.attachments.filter(item => item.url)
  if (!message && readyAttachments.length === 0) throw new OfficeApiError('请输入对话内容')

  const payload: JsonRecord = {
    sid,
    message,
    ...(input.webSearch === true ? { web_search: true } : {}),
    ...(readyAttachments.length
      ? {
          attachments: readyAttachments.map(attachment => ({
            kind: attachment.kind,
            name: attachment.name,
            url: attachment.url,
          })),
        }
      : {}),
    request_id: `${SESSION_ID_PREFIX}${Math.random().toString(16).slice(2, 18)}`,
  }

  let response: Response
  try {
    response = await fetch(`${AGENT_POC_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    // 网络层失败（连接拒绝/断网）与流中断同待遇：交给恢复轮询而不是报错弹窗
    throw new OfficeStreamDisconnectedError()
  }
  if (!response.ok) {
    const body = await parseResponseBody(response)
    throw toOfficeApiError(body, response.status, '对话服务调用失败')
  }
  if (!response.body) throw new OfficeStreamDisconnectedError('浏览器无法读取流式响应')

  const state = createAgentPocStreamState()
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  const emitProgress = (content: string) => {
    if (content.trim()) callbacks.onProgress?.(content)
  }
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      feedAgentPocSse(state, decoder.decode(value, { stream: true }), { onProgress: emitProgress })
    }
    feedAgentPocSse(state, decoder.decode(), { onProgress: emitProgress })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new OfficeStreamDisconnectedError()
  }
  const result = finishAgentPocStream(state, { onProgress: emitProgress })
  return { ...result, messageId: input.messageId, sessionId: sid }
}

// ─── 语音纠错学习回路（fire-and-forget） ────────────────────────────────

/** 把 ASR 会话基线原文与用户实际发送文本上报（POST /api/v1/asr/correction，异步 202）。 */
export async function reportOfficeAsrCorrection(asrSessionId: string, sentText: string): Promise<void> {
  try {
    await fetch(ASR_CORRECTION_PATH, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ asr_session_id: asrSessionId, edited_text: sentText }),
    })
  } catch {
    // 学习回路失败静默忽略，不影响聊天发送。
  }
}

// ─── 附件工具 ───────────────────────────────────────────────────────────

/** 文档每条消息最多一个；图片继续支持多选（app exceedsChatFileLimit）。 */
export function exceedsOfficeFileLimit(
  existing: OfficePendingFile[],
  incoming: OfficePendingFile[],
): boolean {
  return [...existing, ...incoming].filter(item => item.kind !== 'image').length > 1
}

export interface OfficeResolvedImage {
  url: string
  title: string
}

/** 待发送附件 → 已发送附件（app PendingFile.toUserAttachment）。 */
export function toOfficeUserAttachment(pending: OfficePendingFile): OfficeUserAttachment {
  const extensionMatch = /\.([a-zA-Z0-9]{1,8})(?:[?#]|$)/.exec(pending.name)
    ?? /\.([a-zA-Z0-9]{1,8})(?:[?#]|$)/.exec(pending.url)
  const extension = (extensionMatch?.[1] ?? 'FILE').toUpperCase()
  return {
    name: pending.name,
    url: pending.url,
    isImage: pending.kind === 'image' || /^(PNG|JPE?G|GIF|BMP|WEBP|HEIC)$/i.test(extension),
    abbreviation: extension.slice(0, 4),
    localUrl: pending.kind === 'image' ? pending.localUrl : undefined,
  }
}

/**
 * 从助手 payload.images 中解析可展示的图片列表（app ReplyImages.normalize）。
 * 服务端返回结构不稳定（picture_message 嵌套 / 平铺 / 纯字符串均出现过），
 * 按候选字段逐一兜底并按 URL 去重。
 */
export function resolveOfficeImages(images?: unknown[]): OfficeResolvedImage[] {
  if (!Array.isArray(images)) return []
  const seen = new Set<string>()
  const result: OfficeResolvedImage[] = []
  images.forEach((value) => {
    const image = isRecord(value) ? value : {}
    const picture = isRecord(image.picture_message) ? image.picture_message : {}
    const candidates: unknown[] = typeof value === 'string'
      ? [value]
      : [
          image.picture_url, image.pictureUrl, image.image_url, image.imageUrl, image.url,
          picture.picture_url, picture.pictureUrl, picture.image_url, picture.imageUrl, picture.url,
        ]
    const url = candidates
      .map(item => String(item ?? '').trim())
      .find(item => /^https?:\/\//i.test(item))
    if (!url || seen.has(url)) return
    seen.add(url)
    result.push({ url, title: String(image.title || picture.title || '') || '图片' })
  })
  return result
}
