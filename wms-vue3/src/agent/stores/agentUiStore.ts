import { defineStore } from 'pinia'
import type {
  AgentTimelineEntry,
  WmsAgentConfirmationRequest,
  WmsAgentUiStatus,
} from '@/agent/types'

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
    timeline: [] as AgentTimelineEntry[],
    confirmation: null as WmsAgentConfirmationRequest | null,
    lastError: '',
  }),
  getters: {
    isRunning: (state) =>
      state.status === 'thinking' ||
      state.status === 'executing' ||
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
      this.timeline = []
      this.lastError = ''
      this.confirmation = null
      this.setStatus('thinking', '正在理解任务')
    },
    addTimelineEntry(entry: AgentTimelineEntry) {
      this.timeline.push(entry)
    },
    updateTimelineEntry(id: string, patch: Partial<AgentTimelineEntry>) {
      const entry = this.timeline.find((item) => item.id === id)
      if (entry) Object.assign(entry, patch)
    },
    setConfirmation(request: WmsAgentConfirmationRequest | null) {
      this.confirmation = request
      if (request) {
        this.setStatus('awaiting-confirmation', '等待人工确认')
      }
    },
    setError(message: string) {
      this.lastError = message
      this.setStatus('error', message)
    },
    togglePanel() {
      this.panelOpen = !this.panelOpen
    },
    closePanel() {
      this.panelOpen = false
    },
  },
})
