import { defineStore } from 'pinia'
import { sanitizeAgentDisplayText } from '@/agent/security/agentOutputSanitizer'
import type {
  AgentChatMessage,
  AgentConversationSession,
  AgentTimelineEntry,
  WmsAgentConfirmationRequest,
  WmsAgentQuestion,
  WmsAgentUiStatus,
} from '@/agent/types'

let messageSequence = 0

// 打字机控制器：模块级单例,不进 Pinia state(避免响应式开销与持久化污染)。
// 思路:finalizeTask 拿到完整 resultText 后,先对全文 sanitize 一次,再逐字追加到
// 空的 assistant 消息。中断(新任务/切会话/停止)时立即补全全文,避免消息卡半截。
interface TypewriterState {
  messageId: string
  full: string
  cursor: number
  timer: ReturnType<typeof setInterval> | null
}

let typewriter: TypewriterState | null = null

function clearTypewriterTimer() {
  if (typewriter?.timer != null) {
    clearInterval(typewriter.timer)
    typewriter.timer = null
  }
}

// 长文本加速,避免用户干等;短文本慢一点更像"逐字"。
function computeCharsPerTick(length: number): number {
  if (length > 400) return 5
  if (length > 150) return 3
  return 2
}

const sessionsStorageKey = 'wms-agent-conversations'
const historyOpenStorageKey = 'wms-agent-history-open'
const maxPersistedSessions = 20
const maxPersistedMessages = 100
const maxPersistedTimelineEntries = 100

interface PersistedConversationState {
  currentSessionId: string
  sessions: AgentConversationSession[]
}

function createMessage(
  sequence: number,
  role: AgentChatMessage['role'],
  kind: AgentChatMessage['kind'],
  content: string,
): AgentChatMessage {
  return {
    id: `message:${Date.now()}:${++messageSequence}`,
    sequence,
    role,
    kind,
    content: role === 'assistant' ? sanitizeAgentDisplayText(content) : content,
    createdAt: Date.now(),
  }
}

function createSessionId(): string {
  return `session:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
}

function deriveSessionTitle(messages: AgentChatMessage[]): string {
  const firstRequest = messages.find((message) => message.role === 'user' && message.kind === 'request')
  const text = firstRequest?.content.trim() ?? ''
  if (!text) return '新对话'
  return text.length > 24 ? `${text.slice(0, 24)}…` : text
}

function isValidSession(value: unknown): value is AgentConversationSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<AgentConversationSession>
  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    Array.isArray(session.messages) &&
    Array.isArray(session.timeline) &&
    typeof session.createdAt === 'number' &&
    typeof session.updatedAt === 'number'
  )
}

function loadPersistedConversations(): PersistedConversationState {
  try {
    const raw = localStorage.getItem(sessionsStorageKey)
    if (!raw) return { currentSessionId: '', sessions: [] }
    const parsed = JSON.parse(raw) as Partial<PersistedConversationState>
    const sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions.filter(isValidSession).slice(0, maxPersistedSessions)
      : []
    return {
      currentSessionId: typeof parsed.currentSessionId === 'string' ? parsed.currentSessionId : '',
      sessions,
    }
  } catch {
    return { currentSessionId: '', sessions: [] }
  }
}

function persistConversations(currentSessionId: string, sessions: AgentConversationSession[]) {
  try {
    localStorage.setItem(sessionsStorageKey, JSON.stringify({ currentSessionId, sessions }))
  } catch {
    // localStorage 容量满时丢弃较早的一半会话后重试一次。
    try {
      const reduced = sessions.slice(0, Math.max(1, Math.floor(sessions.length / 2)))
      localStorage.setItem(sessionsStorageKey, JSON.stringify({ currentSessionId, sessions: reduced }))
    } catch {
      // 放弃持久化,内存状态不受影响。
    }
  }
}

function maxSequenceOf(messages: AgentChatMessage[], timeline: AgentTimelineEntry[]): number {
  return Math.max(0, ...messages.map((message) => message.sequence), ...timeline.map((entry) => entry.sequence ?? 0))
}

function loadHistoryOpen(): boolean {
  try {
    // 默认展开,用户显式收起后才记住关闭状态。
    return localStorage.getItem(historyOpenStorageKey) !== 'false'
  } catch {
    return true
  }
}

export const useAgentUiStore = defineStore('wms-agent-ui', {
  state: () => {
    const persisted = loadPersistedConversations()
    const active = persisted.sessions.find((session) => session.id === persisted.currentSessionId)
    return {
      enabled: false,
      available: false,
      panelOpen: false,
      status: 'idle' as WmsAgentUiStatus,
      activityText: '等待任务',
      currentTask: '',
      currentPageTitle: '',
      currentPageId: '',
      messages: active ? [...active.messages] : ([] as AgentChatMessage[]),
      timeline: active ? [...active.timeline] : ([] as AgentTimelineEntry[]),
      pendingQuestion: null as WmsAgentQuestion | null,
      confirmation: null as WmsAgentConfirmationRequest | null,
      lastError: '',
      lastFinalizedTaskId: '',
      streamingMessageId: '',
      streamingActive: false,
      feedSequence: active ? maxSequenceOf(active.messages, active.timeline) : 0,
      sessions: persisted.sessions,
      currentSessionId: active?.id ?? '',
      historyOpen: loadHistoryOpen(),
    }
  },
  getters: {
    isRunning: (state) =>
      state.status === 'thinking' ||
      state.status === 'executing' ||
      state.status === 'awaiting-input' ||
      state.status === 'awaiting-confirmation',
  },
  actions: {
    setEnabled(enabled: boolean) {
      this.enabled = enabled
    },
    setAvailable(available: boolean) {
      this.available = available
    },
    setPage(page?: { id: string; title: string }) {
      this.currentPageId = page?.id ?? ''
      this.currentPageTitle = page?.title ?? ''
    },
    setStatus(status: WmsAgentUiStatus, activityText?: string) {
      this.status = status
      if (activityText) this.activityText = activityText
    },
    startTask(task: string) {
      this.stopStreaming()
      this.currentTask = task
      this.lastError = ''
      this.pendingQuestion = null
      this.confirmation = null
      this.messages.push(createMessage(++this.feedSequence, 'user', 'request', task))
      this.setStatus('thinking', '正在理解任务')
      this.syncCurrentSession()
    },
    addUserAnswer(answer: string) {
      this.messages.push(createMessage(++this.feedSequence, 'user', 'answer', answer))
      this.pendingQuestion = null
      this.setStatus('executing', '已收到回答，继续执行')
      this.syncCurrentSession()
    },
    setPendingQuestion(question: WmsAgentQuestion) {
      this.pendingQuestion = question
      this.messages.push(
        createMessage(++this.feedSequence, 'assistant', 'question', question.content),
      )
      this.setStatus('awaiting-input', '等待你补充信息')
      this.syncCurrentSession()
    },
    clearPendingQuestion() {
      this.pendingQuestion = null
    },
    finalizeTask(taskId: string, kind: 'result' | 'error' | 'stopped', content: string) {
      if (!taskId || this.lastFinalizedTaskId === taskId) return
      this.lastFinalizedTaskId = taskId
      this.pendingQuestion = null
      if (kind === 'result') {
        this.startStreaming(taskId, kind, content)
        return
      }
      this.stopStreaming()
      this.messages.push(createMessage(++this.feedSequence, 'assistant', kind, content))
      this.syncCurrentSession()
    },
    startStreaming(taskId: string, kind: AgentChatMessage['kind'], fullContent: string) {
      // 中断上一次未完成的打字(补全其全文)。
      this.stopStreaming()
      const sanitized = sanitizeAgentDisplayText(fullContent)
      const message = createMessage(++this.feedSequence, 'assistant', kind, '')
      this.messages.push(message)
      this.streamingMessageId = message.id
      this.streamingActive = true
      this.syncCurrentSession()

      clearTypewriterTimer()
      typewriter = { messageId: message.id, full: sanitized, cursor: 0, timer: null }
      const charsPerTick = computeCharsPerTick(sanitized.length)
      typewriter.timer = setInterval(() => {
        if (!typewriter) return
        typewriter.cursor = Math.min(typewriter.full.length, typewriter.cursor + charsPerTick)
        this.appendStreamChunk(typewriter.messageId, typewriter.full.slice(0, typewriter.cursor))
        if (typewriter.cursor >= typewriter.full.length) {
          clearTypewriterTimer()
          typewriter = null
          this.completeStreaming()
        }
      }, 16)
    },
    appendStreamChunk(messageId: string, partial: string) {
      const message = this.messages.find((item) => item.id === messageId)
      if (message) message.content = partial
    },
    completeStreaming() {
      this.streamingActive = false
      this.streamingMessageId = ''
      this.syncCurrentSession()
    },
    stopStreaming() {
      // 立即把目标全文补全到当前打字消息,再清除流式状态。
      if (typewriter) {
        const pendingMessageId = typewriter.messageId
        const pendingFull = typewriter.full
        clearTypewriterTimer()
        typewriter = null
        const message = this.messages.find((item) => item.id === pendingMessageId)
        if (message && message.content !== pendingFull) {
          message.content = pendingFull
        }
      }
      if (this.streamingActive) {
        this.streamingActive = false
        this.streamingMessageId = ''
        this.syncCurrentSession()
      }
    },
    addTimelineEntry(entry: AgentTimelineEntry) {
      this.timeline.push({ ...entry, sequence: ++this.feedSequence })
    },
    updateTimelineEntry(id: string, patch: Partial<AgentTimelineEntry>) {
      const entry = this.timeline.find((item) => item.id === id)
      if (!entry) return
      Object.assign(entry, {
        ...patch,
        ...(patch.title ? { title: sanitizeAgentDisplayText(patch.title) } : {}),
        ...(patch.detail ? { detail: sanitizeAgentDisplayText(patch.detail) } : {}),
      })
    },
    setConfirmation(request: WmsAgentConfirmationRequest | null) {
      this.confirmation = request
      if (request) {
        this.setStatus('awaiting-confirmation', '等待人工确认')
      }
    },
    setError(message: string) {
      const safeMessage = sanitizeAgentDisplayText(message)
      this.lastError = safeMessage
      this.setStatus('error', safeMessage)
    },
    resetConversation() {
      if (this.isRunning) return
      this.stopStreaming()
      this.currentTask = ''
      this.messages = []
      this.timeline = []
      this.pendingQuestion = null
      this.confirmation = null
      this.lastError = ''
      this.lastFinalizedTaskId = ''
      this.feedSequence = 0
      this.setStatus('idle', '等待任务')
    },
    toggleHistory() {
      this.historyOpen = !this.historyOpen
      try {
        localStorage.setItem(historyOpenStorageKey, String(this.historyOpen))
      } catch {
        // 忽略本地偏好写入失败。
      }
    },
    syncCurrentSession() {
      if (!this.messages.length) return
      let session = this.sessions.find((item) => item.id === this.currentSessionId)
      if (!session) {
        session = {
          id: createSessionId(),
          title: '',
          messages: [],
          timeline: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        this.sessions.unshift(session)
        this.currentSessionId = session.id
      }
      session.messages = this.messages.slice(-maxPersistedMessages)
      session.timeline = this.timeline.slice(-maxPersistedTimelineEntries)
      if (!session.title) session.title = deriveSessionTitle(this.messages)
      session.updatedAt = Date.now()
      if (this.sessions.length > maxPersistedSessions) this.sessions.length = maxPersistedSessions
      persistConversations(this.currentSessionId, this.sessions)
    },
    startNewConversation() {
      if (this.isRunning) return
      this.resetConversation()
      // 置空后下一条消息会创建全新的会话;旧会话已归档保留在列表中。
      this.currentSessionId = ''
      persistConversations(this.currentSessionId, this.sessions)
    },
    switchConversation(sessionId: string) {
      if (this.isRunning || sessionId === this.currentSessionId) return
      const target = this.sessions.find((item) => item.id === sessionId)
      if (!target) return
      // 切换前补全当前打字,并把当前会话最新状态(含时间线条目更新)归档。
      this.stopStreaming()
      this.syncCurrentSession()
      this.currentSessionId = sessionId
      this.currentTask = ''
      this.messages = [...target.messages]
      this.timeline = [...target.timeline]
      this.pendingQuestion = null
      this.confirmation = null
      this.lastError = ''
      this.lastFinalizedTaskId = ''
      this.feedSequence = maxSequenceOf(target.messages, target.timeline)
      this.setStatus('idle', '等待任务')
      persistConversations(this.currentSessionId, this.sessions)
    },
    deleteConversation(sessionId: string) {
      if (this.isRunning) return
      const index = this.sessions.findIndex((item) => item.id === sessionId)
      if (index === -1) return
      this.sessions.splice(index, 1)
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = ''
        this.resetConversation()
      }
      persistConversations(this.currentSessionId, this.sessions)
    },
    togglePanel() {
      this.panelOpen = !this.panelOpen
    },
    closePanel() {
      this.panelOpen = false
    },
  },
})
