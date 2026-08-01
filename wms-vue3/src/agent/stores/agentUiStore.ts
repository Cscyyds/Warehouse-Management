import { defineStore } from 'pinia'
import { sanitizeAgentDisplayText } from '@/agent/security/agentOutputSanitizer'
import type {
  AgentChatMessage,
  AgentTimelineEntry,
  WmsAgentConfirmationRequest,
  WmsAgentQuestion,
  WmsAgentUiStatus,
} from '@/agent/types'

let messageSequence = 0

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

export const useAgentUiStore = defineStore('wms-agent-ui', {
  state: () => ({
    enabled: false,
    available: false,
    panelOpen: false,
    status: 'idle' as WmsAgentUiStatus,
    activityText: '等待任务',
    currentTask: '',
    currentPageTitle: '',
    currentPageId: '',
    messages: [] as AgentChatMessage[],
    timeline: [] as AgentTimelineEntry[],
    pendingQuestion: null as WmsAgentQuestion | null,
    confirmation: null as WmsAgentConfirmationRequest | null,
    lastError: '',
    lastFinalizedTaskId: '',
    feedSequence: 0,
  }),
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
      this.currentTask = task
      this.lastError = ''
      this.pendingQuestion = null
      this.confirmation = null
      this.messages.push(createMessage(++this.feedSequence, 'user', 'request', task))
      this.setStatus('thinking', '正在理解任务')
    },
    addUserAnswer(answer: string) {
      this.messages.push(createMessage(++this.feedSequence, 'user', 'answer', answer))
      this.pendingQuestion = null
      this.setStatus('executing', '已收到回答，继续执行')
    },
    setPendingQuestion(question: WmsAgentQuestion) {
      this.pendingQuestion = question
      this.messages.push(
        createMessage(++this.feedSequence, 'assistant', 'question', question.content),
      )
      this.setStatus('awaiting-input', '等待你补充信息')
    },
    clearPendingQuestion() {
      this.pendingQuestion = null
    },
    finalizeTask(taskId: string, kind: 'result' | 'error' | 'stopped', content: string) {
      if (!taskId || this.lastFinalizedTaskId === taskId) return
      this.lastFinalizedTaskId = taskId
      this.pendingQuestion = null
      this.messages.push(createMessage(++this.feedSequence, 'assistant', kind, content))
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
    togglePanel() {
      this.panelOpen = !this.panelOpen
    },
    closePanel() {
      this.panelOpen = false
    },
  },
})
