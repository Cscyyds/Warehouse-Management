import type { AgentActivity, PageAgent } from 'page-agent'
import { getCurrentAgentPage, subscribeAgentPage } from '@/agent/pageRegistry'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import type {
  WmsAgentConfirmationHooks,
  WmsAgentConfirmationRequest,
} from '@/agent/types'

interface PendingConfirmation {
  request: WmsAgentConfirmationRequest
  resolve: (accepted: boolean) => void
  signal: AbortSignal
  abortHandler: () => void
  hooks?: WmsAgentConfirmationHooks
}

interface PendingUserInput {
  questionId: string
  taskId: string
  resolve: (answer: string) => void
  reject: (reason?: unknown) => void
  signal: AbortSignal
  abortHandler: () => void
}

let pendingConfirmation: PendingConfirmation | undefined
let pendingUserInput: PendingUserInput | undefined

function finishConfirmation(accepted: boolean) {
  const pending = pendingConfirmation
  if (!pending) return

  pendingConfirmation = undefined
  pending.signal.removeEventListener('abort', pending.abortHandler)
  const store = useAgentUiStore()
  store.setConfirmation(null)
  store.setStatus('executing', accepted ? '确认完成，正在执行' : '已取消操作')
  pending.hooks?.onSettled?.(accepted)
  pending.resolve(accepted)
}

function abortPendingUserInput(reason?: unknown) {
  const pending = pendingUserInput
  if (!pending) return

  pendingUserInput = undefined
  pending.signal.removeEventListener('abort', pending.abortHandler)
  useAgentUiStore().clearPendingQuestion()
  pending.reject(reason ?? new DOMException('Agent task aborted', 'AbortError'))
}

export const agentUiBridge = {
  requestUserInput(question: string, taskId: string, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted()
    if (pendingUserInput) throw new Error('已有一个 Agent 问题等待回答')

    return new Promise<string>((resolve, reject) => {
      const questionId = crypto.randomUUID()
      const abortHandler = () => abortPendingUserInput(signal.reason)
      pendingUserInput = { questionId, taskId, resolve, reject, signal, abortHandler }
      signal.addEventListener('abort', abortHandler, { once: true })
      useAgentUiStore().setPendingQuestion({ questionId, taskId, content: question })
    })
  },

  resolveUserInput(questionId: string, answer: string): boolean {
    const pending = pendingUserInput
    const normalizedAnswer = answer.trim()
    if (!pending || pending.questionId !== questionId || !normalizedAnswer) return false

    pendingUserInput = undefined
    pending.signal.removeEventListener('abort', pending.abortHandler)
    useAgentUiStore().addUserAnswer(normalizedAnswer)
    pending.resolve(normalizedAnswer)
    return true
  },

  requestConfirmation(
    request: WmsAgentConfirmationRequest,
    signal: AbortSignal,
    hooks?: WmsAgentConfirmationHooks,
  ): Promise<boolean> {
    signal.throwIfAborted()
    if (pendingConfirmation) {
      throw new Error('已有一项 Agent 操作等待确认')
    }

    return new Promise<boolean>((resolve) => {
      const abortHandler = () => finishConfirmation(false)
      pendingConfirmation = { request, resolve, signal, abortHandler, hooks }
      signal.addEventListener('abort', abortHandler, { once: true })
      useAgentUiStore().setConfirmation(request)
      hooks?.onOpen?.()
    })
  },

  resolveConfirmation(confirmationId: string, accepted: boolean): boolean {
    if (pendingConfirmation?.request.confirmationId !== confirmationId) return false
    finishConfirmation(accepted)
    return true
  },

  cancelPendingConfirmation() {
    finishConfirmation(false)
  },

  dispose() {
    abortPendingUserInput()
    finishConfirmation(false)
  },
}

export function connectAgentUi(agent: PageAgent): () => void {
  const store = useAgentUiStore()
  let activitySequence = 0
  let activeEntryId = ''
  let activeTool = ''

  const syncPage = () => {
    const page = getCurrentAgentPage()?.definition
    store.setPage(page ? { id: page.id, title: page.title } : undefined)
  }

  const onStatusChange = () => {
    if (agent.status === 'running') {
      if (store.status !== 'awaiting-confirmation' && store.status !== 'executing') {
        store.setStatus('thinking', '正在理解任务')
      }
      return
    }
    if (agent.status === 'completed') {
      const succeeded = agent.lastResult?.success === true
      const resultText = String(
        agent.lastResult?.data ?? (succeeded ? '任务已完成。' : '任务未能完成。'),
      )
      store.finalizeTask(agent.taskId, succeeded ? 'result' : 'error', resultText)
      store.setStatus(succeeded ? 'success' : 'error', succeeded ? '任务已完成' : '任务未完成')
      return
    }
    if (agent.status === 'stopped') {
      store.finalizeTask(agent.taskId, 'stopped', '当前任务已停止。')
      store.setStatus('stopped', '任务已停止')
      return
    }
    if (agent.status === 'error') {
      store.finalizeTask(
        agent.taskId,
        'error',
        String(agent.lastResult?.data ?? store.lastError ?? '任务执行失败。'),
      )
      store.setStatus('error', '任务执行失败')
    }
  }

  const onActivity = (event: Event) => {
    const activity = (event as CustomEvent<AgentActivity>).detail
    if (store.status === 'awaiting-confirmation' && activity.type !== 'error') return

    if (activity.type === 'thinking') {
      store.setStatus('thinking', '正在分析页面与任务')
      return
    }

    if (activity.type === 'executing') {
      const isBusinessAction = activity.tool === 'execute_wms_action'
      const isUserQuestion = activity.tool === 'ask_user'
      activeTool = activity.tool
      if (isUserQuestion) {
        activeEntryId = ''
        return
      }
      activeEntryId = `${agent.taskId}:${++activitySequence}`
      store.addTimelineEntry({
        id: activeEntryId,
        kind: isBusinessAction ? 'action' : 'dom',
        title: isBusinessAction
          ? '执行 WMS 业务动作'
          : `页面操作 · ${activity.tool}`,
        detail: isBusinessAction
          ? String((activity.input as { actionId?: string })?.actionId ?? 'execute_wms_action')
          : '正在操作当前页面',
        status: 'running',
      })
      store.setStatus('executing', isBusinessAction ? '正在调用业务能力' : '正在操作页面')
      return
    }

    if (activity.type === 'executed') {
      if (activeEntryId) {
        store.updateTimelineEntry(activeEntryId, {
          detail: activeTool === 'ask_user' ? '已收到用户回答' : activity.output,
          status: 'success',
          duration: activity.duration,
        })
      }
      return
    }

    if (activity.type === 'retrying') {
      store.addTimelineEntry({
        id: `${agent.taskId}:retry:${activity.attempt}`,
        kind: 'system',
        title: `模型请求重试 ${activity.attempt}/${activity.maxAttempts}`,
        detail: '正在重新连接模型服务',
        status: 'running',
      })
      store.setStatus('thinking', '模型服务重试中')
      return
    }

    if (activity.type === 'error') {
      if (activeEntryId) store.updateTimelineEntry(activeEntryId, { status: 'error' })
      store.setError(activity.message)
    }
  }

  const onHistoryChange = () => {
    // History 可能含敏感数据。MVP 时间线仅使用 activity 派生的白名单摘要。
  }

  agent.addEventListener('statuschange', onStatusChange)
  agent.addEventListener('activity', onActivity)
  agent.addEventListener('historychange', onHistoryChange)
  const unsubscribePage = subscribeAgentPage(syncPage)
  syncPage()

  return () => {
    agent.removeEventListener('statuschange', onStatusChange)
    agent.removeEventListener('activity', onActivity)
    agent.removeEventListener('historychange', onHistoryChange)
    unsubscribePage()
  }
}
