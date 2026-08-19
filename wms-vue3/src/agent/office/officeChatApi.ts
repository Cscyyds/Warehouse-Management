import type {
  OfficeChatMessage,
  OfficeConversationSession,
  OfficeMessagePayload,
  OfficeReplySegment,
  OfficeThinkingStep,
} from '@/agent/types'

const SESSION_PATH = '/api/v1/coze/chat/sessions'
const STREAM_START_PATH = '/api/v1/coze/workflow/stream/start/json'
const STREAM_REPLY_PATH = '/api/v1/coze/workflow/stream/reply'
const FILE_UPLOAD_PATH = '/api/v1/file/upload'

type JsonRecord = Record<string, unknown>

export interface OfficeStreamProgress {
  content: string
  payload: OfficeMessagePayload
  status: 'streaming' | 'waiting_input'
}

export interface OfficeStreamResult {
  content: string
  payload: OfficeMessagePayload
  sessionId: string
  interruptEventId: string
  status: 'streaming' | 'waiting_input' | 'success'
}

export interface OfficeStreamCallbacks {
  onStatus?: (text: string) => void
  onThinking?: (steps: OfficeThinkingStep[]) => void
  onProgress?: (progress: OfficeStreamProgress) => void
  onSessionCreated?: (sessionId: string) => void
  onInterrupt?: (eventId: string, message: string) => void
}

interface ParsedSseEvent {
  id: string
  event: string
  data: JsonRecord | string
}

interface MutableReplySegment extends OfficeReplySegment {}

interface StreamState {
  buffer: string
  assistantText: string
  lastEmittedText: string
  done: boolean
  backendSessionId: string
  interruptEventId: string
  thinkingSteps: OfficeThinkingStep[]
  replySegments: Record<string, MutableReplySegment>
  replySegmentOrder: string[]
  images: unknown[]
}

function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  const token = localStorage.getItem('token')?.trim()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function apiErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body
  if (!isRecord(body)) return fallback
  const data = isRecord(body.data) ? body.data : undefined
  return String(body.detail || body.error_message || body.message || body.msg || data?.detail || fallback)
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  return safeParseJson(text) ?? text
}

function unwrapApiData(body: unknown): unknown {
  if (!isRecord(body)) return body
  if (body.success === false || (body.code !== undefined && Number(body.code) !== 200)) {
    throw new Error(apiErrorMessage(body, '业务处理失败'))
  }
  if ((body.success === true || Number(body.code) === 200) && Object.prototype.hasOwnProperty.call(body, 'data')) {
    return body.data
  }
  return body
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    ...init,
    headers: authHeaders(init?.headers),
  })
  const body = await parseResponseBody(response)
  if (!response.ok) throw new Error(apiErrorMessage(body, `请求失败（HTTP ${response.status}）`))
  return unwrapApiData(body)
}

function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (!isRecord(data)) return []
  for (const key of ['items', 'list', 'records', 'results', 'sessions', 'messages', 'rows']) {
    if (Array.isArray(data[key])) return data[key] as unknown[]
  }
  return data.data !== data ? extractItems(data.data) : []
}

function normalizeSession(value: unknown): OfficeConversationSession {
  const source = isRecord(value) ? value : {}
  const id = source.id ?? source.session_id ?? ''
  return {
    id: String(id),
    title: String(source.title || source.session_title || source.name || '新会话'),
    preview: String(source.last_message_preview || ''),
    updatedAt: String(source.last_message_at || source.updated_at || source.updatedAt || source.created_at || source.createdAt || ''),
    status: String(source.status || 'active'),
    pinned: Boolean(source.pinned || source.is_pinned),
  }
}

export function parseSseEvent(block: string): ParsedSseEvent | null {
  const normalized = block.trim()
  if (!normalized) return null
  const result: ParsedSseEvent = { id: '', event: '', data: {} }
  const dataLines: string[] = []
  for (const line of normalized.split('\n')) {
    if (line.startsWith('id:')) result.id = line.slice(3).trim()
    else if (line.startsWith('event:')) result.event = line.slice(6).trim().toLowerCase()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (dataLines.length) {
    const text = dataLines.join('\n')
    result.data = (safeParseJson(text) as JsonRecord | null) ?? text
  }
  return result.event ? result : null
}

function emptyPayload(): OfficeMessagePayload {
  return { thinkingSteps: [], replySegments: [], images: [] }
}

function copyPayload(state: StreamState): OfficeMessagePayload {
  return {
    thinkingSteps: state.thinkingSteps.map(step => ({ ...step })),
    replySegments: state.replySegmentOrder.map(key => ({ ...state.replySegments[key] })),
    images: [...state.images],
  }
}

function appendThinkingStep(state: StreamState, event: ParsedSseEvent) {
  const data = isRecord(event.data) ? event.data : {}
  const content = String(data.content || '').trim()
  if (!content) return
  const step: OfficeThinkingStep = {
    id: event.id || `thinking_${state.thinkingSteps.length}`,
    content,
    nodeTitle: String(data.node_title || ''),
  }
  const previous = state.thinkingSteps.at(-1)
  if (!previous || previous.content !== step.content || previous.nodeTitle !== step.nodeTitle) {
    state.thinkingSteps.push(step)
  }
}

function replySegmentKey(data: JsonRecord): string {
  if (data.node_id != null && data.sub_execute_id != null) return `${data.node_id}:${data.sub_execute_id}`
  if (data.node_title) return `title:${data.node_title}`
  return 'default'
}

function appendReplySegment(state: StreamState, data: JsonRecord) {
  const key = replySegmentKey(data)
  const delta = String(data.content || '')
  const fullContent = String(data.full_content || '')
  let segment = state.replySegments[key]
  if (!segment) {
    segment = {
      key,
      nodeId: data.node_id == null ? '' : String(data.node_id),
      subExecuteId: data.sub_execute_id == null ? '' : String(data.sub_execute_id),
      nodeTitle: String(data.node_title || ''),
      content: '',
    }
    state.replySegments[key] = segment
    state.replySegmentOrder.push(key)
  }
  if (fullContent && segment.content && fullContent !== delta && fullContent.startsWith(segment.content)) {
    segment.content = fullContent
  } else if (delta) {
    segment.content += delta
  } else if (fullContent) {
    segment.content = fullContent
  }
  state.assistantText = state.replySegmentOrder.map(item => state.replySegments[item].content).filter(Boolean).join('\n\n')
}

function applyFinalReply(state: StreamState, data: JsonRecord) {
  const content = String(data.full_content || data.content || '')
  if (content) {
    const segment: MutableReplySegment = {
      key: 'final',
      nodeId: '',
      subExecuteId: '',
      nodeTitle: String(data.node_title || 'End'),
      content,
    }
    state.replySegments = { final: segment }
    state.replySegmentOrder = ['final']
    state.assistantText = content
  }
  if (Object.prototype.hasOwnProperty.call(data, 'image')) {
    state.images = Array.isArray(data.image) ? [...data.image] : (data.image ? [data.image] : [])
  }
}

function emitProgress(state: StreamState, callbacks: OfficeStreamCallbacks) {
  if (!callbacks.onProgress || state.assistantText === state.lastEmittedText) return
  state.lastEmittedText = state.assistantText
  callbacks.onProgress({
    content: state.assistantText,
    payload: copyPayload(state),
    status: state.interruptEventId ? 'waiting_input' : 'streaming',
  })
}

function handleProxyEvent(event: ParsedSseEvent | null, state: StreamState, callbacks: OfficeStreamCallbacks) {
  if (!event) return
  const data = isRecord(event.data) ? event.data : {}
  if (event.event === 'queued') {
    if (data.session_id != null) {
      state.backendSessionId = String(data.session_id)
      callbacks.onSessionCreated?.(state.backendSessionId)
    }
    callbacks.onStatus?.('正在排队处理中...')
    return
  }
  if (event.event === 'ping') return
  if (event.event === 'thinking') {
    appendThinkingStep(state, event)
    const content = String(data.content || '').trim()
    if (content) callbacks.onStatus?.(content)
    callbacks.onThinking?.(state.thinkingSteps.map(step => ({ ...step })))
    return
  }
  if (event.event === 'error') throw new Error(String(data.message || '工作流调用失败'))
  if (event.event === 'interrupt') {
    const eventId = String(data.event_id || '').trim()
    const message = String(data.message || '请补充信息后继续').trim()
    state.interruptEventId = eventId
    state.assistantText = message
    emitProgress(state, callbacks)
    if (eventId) callbacks.onInterrupt?.(eventId, message)
    return
  }
  if (event.event === 'done') {
    const finalContent = data.full_content || (!state.assistantText ? data.message : '') || ''
    if (finalContent) {
      applyFinalReply(state, { full_content: finalContent, node_title: 'End' })
      emitProgress(state, callbacks)
    }
    state.done = true
    return
  }
  if (event.event === 'message') {
    if (data.node_is_finish || data.node_title === 'End') applyFinalReply(state, data)
    else appendReplySegment(state, data)
    if (state.assistantText) emitProgress(state, callbacks)
  }
}

function consumeSseText(state: StreamState, text: string, callbacks: OfficeStreamCallbacks) {
  if (!text) return
  state.buffer += text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  let separator = state.buffer.indexOf('\n\n')
  while (separator >= 0) {
    const block = state.buffer.slice(0, separator)
    state.buffer = state.buffer.slice(separator + 2)
    handleProxyEvent(parseSseEvent(block), state, callbacks)
    separator = state.buffer.indexOf('\n\n')
  }
}

function storedPayload(value: unknown): OfficeMessagePayload {
  const source = isRecord(value) ? value : {}
  const stored = source.raw_payload ?? source.payload ?? source.metadata ?? source.extra ?? source.ext ?? {}
  const raw = typeof stored === 'string' ? safeParseJson(stored) : stored
  if (!raw) return emptyPayload()
  if (isRecord(raw) && (Array.isArray(raw.thinkingSteps) || Array.isArray(raw.replySegments) || Array.isArray(raw.images))) {
    return {
      thinkingSteps: Array.isArray(raw.thinkingSteps) ? raw.thinkingSteps as OfficeThinkingStep[] : [],
      replySegments: Array.isArray(raw.replySegments) ? raw.replySegments as OfficeReplySegment[] : [],
      images: Array.isArray(raw.images) ? raw.images : [],
    }
  }
  const state: StreamState = {
    buffer: '', assistantText: '', lastEmittedText: '', done: false, backendSessionId: '', interruptEventId: '',
    thinkingSteps: [], replySegments: {}, replySegmentOrder: [], images: [],
  }
  const record = isRecord(raw) ? raw : {}
  const events = Array.isArray(raw) ? raw : (Array.isArray(record.events) ? record.events : [])
  events.forEach((item, index) => {
    if (!isRecord(item)) return
    const eventName = String(item.event || item.type || '').toLowerCase()
    const parsed = typeof item.data === 'string' ? safeParseJson(item.data) : item.data
    const data = isRecord(parsed) ? parsed : {}
    if (eventName === 'thinking') appendThinkingStep(state, { id: String(item.id || `thinking_${index}`), event: eventName, data })
    else if (eventName === 'message') {
      if (data.node_is_finish || data.node_title === 'End') applyFinalReply(state, data)
      else appendReplySegment(state, data)
    } else if (eventName === 'done' && !state.assistantText && data.full_content) {
      applyFinalReply(state, { full_content: data.full_content, node_title: 'End' })
    }
  })
  if (!state.assistantText && record.full_content) applyFinalReply(state, { full_content: record.full_content, node_title: 'End' })
  return copyPayload(state)
}

function normalizeHistoryMessage(value: unknown, sessionId: string, index: number): OfficeChatMessage {
  const source = isRecord(value) ? value : {}
  const rawRole = String(source.role || source.sender_type || source.message_role || '').toLowerCase()
  const role = rawRole === 'user' || rawRole === 'human' ? 'user' : 'assistant'
  const content = source.content ?? source.message ?? source.text ?? ''
  const payload = storedPayload(source)
  const fileUrl = String(source.file_url || '')
  const fileName = fileUrl ? decodeURIComponent(fileUrl.split('/').pop()?.split('?')[0] || '附件') : ''
  return {
    id: String(source.id ?? source.message_id ?? `history_${sessionId}_${index}`),
    role,
    content: String(content),
    attachments: fileUrl ? [{ id: `history-file:${index}`, name: fileName, size: 0, type: 'application/octet-stream', url: fileUrl }] : [],
    payload: { ...payload, ...(fileUrl ? { file: { name: fileName, url: fileUrl } } : {}) },
    status: source.finish_reason === 'error' ? 'error' : 'success',
    createdAt: Number(new Date(String(source.created_at || source.createdAt || source.send_at || source.timestamp || Date.now()))) || Date.now(),
  }
}

export async function fetchOfficeSessions(): Promise<OfficeConversationSession[]> {
  const items = await fetchPagedItems(SESSION_PATH, { session_status: 'active' }, 50)
  return items.map(normalizeSession).filter(item => item.id)
}

export async function createOfficeSession(): Promise<OfficeConversationSession> {
  const data = await requestJson(SESSION_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '新会话' }),
  })
  const session = normalizeSession(data)
  if (!session.id) throw new Error('新建会话失败：接口未返回会话 ID')
  return session
}

export async function deleteOfficeSession(sessionId: string): Promise<void> {
  await requestJson(`${SESSION_PATH}/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}

export async function fetchOfficeMessages(sessionId: string): Promise<OfficeChatMessage[]> {
  const items = await fetchPagedItems(`${SESSION_PATH}/${encodeURIComponent(sessionId)}/messages`, {}, 100)
  return items
    .map((item, index) => normalizeHistoryMessage(item, sessionId, index))
    .filter(message => message.content || message.payload?.images.length)
}

async function fetchPagedItems(path: string, query: Record<string, string>, pageSize: number): Promise<unknown[]> {
  const all: unknown[] = []
  for (let page = 0; page < 50; page += 1) {
    const params = new URLSearchParams({ ...query, limit: String(pageSize), offset: String(page * pageSize) })
    const data = await requestJson(`${path}?${params}`)
    const items = extractItems(data)
    all.push(...items)
    if (items.length < pageSize) break
  }
  return all
}

export async function uploadOfficeFile(file: File, signal?: AbortSignal): Promise<{ fileUrl: string; fileName: string; fileSize: number; contentType: string }> {
  const form = new FormData()
  form.append('file', file)
  const data = await requestJson(FILE_UPLOAD_PATH, { method: 'POST', body: form, signal })
  const source = isRecord(data) ? data : {}
  const fileUrl = String(source.file_url || source.fileUrl || source.url || '').trim()
  if (!/^https:\/\//i.test(fileUrl)) throw new Error('上传接口未返回 BOS HTTPS 文件地址')
  return {
    fileUrl,
    fileName: String(source.file_name || source.fileName || file.name),
    fileSize: Number(source.file_size || source.fileSize || file.size),
    contentType: String(source.content_type || file.type || 'application/octet-stream'),
  }
}

export async function streamOfficeChat(
  input: { text: string; sessionId: string; fileUrl?: string; interruptEventId?: string },
  callbacks: OfficeStreamCallbacks,
  signal?: AbortSignal,
): Promise<OfficeStreamResult> {
  const isReply = Boolean(input.interruptEventId)
  const body = isReply
    ? { event_id: input.interruptEventId, answer: input.text }
    : {
        input: input.text,
        ...(/^\d+$/.test(input.sessionId) ? { session_id: Number(input.sessionId) } : {}),
        ...(input.fileUrl ? { file: input.fileUrl } : {}),
      }
  const response = await fetch(isReply ? STREAM_REPLY_PATH : STREAM_START_PATH, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok) {
    const responseBody = await parseResponseBody(response)
    throw new Error(apiErrorMessage(responseBody, `对话请求失败（HTTP ${response.status}）`))
  }
  if (!response.body) throw new Error('浏览器无法读取流式响应')

  const state: StreamState = {
    buffer: '', assistantText: '', lastEmittedText: '', done: false, backendSessionId: '', interruptEventId: '',
    thinkingSteps: [], replySegments: {}, replySegmentOrder: [], images: [],
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    consumeSseText(state, decoder.decode(value, { stream: true }), callbacks)
  }
  consumeSseText(state, decoder.decode(), callbacks)
  if (state.buffer.trim()) handleProxyEvent(parseSseEvent(state.buffer), state, callbacks)
  if (!state.assistantText && !state.images.length) throw new Error('工作流未返回可展示内容')
  return {
    content: state.assistantText,
    payload: copyPayload(state),
    sessionId: state.backendSessionId || input.sessionId,
    interruptEventId: state.interruptEventId,
    status: state.interruptEventId ? 'waiting_input' : 'success',
  }
}
