import { defineStore } from 'pinia'
import { sanitizeAgentDisplayText } from '@/agent/security/agentOutputSanitizer'
import { toOfficeAnalysisMarkdown } from '@/agent/office/officeAnalysisFormat'
import {
  deleteOfficeSession,
  exceedsOfficeFileLimit,
  fetchOfficeMessages,
  fetchOfficeSessions,
  friendlyOfficeUploadError,
  generateOfficeSessionId,
  OfficeApiError,
  OfficeStreamDisconnectedError,
  reportOfficeAsrCorrection,
  resolveOfficeUploadTarget,
  streamOfficeChat,
  toOfficeUserAttachment,
  uploadOfficeChatFile,
} from '@/agent/office/officeChatApi'
import { mergeRecoveringHistory, recoveredReply, retainCachedMessageDetails } from '@/agent/office/officeHistoryMerge'
import type {
  AgentChatMessage,
  OfficeChatMessage,
  OfficeConversationSession,
  OfficeMessagePayload,
  OfficePendingFile,
  OfficeResultDialog,
  OfficeThinkingStep,
  OfficeUserAttachment,
  WmsAgentMode,
  AgentConversationSession,
  AgentTimelineEntry,
  WmsAgentConfirmationRequest,
  WmsAgentQuestion,
  WmsAgentUiStatus,
} from '@/agent/types'

let messageSequence = 0

// ─── 办公模式模块级状态（app ChatController 的非响应式私有字段） ──────────

/** 会话数据代：停止/切换会话时自增，旧流与旧轮询的迟到回调全部失效。 */
let officeDataGeneration = 0
/** 初始化代：停止时自增，取消进行中的会话列表同步。 */
let officeSyncGeneration = 0
let officeInitPromise: Promise<void> | null = null
let officeStreamController: AbortController | null = null
let officeUploadController: AbortController | null = null
let officeRecoveryRunning = false
let officeMessageLoadActive = false
let officeLoadedSessionId: string | null = null
let officeCacheOwner = ''
let officeCacheRestored = false
let officeLastStreamCacheAt = 0
let officeNetworkListenerReady = false
const officeLocalSessionIds = new Set<string>()

/** 断流后待找回回复的轮次（app pendingTurn，跨刷新持久化）。 */
interface OfficePendingTurn {
  user: OfficeChatMessage
  baseline: OfficeChatMessage[]
}

let officePendingTurn: OfficePendingTurn | null = null

function officeToken(): string {
  return localStorage.getItem('token')?.trim() ?? ''
}

function isOfficeCurrent(auth: string, generation: number): boolean {
  return auth === officeToken() && generation === officeDataGeneration
}

function hasOfficeNetwork(): boolean {
  return navigator.onLine
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function emptyOfficePayload(): OfficeMessagePayload {
  return { statusSteps: [], images: [], files: [] }
}

export function officeWelcomeMessage(sessionId: string): OfficeChatMessage {
  return {
    id: `welcome_${sessionId}`,
    sessionId,
    role: 'assistant',
    content: '你好，我是小星智问。你可以直接问我库存、订单和经营数据，也可以描述客户与商品，让我帮你生成开单草稿。',
    options: [],
    payload: emptyOfficePayload(),
    status: 'success',
    createdAt: Date.now(),
  }
}

// ─── 本地缓存（app ChatHistoryCache 的 localStorage 等价实现） ───────────

const OFFICE_CACHE_SESSIONS_LIMIT = 100
const OFFICE_CACHE_HISTORY_SESSIONS = 10
const OFFICE_CACHE_MESSAGES_LIMIT = 200

interface OfficeCacheShape {
  sessions: OfficeConversationSession[]
  localSessionIds: string[]
  selectedSessionId: string
  histories: Record<string, OfficeChatMessage[]>
}

/** 不用会变化的 JWT 本身当缓存主键；优先采用用户标识，缺失时退回令牌指纹。 */
function officeCacheOwnerFor(token: string): string {
  try {
    const payload = token.split('.')[1] ?? ''
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(normalized)) as Record<string, unknown>
    const identity = ['operator_id', 'user_id', 'sub']
      .map(key => (claims[key] == null ? '' : String(claims[key])))
      .find(value => value !== '')
    if (identity) return `office:${identity}`
  } catch {
    // 解析失败走令牌指纹兜底
  }
  return `office:legacy:${token.slice(0, 24)}`
}

function officeCacheKey(owner: string): string {
  return `wms-office-cache:${owner}`
}

function officePendingTurnKey(owner: string): string {
  return `wms-office-pending:${owner}`
}

function readOfficeCache(owner: string): OfficeCacheShape | null {
  try {
    const raw = localStorage.getItem(officeCacheKey(owner))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<OfficeCacheShape>
    if (!Array.isArray(parsed.sessions)) return null
    return {
      sessions: parsed.sessions.slice(0, OFFICE_CACHE_SESSIONS_LIMIT),
      localSessionIds: Array.isArray(parsed.localSessionIds) ? parsed.localSessionIds : [],
      selectedSessionId: typeof parsed.selectedSessionId === 'string' ? parsed.selectedSessionId : '',
      histories: parsed.histories && typeof parsed.histories === 'object' ? parsed.histories : {},
    }
  } catch {
    return null
  }
}

function writeOfficeCache(owner: string, cache: OfficeCacheShape): void {
  try {
    localStorage.setItem(officeCacheKey(owner), JSON.stringify(cache))
  } catch {
    // 容量满时丢掉一半历史会话后重试一次，再失败则放弃（内存状态不受影响）。
    try {
      const keys = Object.keys(cache.histories)
        .sort((left, right) => (cache.histories[right]?.[0]?.createdAt ?? 0) - (cache.histories[left]?.[0]?.createdAt ?? 0))
      keys.slice(Math.floor(OFFICE_CACHE_HISTORY_SESSIONS / 2)).forEach(key => delete cache.histories[key])
      localStorage.setItem(officeCacheKey(owner), JSON.stringify(cache))
    } catch {
      // 放弃持久化
    }
  }
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
      // 办公模式专用状态（对齐 app ChatController）
      officeSessions: [] as OfficeConversationSession[],
      officeMessages: [] as OfficeChatMessage[],
      officeCurrentId: '',
      officeInitializing: false,
      officeLoadingSessions: false,
      officeLoadingMessages: false,
      officePreparingSend: false,
      /** 请求进行中（app answering）。 */
      officeAnswering: false,
      officeWebSearch: false,
      /** 状态卡可见（app thinking）。 */
      officeThinking: false,
      officeThinkingText: '',
      officeStatusSteps: [] as OfficeThinkingStep[],
      officeHistoryNotice: null as string | null,
      officeNotice: null as string | null,
      officeResultDialog: null as OfficeResultDialog | null,
      /** 待发送附件：先占位后上传，url 非空即就绪。 */
      officePendingFiles: [] as OfficePendingFile[],
      officeUploadingFile: false,
      officeError: '',
      /** 思考步骤折叠状态（按消息 id 覆盖，默认：流式中展开、完成收起）。 */
      officeTraceOverrides: {} as Record<string, boolean>,
    }
  },
  getters: {
    isRunning: (state) =>
      state.status === 'thinking' ||
      state.status === 'executing' ||
      state.status === 'awaiting-input' ||
      state.status === 'awaiting-confirmation',
    officeBusy: (state) => state.officeAnswering || state.officePreparingSend || state.officeUploadingFile,
    officeHasReadyFile: (state) => state.officePendingFiles.some(file => !!file.url),
  },
  actions: {
    // 切换为指定模式；切换时清掉对方模式的进行中态。
    setMode(mode: WmsAgentMode) {
      if (this.mode === mode) return
      this.mode = mode
      // 切到办公模式：停止页面跳转流的打字机
      if (mode === 'office') this.stopStreaming()
      // 切到页面跳转：与 app 离开智问一致，中止当前流并复位办公状态。
      if (mode === 'page') this.stopOfficeConversationWork()
    },
    toggleMode() {
      this.setMode(this.mode === 'page' ? 'office' : 'page')
    },
    consumeOfficeNotice() {
      this.officeNotice = null
    },
    closeOfficeResultDialog() {
      this.officeResultDialog = null
    },

    // ─── 办公模式：页面初始化 / 会话门禁 ────────────────────────────────

    /** 缓存优先展示；联网时以服务器为准更新，并预取其他会话供离线浏览。 */
    async initializeOfficePage(forceRefresh = false) {
      if (officeToken() === '') {
        this.officeError = '请先登录后使用小星智问'
        return
      }
      if (this.officeAnswering || this.officePreparingSend) return
      if (!forceRefresh && officeInitPromise) return officeInitPromise
      if (forceRefresh) {
        officeSyncGeneration += 1
        this.officeLoadingMessages = false
        officeMessageLoadActive = false
      }
      const sync = ++officeSyncGeneration
      const auth = officeToken()
      const generation = officeDataGeneration
      const promise = (async () => {
        this.officeInitializing = true
        this.officeLoadingSessions = true
        try {
          await this.restoreOfficeCachedPage(auth, generation)
          if (!isOfficeCurrent(auth, generation) || sync !== officeSyncGeneration) return
          if (!hasOfficeNetwork()) {
            this.officeHistoryNotice = this.officeSessions.length
              ? '当前离线，正在显示已保存的聊天记录。'
              : '当前离线，暂无已缓存的会话记录。'
            return
          }
          // 回到面板必须刷新可见会话：会话列表请求失败也不影响当前对话。
          const visibleSessionId = this.officeCurrentId
          const refreshVisibleFirst = !!forceRefresh && !!visibleSessionId
            && (!officeLocalSessionIds.has(visibleSessionId)
              || this.officeMessages.some(message => message.role === 'user'))
          if (refreshVisibleFirst && !await this.refreshOfficeHistory(visibleSessionId, auth, generation)) return
          const loaded = await fetchOfficeSessions()
          if (!isOfficeCurrent(auth, generation) || sync !== officeSyncGeneration) return
          const remoteIds = new Set(loaded.map(session => session.id))
          for (const id of [...officeLocalSessionIds]) if (remoteIds.has(id)) officeLocalSessionIds.delete(id)
          // 列表是分页的：第一页没有不代表会话被删，正在查看的会话保持原位。
          const drafts = this.officeSessions.filter(session =>
            officeLocalSessionIds.has(session.id)
            || (session.id === visibleSessionId && !remoteIds.has(session.id)))
          this.officeSessions = [...drafts, ...loaded]
          const selected = this.officeSessions.find(session => session.id === this.officeCurrentId)
            ?? this.officeSessions[0]
          if (!selected) {
            const sid = generateOfficeSessionId()
            this.officeSessions = [{ id: sid, title: '新会话', preview: '', updatedAt: '' }]
            officeLocalSessionIds.add(sid)
            this.officeCurrentId = sid
            this.showOfficeHistory(sid, [])
          } else if (this.officeCurrentId !== selected.id || officeLoadedSessionId !== selected.id) {
            this.officeCurrentId = selected.id
            const cached = this.readOfficeHistoryCache(selected.id)
            if (!isOfficeCurrent(auth, generation) || sync !== officeSyncGeneration) return
            this.showOfficeHistory(selected.id, cached)
          }
          this.persistOfficeSnapshot()
          if (!(refreshVisibleFirst && this.officeCurrentId === visibleSessionId)
            && (!officeLocalSessionIds.has(this.officeCurrentId)
              || this.officeMessages.some(message => message.role === 'user'))) {
            if (!await this.refreshOfficeHistory(this.officeCurrentId, auth, generation)) return
          }
          this.officeInitializing = false
          this.officeLoadingSessions = false
          // 逐个预取，避免大量并发请求；用户切换会话或发送时会取消预取。
          for (const session of loaded) {
            if (!isOfficeCurrent(auth, generation) || sync !== officeSyncGeneration) return
            if (session.id !== this.officeCurrentId
              && !await this.refreshOfficeHistory(session.id, auth, generation)) break
          }
        } catch (error) {
          if (!isOfficeCurrent(auth, generation) || sync !== officeSyncGeneration) return
          if (error instanceof OfficeApiError && error.isAuthError) {
            this.expireOfficeSession()
          } else {
            this.officeHistoryNotice = this.officeSessions.length
              ? '暂时无法同步最新会话，正在显示本地记录。'
              : '会话同步失败，暂无已缓存的记录，请联网后重试。'
          }
        } finally {
          if (isOfficeCurrent(auth, generation) && sync === officeSyncGeneration) {
            this.officeInitializing = false
            this.officeLoadingSessions = false
          }
        }
      })()
      officeInitPromise = promise
      try {
        await promise
      } finally {
        if (officeInitPromise === promise) officeInitPromise = null
      }
    },

    /** 发送前的会话门禁：sid 由本地生成（agent_poc 首条消息时惰性建档）。 */
    async ensureOfficeActiveSession(auth: string, generation: number): Promise<string> {
      await this.restoreOfficeCachedPage(auth, generation)
      if (!isOfficeCurrent(auth, generation)) return ''
      if (this.officeCurrentId) return this.officeCurrentId

      if (officeInitPromise) {
        await officeInitPromise.catch(() => undefined)
      }
      if (!isOfficeCurrent(auth, generation)) return ''
      if (this.officeCurrentId) return this.officeCurrentId

      const sid = generateOfficeSessionId()
      this.officeSessions = [
        { id: sid, title: '新会话', preview: '', updatedAt: '' },
        ...this.officeSessions.filter(session => session.id !== sid),
      ]
      officeLocalSessionIds.add(sid)
      this.officeCurrentId = sid
      this.officeMessages = [officeWelcomeMessage(sid)]
      officeLoadedSessionId = sid
      this.persistOfficeSnapshot()
      return sid
    },

    // ─── 办公模式：会话管理 ─────────────────────────────────────────────

    async selectOfficeSession(sessionId: string) {
      if (officeToken() === '' || !this.officeSessions.some(session => session.id === sessionId)) return
      if (!officeCacheRestored) {
        const auth = officeToken()
        const generation = officeDataGeneration
        await this.restoreOfficeCachedPage(auth, generation)
        if (!isOfficeCurrent(auth, generation)) return
      }
      this.stopOfficeConversationWork()
      this.officeCurrentId = sessionId
      officeLoadedSessionId = null
      this.officeMessages = []
      this.officeHistoryNotice = null
      this.officeLoadingMessages = true
      officeMessageLoadActive = true
      this.persistOfficeSnapshot()
      const auth = officeToken()
      const generation = officeDataGeneration
      try {
        const cached = this.readOfficeHistoryCache(sessionId)
        if (!isOfficeCurrent(auth, generation)) return
        this.showOfficeHistory(sessionId, cached ?? (officeLocalSessionIds.has(sessionId) ? [] : null))
        this.officeLoadingMessages = false
        this.restoreOfficePendingTurn()
        if (officePendingTurn) return
        if (hasOfficeNetwork()
          && (!officeLocalSessionIds.has(sessionId) || this.officeMessages.some(message => message.role === 'user'))) {
          await this.refreshOfficeHistory(sessionId, auth, generation)
        } else if (!hasOfficeNetwork()) {
          this.officeHistoryNotice = officeLoadedSessionId === sessionId
            ? '当前离线，正在显示已保存的聊天记录。'
            : '此会话尚未缓存，请联网后查看历史记录。'
        }
      } finally {
        if (isOfficeCurrent(auth, generation)) {
          this.officeLoadingMessages = false
          officeMessageLoadActive = false
          if (hasOfficeNetwork()) void this.initializeOfficePage()
        }
      }
    },

    /** 新建会话：agent_poc 无需服务端建档，本地生成新 sid 即可，首条消息时服务端落库。 */
    createOfficeSession() {
      if (officeToken() === '') {
        this.officeNotice = '请先登录后使用小星智问'
        return
      }
      this.stopOfficeConversationWork()
      const sid = generateOfficeSessionId()
      this.officeSessions = [
        { id: sid, title: '新会话', preview: '', updatedAt: '' },
        ...this.officeSessions.filter(session => session.id !== sid),
      ]
      officeLocalSessionIds.add(sid)
      this.officeCurrentId = sid
      this.showOfficeHistory(sid, [])
      this.persistOfficeSnapshot()
    },

    async removeOfficeSession(sessionId: string) {
      const auth = officeToken()
      try {
        await deleteOfficeSession(sessionId)
        if (officeToken() !== auth) return
        if (sessionId === this.officeCurrentId) this.stopOfficeConversationWork()
        this.officeSessions = this.officeSessions.filter(session => session.id !== sessionId)
        officeLocalSessionIds.delete(sessionId)
        if (sessionId === this.officeCurrentId) {
          const next = this.officeSessions[0]
          if (next) await this.selectOfficeSession(next.id)
          else this.createOfficeSession()
        }
        this.persistOfficeSnapshot()
      } catch (error) {
        if (officeToken() !== auth) return
        if (error instanceof OfficeApiError && error.isAuthError) this.expireOfficeSession()
        else this.officeNotice = error instanceof Error && error.message ? error.message : '删除会话失败'
      }
    },

    // ─── 办公模式：发送对话（含附件 / 挂起态选项作答） ──────────────────

    handleOfficeQuestionOption(text: string) {
      if (text.trim()) void this.sendOfficeText(text)
    },

    /** 返回是否受理（受理后调用方才清空输入框）；拒绝原因写入 officeNotice。 */
    async sendOfficeText(rawText: string, voiceSessionId?: string): Promise<boolean> {
      const webSearch = this.officeWebSearch === true
      const attachments = this.officeHasReadyFile
        ? this.officePendingFiles.filter(file => !!file.url)
        : []
      if (exceedsOfficeFileLimit([], attachments)) {
        this.officeNotice = '每条消息目前只支持上传一个文件，请移除多余文件后再发送'
        return false
      }
      let value = rawText.trim()
      if (!value && attachments.length) {
        const allImages = attachments.every(file => file.kind === 'image')
        value = allImages
          ? (attachments.length === 1 ? '请帮我分析这张图片' : '请帮我分析这些图片')
          : '请帮我分析这个文件'
      }
      if (!value || this.officeAnswering || this.officeUploadingFile || this.officePreparingSend) return false
      if (!hasOfficeNetwork()) {
        this.officeNotice = '当前离线，可以浏览已保存的聊天记录，联网后即可发送消息。'
        return false
      }
      if (this.officeLoadingMessages) {
        this.officeNotice = '聊天记录正在加载，请稍后发送。'
        return false
      }

      const sendAuth = officeToken()
      const sendGeneration = officeDataGeneration
      this.officePreparingSend = true
      let sessionId = ''
      try {
        sessionId = await this.ensureOfficeActiveSession(sendAuth, sendGeneration)
      } catch (error) {
        this.officePreparingSend = false
        this.officeNotice = error instanceof Error && error.message ? error.message : '会话创建失败，请稍后再试'
        return false
      }
      if (!isOfficeCurrent(sendAuth, sendGeneration)) return false
      if (!sessionId) {
        this.officePreparingSend = false
        this.officeNotice = '会话尚未准备完成，请稍后重试'
        return false
      }

      const firstDoc = attachments.find(file => file.kind !== 'image')
      const userMessage: OfficeChatMessage = {
        id: `user_${Date.now()}`,
        sessionId,
        role: 'user',
        content: value,
        options: [],
        payload: attachments.length
          ? {
              statusSteps: [],
              images: [],
              file: firstDoc ? toOfficeUserAttachment(firstDoc) : undefined,
              files: attachments.filter(file => file.kind === 'image').map(toOfficeUserAttachment),
            }
          : emptyOfficePayload(),
        status: 'success',
        createdAt: Date.now(),
      }
      const assistantMessageId = `assistant_${Date.now()}`

      this.stopOfficeConversationWork()
      const requestGeneration = officeDataGeneration
      const auth = officeToken()
      this.officeMessages.push(userMessage)
      this.saveOfficePendingTurn(userMessage)
      // 消息已进入聊天区，附件立即从输入区移除；请求仍使用上面捕获的附件列表。
      const sentIds = new Set(attachments.map(file => file.id))
      this.officePendingFiles = this.officePendingFiles.filter(file => !sentIds.has(file.id))
      officeLoadedSessionId = sessionId
      this.officeHistoryNotice = null
      this.upsertOfficeSessionEntry(sessionId, value, value)
      this.persistOfficeSnapshot()
      officeLastStreamCacheAt = 0
      this.officePreparingSend = false
      this.officeAnswering = true
      this.officeThinking = true
      this.officeThinkingText = ''
      this.officeStatusSteps = []

      // 语音纠错学习反馈：附件消息无法对齐基线故跳过（fire-and-forget）
      if (voiceSessionId && !attachments.length) {
        void reportOfficeAsrCorrection(voiceSessionId, value)
      }

      officeStreamController = new AbortController()
      const signal = officeStreamController.signal
      try {
        const result = await streamOfficeChat(
          {
            sessionId,
            text: value,
            messageId: assistantMessageId,
            webSearch,
            attachments: attachments.map(file => ({ kind: file.kind, name: file.name, url: file.url })),
          },
          {
            onProgress: content => {
              if (!isOfficeCurrent(auth, requestGeneration)) return
              this.upsertOfficeAssistant(assistantMessageId, sessionId, content, 'streaming')
              this.officeThinking = false
              const now = Date.now()
              if (now - officeLastStreamCacheAt >= 1_000) {
                officeLastStreamCacheAt = now
                this.persistOfficeSnapshot()
              }
            },
          },
          signal,
        )
        if (!isOfficeCurrent(auth, requestGeneration)) return true
        this.upsertOfficeAssistant(
          assistantMessageId,
          sessionId,
          result.content,
          result.options.length ? 'waiting_input' : 'success',
          result.options,
        )
        this.upsertOfficeSessionEntry(sessionId, value, result.content)
        officeLocalSessionIds.delete(sessionId)
        this.saveOfficePendingTurn(null)
        this.persistOfficeSnapshot()
        this.officeAnswering = false
        this.officeThinking = false
        this.officeThinkingText = ''
        this.officeStatusSteps = []
        void this.initializeOfficePage(true)
      } catch (error) {
        if (signal.aborted) return true
        if (!isOfficeCurrent(auth, requestGeneration)) return true
        if (error instanceof OfficeStreamDisconnectedError) {
          this.startOfficeRecovery()
          return true
        }
        this.saveOfficePendingTurn(null)
        const partial = this.officeMessages.find(item => item.id === assistantMessageId)
        if (partial) partial.status = 'interrupted'
        this.persistOfficeSnapshot()
        this.officeAnswering = false
        this.officeThinking = false
        this.officeThinkingText = ''
        this.officeStatusSteps = []
        if (error instanceof OfficeApiError && error.isAuthError) {
          this.expireOfficeSession()
          return true
        }
        this.officeResultDialog = {
          success: false,
          title: attachments.length ? '文件分析失败' : '对话请求失败',
          content: error instanceof Error && error.message ? error.message : '请稍后再试',
        }
      } finally {
        if (officeStreamController?.signal === signal) officeStreamController = null
      }
      return true
    },

    upsertOfficeAssistant(
      id: string,
      sessionId: string,
      content: string,
      status: OfficeChatMessage['status'],
      options: string[] = [],
    ) {
      const existing = this.officeMessages.find(item => item.id === id)
      if (existing) {
        existing.sessionId = sessionId
        existing.content = content
        existing.status = status
        existing.options = options
      } else {
        this.officeMessages.push({
          id,
          sessionId,
          role: 'assistant',
          content,
          options,
          payload: emptyOfficePayload(),
          status,
          createdAt: Date.now(),
        })
      }
    },

    /** 首条消息完成后，把本地会话条目落进列表（标题/预览，服务端稍后会生成正式标题）。 */
    upsertOfficeSessionEntry(sid: string, firstUserText: string, reply: string) {
      const fallbackTitle = firstUserText.slice(0, 20) || '新会话'
      // 数据分析结构化决策 JSON 预览取解析后的摘要，避免列表里露出半截 JSON
      const previewText = toOfficeAnalysisMarkdown(reply, false) ?? reply
      const index = this.officeSessions.findIndex(session => session.id === sid)
      if (index >= 0) {
        const existing = this.officeSessions[index]
        this.officeSessions[index] = {
          ...existing,
          title: existing.title && existing.title !== '新会话' ? existing.title : fallbackTitle,
          preview: previewText.slice(0, 50),
          updatedAt: '刚刚',
        }
      } else {
        this.officeSessions.unshift({
          id: sid,
          title: fallbackTitle,
          preview: previewText.slice(0, 50),
          updatedAt: '刚刚',
        })
      }
    },

    // ─── 办公模式：断流恢复（轮询历史找回后台结果） ─────────────────────

    saveOfficePendingTurn(user: OfficeChatMessage | null) {
      const baseline = user
        ? this.officeMessages
          .filter(item => item.id.startsWith('history_') && item.role === 'user')
          .map(item => ({ ...item, content: '', payload: emptyOfficePayload(), options: [] }))
        : []
      officePendingTurn = user ? { user, baseline } : null
      if (officeCacheOwner === '') return
      try {
        if (!user) {
          localStorage.removeItem(officePendingTurnKey(officeCacheOwner))
        } else {
          localStorage.setItem(
            officePendingTurnKey(officeCacheOwner),
            JSON.stringify({ sessionId: user.sessionId, messages: [user, ...baseline] }),
          )
        }
      } catch {
        // 持久化失败不影响进行中的对话
      }
    },

    restoreOfficePendingTurn() {
      if (officeCacheOwner === '' || officePendingTurn) return
      let messages: OfficeChatMessage[] = []
      try {
        const raw = localStorage.getItem(officePendingTurnKey(officeCacheOwner))
        const saved = raw ? JSON.parse(raw) as { messages?: unknown } : null
        if (Array.isArray(saved?.messages)) messages = saved.messages as OfficeChatMessage[]
      } catch {
        messages = []
      }
      officePendingTurn = messages.length
        ? { user: messages[0], baseline: messages.slice(1) }
        : null
      const user = officePendingTurn?.user
      if (user) {
        if (!this.officeMessages.some(item =>
          item.id === user.id
          || (item.role === 'user' && item.content === user.content && item.createdAt === user.createdAt))) {
          this.officeMessages.push(user)
        }
      }
      if (officePendingTurn?.user.sessionId === this.officeCurrentId) this.startOfficeRecovery()
    },

    startOfficeRecovery() {
      const turn = officePendingTurn
      if (!turn || officeRecoveryRunning || turn.user.sessionId !== this.officeCurrentId) return
      // 没有任务状态接口：没有回复不等于失败。保留该轮次直到回复到达（含刷新后）。
      officeDataGeneration += 1
      officeSyncGeneration += 1
      const auth = officeToken()
      const generation = officeDataGeneration
      this.officeInitializing = false
      this.officeLoadingSessions = false
      this.officeLoadingMessages = false
      this.officePreparingSend = false
      officeStreamController?.abort()
      officeStreamController = null
      this.officeAnswering = true
      this.officeThinking = true
      this.officeThinkingText = '正在同步后台处理结果…'
      officeRecoveryRunning = true
      void (async () => {
        try {
          while (isOfficeCurrent(auth, generation) && officePendingTurn === turn) {
            if (hasOfficeNetwork()) {
              try {
                const remote = await fetchOfficeMessages(turn.user.sessionId)
                if (!isOfficeCurrent(auth, generation)) return
                const reply = recoveredReply(remote, turn.user, turn.baseline)
                this.showOfficeHistory(
                  turn.user.sessionId,
                  mergeRecoveringHistory(remote, [...this.officeMessages], turn.user, turn.baseline),
                )
                this.persistOfficeSnapshot()
                if (reply) {
                  officeLocalSessionIds.delete(turn.user.sessionId)
                  this.upsertOfficeSessionEntry(turn.user.sessionId, turn.user.content, reply.content)
                  this.saveOfficePendingTurn(null)
                  this.persistOfficeSnapshot()
                  this.officeAnswering = false
                  this.officeThinking = false
                  this.officeThinkingText = ''
                  this.officeHistoryNotice = null
                  return
                }
                this.officeHistoryNotice = '后台结果尚未同步，正在自动等待；无需重复发送。'
              } catch (error) {
                if (error instanceof OfficeApiError && error.isAuthError) {
                  this.expireOfficeSession()
                  return
                }
                this.officeHistoryNotice = '连接暂时中断，恢复后将自动同步后台结果。'
              }
            }
            await delay(3_000)
          }
        } finally {
          officeRecoveryRunning = false
          if (isOfficeCurrent(auth, generation) && !officePendingTurn) {
            this.officeAnswering = false
            this.officeThinking = false
          }
        }
      })()
    },

    // ─── 办公模式：聊天附件 ─────────────────────────────────────────────

    /** 桌面文件选择入口：先落占位（本地预览秒显），再逐个上传后整条替换。 */
    chooseOfficeFiles(files: File[]) {
      if (!files.length) return
      if (this.officeAnswering || this.officeUploadingFile || this.officePreparingSend) {
        this.officeNotice = '正在处理当前消息，请稍后再添加附件'
        return
      }
      const placeholders: OfficePendingFile[] = files.map((file) => {
        const target = resolveOfficeUploadTarget(file)
        return {
          id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: target.name,
          size: file.size,
          url: '',
          kind: target.kind,
          localUrl: URL.createObjectURL(file),
          file,
        }
      })
      if (exceedsOfficeFileLimit(this.officePendingFiles, placeholders)) {
        this.officeNotice = this.officePendingFiles.some(file => file.kind !== 'image')
          ? '每条消息目前只支持上传一个文件，请先移除已添加的文件'
          : '每条消息目前只支持上传一个文件，请选择一个文件'
        placeholders.forEach(file => URL.revokeObjectURL(file.localUrl))
        return
      }
      this.officePendingFiles = [...this.officePendingFiles, ...placeholders]
      this.uploadOfficePendingFiles()
    },

    uploadOfficePendingFiles() {
      if (this.officeUploadingFile || !this.officePendingFiles.some(file => !file.url)) return
      this.officeUploadingFile = true
      officeUploadController = new AbortController()
      const controller = officeUploadController
      const auth = officeToken()
      void (async () => {
        try {
          for (const pending of [...this.officePendingFiles]) {
            if (pending.url) continue
            let attempts = 0
            while (officeToken() === auth && !controller.signal.aborted) {
              if (!this.officePendingFiles.some(file => file.id === pending.id)) break
              try {
                const uploaded = await uploadOfficeChatFile(pending.file ?? new File([], pending.name), controller.signal)
                if (officeToken() !== auth || controller.signal.aborted) return
                this.officePendingFiles = this.officePendingFiles.map(file =>
                  file.id === pending.id
                    ? { ...file, url: uploaded.url, name: uploaded.name, size: uploaded.size }
                    : file,
                )
                break
              } catch (error) {
                if (officeToken() !== auth || controller.signal.aborted) return
                if (error instanceof OfficeApiError && error.isAuthError) {
                  this.expireOfficeSession()
                  return
                }
                if (!(error instanceof OfficeStreamDisconnectedError)) {
                  // 上传被服务端拒绝：移除占位并给出可操作提示（老 .xls 等）
                  this.officePendingFiles = this.officePendingFiles.filter(file => file.id !== pending.id)
                  URL.revokeObjectURL(pending.localUrl)
                  this.officeNotice = friendlyOfficeUploadError(
                    error instanceof Error && error.message ? error.message : '文件上传失败',
                  )
                  return
                }
                attempts += 1
                if (attempts >= 3) {
                  this.officePendingFiles = this.officePendingFiles.filter(file => file.id !== pending.id)
                  URL.revokeObjectURL(pending.localUrl)
                  this.officeNotice = '上传暂时中断，文件已保留，请稍后重新添加。'
                  return
                }
                await delay(2_000)
              }
            }
          }
        } finally {
          if (officeUploadController === controller) officeUploadController = null
          if (officeToken() === auth) this.officeUploadingFile = false
        }
      })()
    },

    removeOfficeFile(id: string) {
      if (this.officeUploadingFile || this.officeAnswering) return
      const target = this.officePendingFiles.find(file => file.id === id)
      if (target) URL.revokeObjectURL(target.localUrl)
      this.officePendingFiles = this.officePendingFiles.filter(file => file.id !== id)
    },

    clearOfficeFiles() {
      if (this.officeUploadingFile || this.officeAnswering) return
      this.officePendingFiles.forEach(file => URL.revokeObjectURL(file.localUrl))
      this.officePendingFiles = []
    },

    // ─── 办公模式：思考步骤折叠 / 状态复位 ─────────────────────────────

    officeTraceExpanded(message: OfficeChatMessage): boolean {
      const override = this.officeTraceOverrides[message.id]
      if (override !== undefined) return override
      return message.status !== 'success'
    },

    toggleOfficeTrace(messageId: string) {
      this.officeTraceOverrides = {
        ...this.officeTraceOverrides,
        [messageId]: !this.officeTraceOverrides[messageId],
      }
    },

    stopOfficeConversationWork() {
      this.persistOfficeSnapshot()
      officeRecoveryRunning = false
      officePendingTurn = null
      if (officeCacheOwner) {
        try {
          localStorage.removeItem(officePendingTurnKey(officeCacheOwner))
        } catch {
          // 忽略清理失败
        }
      }
      officeDataGeneration += 1
      officeSyncGeneration += 1
      officeInitPromise = null
      officeMessageLoadActive = false
      officeStreamController?.abort()
      officeStreamController = null
      this.officeAnswering = false
      this.officePreparingSend = false
      this.officeThinking = false
      this.officeThinkingText = ''
      this.officeStatusSteps = []
      this.officeLoadingMessages = false
      this.officeLoadingSessions = false
      this.officeInitializing = false
    },

    /** agent_poc 接口统一要求 Bearer JWT，401/403 均视为登录态失效。 */
    expireOfficeSession() {
      this.stopOfficeConversationWork()
      officeUploadController?.abort()
      officeUploadController = null
      this.officeUploadingFile = false
      this.officePendingFiles = []
      officeCacheOwner = ''
      officeCacheRestored = false
      officeLoadedSessionId = null
      officeLocalSessionIds.clear()
      this.officeSessions = []
      this.officeCurrentId = ''
      this.officeMessages = []
      this.officeHistoryNotice = null
      this.officeError = '登录已过期，请重新登录'
      this.officeNotice = '登录已过期，请重新登录'
    },

    // ─── 办公模式：本地缓存读写 ─────────────────────────────────────────

    readOfficeHistoryCache(sessionId: string): OfficeChatMessage[] | null {
      if (officeCacheOwner === '') return null
      const cache = readOfficeCache(officeCacheOwner)
      const messages = cache?.histories[sessionId]
      return Array.isArray(messages) ? messages : null
    },

    showOfficeHistory(sessionId: string, history: OfficeChatMessage[] | null) {
      officeLoadedSessionId = history === null ? null : sessionId
      this.officeMessages = history && history.length ? [...history] : [officeWelcomeMessage(sessionId)]
      this.officeHistoryNotice = history === null ? '正在同步聊天记录…' : null
    },

    async restoreOfficeCachedPage(auth: string, generation: number) {
      if (officeCacheRestored) return
      const token = officeToken()
      officeCacheOwner = token ? officeCacheOwnerFor(token) : ''
      const cached = officeCacheOwner ? readOfficeCache(officeCacheOwner) : null
      const selected = cached?.sessions.find(session => session.id === cached.selectedSessionId)?.id
        ?? cached?.sessions[0]?.id
        ?? ''
      const history = selected ? this.readOfficeHistoryCache(selected) : null
      if (!isOfficeCurrent(auth, generation) || officeCacheRestored) return
      if (cached) {
        this.officeSessions = cached.sessions
        cached.localSessionIds.forEach(id => officeLocalSessionIds.add(id))
        this.officeCurrentId = selected
        if (selected) this.showOfficeHistory(selected, history)
      }
      officeCacheRestored = true
      this.restoreOfficePendingTurn()
      this.ensureOfficeNetworkListener()
    },

    ensureOfficeNetworkListener() {
      if (officeNetworkListenerReady) return
      officeNetworkListenerReady = true
      window.addEventListener('online', () => {
        if (this.mode !== 'office' && this.officeCurrentId === '') return
        void this.initializeOfficePage(true)
        this.uploadOfficePendingFiles()
      })
    },

    /** 捕获不可变快照，避免异步写入把新消息覆盖成旧版本。 */
    persistOfficeSnapshot() {
      if (officeCacheOwner === '' || officeToken() === '' || !officeCacheRestored) return
      const selected = this.officeCurrentId
      const histories: Record<string, OfficeChatMessage[]> = {}
      const existing = readOfficeCache(officeCacheOwner)?.histories ?? {}
      if (selected && officeLoadedSessionId === selected) {
        histories[selected] = this.officeMessages.slice(-OFFICE_CACHE_MESSAGES_LIMIT)
      }
      // 保留既有缓存里最近更新的会话（LRU：新写入的排最前）
      Object.assign(histories, existing)
      const orderedKeys = [selected, ...Object.keys(existing).filter(key => key !== selected)]
      const trimmed: Record<string, OfficeChatMessage[]> = {}
      orderedKeys.slice(0, OFFICE_CACHE_HISTORY_SESSIONS).forEach((key) => {
        if (histories[key]) trimmed[key] = histories[key]
      })
      writeOfficeCache(officeCacheOwner, {
        sessions: this.officeSessions.slice(0, OFFICE_CACHE_SESSIONS_LIMIT),
        localSessionIds: [...officeLocalSessionIds],
        selectedSessionId: selected,
        histories: trimmed,
      })
    },

    async refreshOfficeHistory(sessionId: string, auth: string, generation: number): Promise<boolean> {
      try {
        const remote = await fetchOfficeMessages(sessionId)
        if (!isOfficeCurrent(auth, generation)) return false
        const cached = officeLoadedSessionId === sessionId
          ? [...this.officeMessages]
          : this.readOfficeHistoryCache(sessionId) ?? []
        if (!isOfficeCurrent(auth, generation)) return false
        const history = retainCachedMessageDetails(remote, cached)
        if (officeCacheOwner) {
          const cache = readOfficeCache(officeCacheOwner)
          writeOfficeCache(officeCacheOwner, {
            sessions: cache?.sessions ?? this.officeSessions,
            localSessionIds: cache?.localSessionIds ?? [...officeLocalSessionIds],
            selectedSessionId: cache?.selectedSessionId ?? this.officeCurrentId,
            histories: {
              ...(cache?.histories ?? {}),
              [sessionId]: history.slice(-OFFICE_CACHE_MESSAGES_LIMIT),
            },
          })
        }
        if (this.officeCurrentId === sessionId) this.showOfficeHistory(sessionId, history)
        return true
      } catch (error) {
        if (!isOfficeCurrent(auth, generation)) return false
        if (error instanceof OfficeApiError && error.isAuthError) {
          this.expireOfficeSession()
        } else if (this.officeCurrentId === sessionId) {
          this.officeHistoryNotice = !hasOfficeNetwork()
            ? (officeLoadedSessionId === sessionId
              ? '当前离线，正在显示已保存的聊天记录。'
              : '此会话尚未缓存，请联网后查看历史记录。')
            : (officeLoadedSessionId === sessionId
              ? '暂时无法同步最新消息，正在显示本地聊天记录。'
              : '历史消息加载失败，此会话尚无本地缓存，请稍后重试。')
        }
        return false
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
