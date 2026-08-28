import { defineStore } from 'pinia'
import { sanitizeAgentDisplayText } from '@/agent/security/agentOutputSanitizer'
import type {
  AgentChatMessage,
  OfficeAttachment,
  OfficeChatMessage,
  OfficeConversationSession,
  OfficePendingTask,
  WmsAgentMode,
  AgentConversationSession,
  AgentTimelineEntry,
  WmsAgentConfirmationRequest,
  WmsAgentQuestion,
  WmsAgentUiStatus,
} from '@/agent/types'
import {
  createOfficeSession,
  deleteOfficeSession,
  fetchOfficeMessages,
  fetchOfficeSessions,
  streamOfficeChat,
  uploadOfficeFile,
} from '@/agent/office/officeChatApi'

let messageSequence = 0
let officeStreamController: AbortController | null = null
let officeInitializationPromise: Promise<void> | null = null

/**
 * 日常办公 SSE 的网络读取可能在一次事件循环内连续触发多次 onProgress，
 * Vue 会将这些响应式更新合并，导致用户只看到最终全文。该渲染器把已到达的
 * 文本放入独立队列，按 Unicode 字符逐个提交给响应式消息，不阻塞 SSE 读取。
 */
interface OfficeTypewriterState {
  message: OfficeChatMessage
  target: string
  characters: string[]
  cursor: number
  timer: ReturnType<typeof setTimeout> | null
  waiters: Array<() => void>
}

let officeTypewriter: OfficeTypewriterState | null = null
const officeTypewriterDelayMs = 18

function clearOfficeTypewriterTimer() {
  if (officeTypewriter?.timer != null) {
    clearTimeout(officeTypewriter.timer)
    officeTypewriter.timer = null
  }
}

function resolveOfficeTypewriterWaiters(state: OfficeTypewriterState) {
  const waiters = state.waiters.splice(0)
  waiters.forEach(resolve => resolve())
}

// 长文本加速，避免用户干等；短文本逐字更明显。
function officeCharsPerTick(remaining: number): number {
  if (remaining > 400) return 4
  if (remaining > 150) return 2
  return 1
}

function runOfficeTypewriter() {
  const state = officeTypewriter
  if (!state) return
  state.timer = null
  if (state.cursor >= state.characters.length) {
    resolveOfficeTypewriterWaiters(state)
    return
  }
  const step = officeCharsPerTick(state.characters.length - state.cursor)
  const next = Math.min(state.characters.length, state.cursor + step)
  state.message.content += state.characters.slice(state.cursor, next).join('')
  state.cursor = next
  if (state.cursor < state.characters.length) {
    state.timer = setTimeout(runOfficeTypewriter, officeTypewriterDelayMs)
  } else {
    resolveOfficeTypewriterWaiters(state)
  }
}

function queueOfficeTypewriter(message: OfficeChatMessage, content: string) {
  const state = officeTypewriter
  if (state?.message.id === message.id) {
    // 正常 SSE 增量只会扩展已有文本；终态 full_content 也应满足此前缀关系。
    if (content.startsWith(state.target)) {
      state.target = content
      state.characters = Array.from(content)
    } else if (content !== state.target) {
      // 后端纠正/替换了先前片段时，重新从修正后的全文逐字输出，避免展示错误内容。
      clearOfficeTypewriterTimer()
      state.target = content
      state.characters = Array.from(content)
      state.cursor = 0
      message.content = ''
    }
    if (state.cursor < state.characters.length && state.timer == null) runOfficeTypewriter()
    return
  }

  clearOfficeTypewriterTimer()
  officeTypewriter = {
    message,
    target: content,
    characters: Array.from(content),
    cursor: 0,
    timer: null,
    waiters: [],
  }
  if (officeTypewriter.characters.length) runOfficeTypewriter()
}

function waitForOfficeTypewriter(messageId: string): Promise<void> {
  const state = officeTypewriter
  if (!state || state.message.id !== messageId || state.cursor >= state.characters.length) return Promise.resolve()
  return new Promise(resolve => state.waiters.push(resolve))
}

function stopOfficeTypewriter() {
  if (!officeTypewriter) return
  clearOfficeTypewriterTimer()
  resolveOfficeTypewriterWaiters(officeTypewriter)
  officeTypewriter = null
}

function officeWelcome(sessionId: string): OfficeChatMessage[] {
  return [{
    id: `office-welcome:${sessionId}`,
    role: 'assistant',
    content: '你好，我是 AI 仓储助手。你可以直接问我库存、订单和经营数据，也可以描述客户与商品，让我帮你生成开单草稿。',
    attachments: [],
    payload: { thinkingSteps: [], replySegments: [], images: [] },
    status: 'success',
    createdAt: Date.now(),
  }]
}

function displayAttachments(attachments: OfficeAttachment[]): OfficeAttachment[] {
  return attachments.map(({ file: _file, ...attachment }) => attachment)
}

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
    // 默认收起,用户显式展开后才记住打开状态。
    return localStorage.getItem(historyOpenStorageKey) === 'true'
  } catch {
    return false
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
      // 双模式：'page' 页面跳转 / 'office' 日常办公
      mode: 'page' as WmsAgentMode,
      // 办公模式专用状态
      officeMessages: [] as OfficeChatMessage[],
      // 与小程序共用的服务端会话
      officeSessions: [] as OfficeConversationSession[],
      officeCurrentId: null as string | null,
      officePending: null as OfficePendingTask | null,
      officeInterruptEventId: '',
      officeInitialized: false,
      officeInitializing: false,
      officeError: '',
    }
  },
  getters: {
    isRunning: (state) =>
      state.status === 'thinking' ||
      state.status === 'executing' ||
      state.status === 'awaiting-input' ||
      state.status === 'awaiting-confirmation',
    officeBusy: (state) => !!state.officePending,
    officeCurrentSession: (state) => {
      if (state.officeCurrentId === null) return null
      return state.officeSessions.find(session => session.id === state.officeCurrentId) ?? null
    },
  },
  actions: {
    // 切换为指定模式；切换时清掉对方模式的进行中态。
    setMode(mode: WmsAgentMode) {
      if (this.mode === mode) return
      this.mode = mode
      // 切到办公模式：停止页面跳转流的打字机
      if (mode === 'office') this.stopStreaming()
      // 切到页面跳转：与小程序离开聊天页一致，中止当前流并销毁逐字渲染队列。
      if (mode === 'page') this.abortOfficeStream()
    },
    toggleMode() {
      this.setMode(this.mode === 'page' ? 'office' : 'page')
    },
    async initializeOfficeConversation() {
      if (this.officeInitialized && this.officeCurrentId) return
      if (officeInitializationPromise) return officeInitializationPromise
      officeInitializationPromise = (async () => {
        this.officeInitializing = true
        this.officeError = ''
        try {
          let sessions = await fetchOfficeSessions()
          let current = sessions.find(session => session.id === this.officeCurrentId) ?? sessions[0]
          if (!current) {
            current = await createOfficeSession()
            sessions = [current]
          }
          const messages = await fetchOfficeMessages(current.id)
          this.officeSessions = sessions
          this.officeCurrentId = current.id
          this.officeMessages = messages.length ? messages : officeWelcome(current.id)
          this.officeInitialized = true
        } catch (error) {
          this.officeError = error instanceof Error ? error.message : '会话记录加载失败'
          throw error
        } finally {
          this.officeInitializing = false
        }
      })()
      try {
        await officeInitializationPromise
      } finally {
        officeInitializationPromise = null
      }
    },
    // 办公模式：使用与小程序相同的会话、附件上传和 SSE 流程。
    async submitOfficeTask(text: string, attachments: OfficeAttachment[]) {
      if (this.officePending) return
      try {
        await this.initializeOfficeConversation()
      } catch {
        return
      }
      const attachment = attachments[0]
      const trimmed = text.trim() || (attachment ? '请帮我分析这个文件' : '')
      if (!trimmed || !this.officeCurrentId) return
      if (this.officeInterruptEventId && attachment) {
        this.officeError = '请先完成当前问答后再上传文件'
        return
      }
      this.officeError = ''
      const userMessage: OfficeChatMessage = {
        id: `office:${Date.now()}:u`,
        role: 'user',
        content: trimmed,
        attachments: displayAttachments(attachments),
        createdAt: Date.now(),
        status: 'success',
      }
      this.officeMessages.push(userMessage)
      const taskId = `office-task:${Date.now()}`
      const assistantMessageId = `office:${Date.now()}:a`
      this.officePending = {
        id: taskId,
        text: trimmed,
        attachments: displayAttachments(attachments),
        assistantMessageId,
        statusText: attachment ? '正在上传文件...' : '正在理解业务并整理数据',
        thinkingSteps: [],
        showThinking: true,
      }
      this.setStatus('thinking', '正在分析你的请求')
      officeStreamController = new AbortController()
      const signal = officeStreamController.signal
      let fileUrl = ''
      try {
        if (attachment?.file) {
          const uploaded = await uploadOfficeFile(attachment.file, signal)
          fileUrl = uploaded.fileUrl
          userMessage.attachments = [{
            ...userMessage.attachments[0],
            name: uploaded.fileName,
            size: uploaded.fileSize,
            type: uploaded.contentType,
            url: uploaded.fileUrl,
          }]
          userMessage.payload = {
            thinkingSteps: [], replySegments: [], images: [],
            file: { name: uploaded.fileName, url: uploaded.fileUrl },
          }
        }

        this.officeMessages.push({
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          attachments: [],
          payload: { thinkingSteps: [], replySegments: [], images: [] },
          status: 'streaming',
          createdAt: Date.now(),
        })
        // 关键：取 reactive proxy，而非 raw 对象。Pinia 的 reactive 数组在 push 后，
        // 通过下标读取会返回响应式代理；直接改 raw 对象不会触发视图更新，
        // 会导致流式内容"全部返回后才一次性显示"。
        const assistantMessage = this.officeMessages[this.officeMessages.length - 1]
        const interruptEventId = this.officeInterruptEventId
        if (interruptEventId) this.officeInterruptEventId = ''

        const result = await streamOfficeChat({
          text: trimmed,
          sessionId: this.officeCurrentId,
          fileUrl,
          interruptEventId,
        }, {
          onStatus: (statusText) => {
            if (this.officePending?.id !== taskId) return
            this.officePending.statusText = statusText
            this.activityText = statusText
          },
          onThinking: (steps) => {
            if (this.officePending?.id !== taskId) return
            this.officePending.thinkingSteps = steps
            assistantMessage.payload = { ...(assistantMessage.payload ?? { replySegments: [], images: [] }), thinkingSteps: steps }
          },
          onProgress: (progress) => {
            if (this.officePending?.id === taskId) this.officePending.showThinking = false
            // 网络流与渲染流解耦：立即接收 SSE 增量，但由逐字队列渐进更新可见文本。
            queueOfficeTypewriter(assistantMessage, progress.content)
            assistantMessage.payload = progress.payload
            assistantMessage.status = progress.status
          },
          onSessionCreated: (sessionId) => {
            this.officeCurrentId = sessionId
          },
          onInterrupt: (eventId) => {
            this.officeInterruptEventId = eventId
          },
        }, signal)

        // 流关闭后等待队列排空；不得直接赋全文，否则最后一次 Vue 提交会抹掉逐字效果。
        queueOfficeTypewriter(assistantMessage, result.content)
        await waitForOfficeTypewriter(assistantMessage.id)
        assistantMessage.payload = result.payload
        assistantMessage.status = result.status
        this.officeCurrentId = result.sessionId
        this.officeInterruptEventId = result.interruptEventId
        const current = this.officeSessions.find(session => session.id === result.sessionId)
        if (current && (current.title === '新会话' || !current.title)) {
          current.title = trimmed.length > 20 ? `${trimmed.slice(0, 20)}…` : trimmed
        }
        this.setStatus('idle', result.interruptEventId ? '等待你补充信息' : '等待任务')
      } catch (error) {
        if (signal.aborted) return
        const message = error instanceof Error ? error.message : '对话请求失败，请稍后再试'
        let assistantMessage = this.officeMessages.find(item => item.id === assistantMessageId)
        if (!assistantMessage) {
          assistantMessage = { id: assistantMessageId, role: 'assistant', content: '', attachments: [], createdAt: Date.now() }
          this.officeMessages.push(assistantMessage)
        }
        assistantMessage.content = `对话请求失败：${message}`
        assistantMessage.status = 'error'
        this.officeError = message
        this.setStatus('error', message)
      } finally {
        if (this.officePending?.id === taskId) this.officePending = null
        if (officeStreamController?.signal === signal) officeStreamController = null
      }
    },
    abortOfficeStream() {
      officeStreamController?.abort()
      officeStreamController = null
      stopOfficeTypewriter()
      this.officePending = null
      this.setStatus('idle', '等待任务')
    },
    async startOfficeConversation() {
      if (this.officePending) return
      this.officeError = ''
      try {
        const session = await createOfficeSession()
        this.officeSessions.unshift(session)
        this.officeCurrentId = session.id
        this.officeMessages = officeWelcome(session.id)
        this.officeInterruptEventId = ''
        this.officeInitialized = true
      } catch (error) {
        this.officeError = error instanceof Error ? error.message : '新建会话失败'
      }
    },
    async switchOfficeConversation(sessionId: string) {
      if (this.officePending || sessionId === this.officeCurrentId) return
      this.officeError = ''
      this.officeInitializing = true
      try {
        const messages = await fetchOfficeMessages(sessionId)
        this.officeCurrentId = sessionId
        this.officeMessages = messages.length ? messages : officeWelcome(sessionId)
        this.officeInterruptEventId = ''
      } catch (error) {
        this.officeError = error instanceof Error ? error.message : '历史消息加载失败'
      } finally {
        this.officeInitializing = false
      }
    },
    async removeOfficeConversation(sessionId: string) {
      if (this.officePending) return
      this.officeError = ''
      try {
        await deleteOfficeSession(sessionId)
        this.officeSessions = this.officeSessions.filter(session => session.id !== sessionId)
        if (this.officeCurrentId !== sessionId) return
        const next = this.officeSessions[0]
        if (next) await this.switchOfficeConversation(next.id)
        else await this.startOfficeConversation()
      } catch (error) {
        this.officeError = error instanceof Error ? error.message : '删除会话失败'
      }
    },
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
    finalizeTask(taskId: string, kind: 'result' | 'incomplete' | 'error' | 'stopped', content: string) {
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
    // 不绑定任何 task，纯粹在对话流末尾追加一条助手消息。用于导航/任务
    // 完成后追加"如果你指的是其他类型请告诉我"等 follow-up 提示。
    appendAssistantMessage(kind: 'incomplete' | 'result' | 'error' | 'stopped', content: string) {
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
