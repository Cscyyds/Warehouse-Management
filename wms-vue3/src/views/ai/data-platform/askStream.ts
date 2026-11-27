import { safeErrorText } from '../../../utils/serverErrorDisplay.ts'
/**
 * 数据中台知识问答（/ask）的 SSE 流解析。
 *
 * 后端事件契约（routes/data_workspace.py）：
 *   event: sources  data: {hits, model}        检索命中的资料（先于回答到达）
 *   event: delta    data: {content}            回答增量，逐段累计
 *   event: done     data: {answer, model, finish_reason, usage, no_evidence}
 *   event: error    data: {message}
 * done.answer 是权威终答；no_evidence=true 表示当前范围内没有可用资料。
 * 本文件只做纯文本状态机，不依赖 DOM / fetch，便于单测。
 */

export interface AskSource {
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

export interface AskResult {
  answer: string
  model: string
  sources: AskSource[]
  noEvidence: boolean
  finishReason: string | null
  usage: Record<string, unknown> | null
}

export interface AskStreamCallbacks {
  onSources?: (hits: AskSource[]) => void
  /** 累计后的回答全文（不是单次增量）。 */
  onDelta?: (answer: string) => void
}

export interface AskStreamState {
  buffer: string
  sources: AskSource[]
  answer: string
  model: string
  done: boolean
  noEvidence: boolean
  error: string
  finishReason: string | null
  usage: Record<string, unknown> | null
}

export function createAskStreamState(): AskStreamState {
  return { buffer: '', sources: [], answer: '', model: '', done: false, noEvidence: false, error: '', finishReason: null, usage: null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseHits(value: unknown): AskSource[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map(item => ({
    score: typeof item.score === 'number' ? item.score : 0,
    id: String(item.id ?? ''),
    document_id: String(item.document_id ?? ''),
    library_id: typeof item.library_id === 'string' ? item.library_id : null,
    version: typeof item.version === 'string' ? item.version : undefined,
    text: String(item.text ?? ''),
    index: String(item.index ?? ''),
    origin: isRecord(item.origin) ? item.origin : undefined,
    document_name: typeof item.document_name === 'string' ? item.document_name : undefined,
  }))
}

/** 消费一段 SSE 文本；事件以空行分隔，跨 chunk 的半截事件留在 buffer。 */
export function feedAskSse(state: AskStreamState, text: string, callbacks?: AskStreamCallbacks): void {
  if (!text) return
  state.buffer += text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  let separator = state.buffer.indexOf('\n\n')
  while (separator >= 0) {
    const block = state.buffer.slice(0, separator)
    state.buffer = state.buffer.slice(separator + 2)
    consumeEvent(state, block, callbacks)
    separator = state.buffer.indexOf('\n\n')
  }
}

function consumeEvent(state: AskStreamState, block: string, callbacks?: AskStreamCallbacks): void {
  let event = ''
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!dataLines.length) return
  let data: Record<string, unknown>
  try {
    const parsed = JSON.parse(dataLines.join('\n')) as unknown
    data = isRecord(parsed) ? parsed : {}
  } catch {
    return
  }
  if (event === 'sources') {
    state.sources = parseHits(data.hits)
    if (typeof data.model === 'string') state.model = data.model
    callbacks?.onSources?.(state.sources)
  } else if (event === 'delta') {
    const content = typeof data.content === 'string' ? data.content : ''
    if (content) {
      state.answer += content
      callbacks?.onDelta?.(state.answer)
    }
  } else if (event === 'done') {
    // 终答以 done.answer 为准（快速通道可能没有 delta）。
    if (typeof data.answer === 'string' && data.answer) state.answer = data.answer
    if (typeof data.model === 'string' && data.model) state.model = data.model
    state.noEvidence = data.no_evidence === true
    state.finishReason = typeof data.finish_reason === 'string' ? data.finish_reason : null
    state.usage = isRecord(data.usage) ? data.usage : null
    state.done = true
    callbacks?.onDelta?.(state.answer)
  } else if (event === 'error') {
    state.error = safeErrorText(typeof data.message === 'string' && data.message ? data.message : '回答服务返回错误')
  }
}

/** 流读完后收尾：error 优先抛出；未收到 done 视为连接中断。 */
export function finishAskStream(state: AskStreamState): AskResult {
  if (state.buffer.trim()) consumeEvent(state, state.buffer)
  if (state.error) throw new Error(state.error)
  if (!state.done) throw new Error('回答连接中断，请重试')
  return {
    answer: state.answer,
    model: state.model,
    sources: state.sources,
    noEvidence: state.noEvidence,
    finishReason: state.finishReason,
    usage: state.usage,
  }
}