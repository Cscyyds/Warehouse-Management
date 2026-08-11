import type { ExecutionResult, PageAgent } from 'page-agent'
import type { AgentChatMessage } from '@/agent/types'
import {
  clearTaskConfirmationDecisions,
  dispatcherTool,
  executeWmsAction,
} from '@/agent/dispatcherTool'
import { getPageAgentInstructions } from '@/agent/instructions'
import { executeWmsNavigation, navigationTool } from '@/agent/navigationTool'
import { navigateToFinanceSection } from '@/agent/financeSectionNavigation'
import {
  resolveDeterministicTaskIntent,
  type DeterministicTaskIntent,
} from '@/agent/semanticIntentRouter'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import { waitForAgentPage } from '@/agent/pageRegistry'
import { agentUiBridge, connectAgentUi } from './agentUiBridge'
import { buildAmbiguityGuidance } from './ambiguityGuidance'
import { normalizePageAgentModelResponse } from './pageAgentResponseNormalizer'
import { scheduleAgentPagePreload } from './preloadAgentPages'
import { parseWmsToolOutcome } from './toolOutcome'
import {
  clearTaskActionCompletion,
  getTaskActionCompletion,
} from './taskActionExecutionGuard'
import {
  beginTaskExecution,
  clearTaskExecution,
  verifyTaskCompletion,
} from './taskExecutionLedger'

let pageAgent: PageAgent | undefined
let initializationPromise: Promise<PageAgent | undefined> | undefined
let disconnectUi: (() => void) | undefined
let deterministicAbortController: AbortController | undefined

const conversationMessageLimit = 8
const conversationCharacterLimit = 4000
const pageAgentSystemInstructions = [
  // ── 角色边界 ──
  '【角色】你是 WMS 页面操作助手，不是通用对话助手。你只执行页面导航和已注册的 WMS Action。严禁提供建议、分析数据、规划方案，或对已完成的操作做总结评论。',
  // ── 任务边界（核心反发散） ──
  '【任务边界】每次只执行用户当前请求的一个明确操作，操作完成后立即结束，严禁追加任何内容。严禁追问"还需要其他帮助吗"、推荐后续步骤、评论操作结果、或在导航完成后输出页面 DOM 摘要。',
  // ── 能力范围（封闭集合） ──
  '【能力】你只能执行以下三种操作，超出范围一律回复"此操作不在我的能力范围内"：',
  '  ① navigate_wms_page — 导航到白名单页面（page=业务页面名称, mode=list|create）',
  '  ② execute_wms_action — 执行当前页面 instructions 中列出的 Action',
  '  ③ ask_user — 缺少必要信息时向用户提问（一次只问一个问题）',
  // ── 禁止行为（显式负面清单） ──
  '【严禁】猜测或编造接口/参数/数据、绕过权限或确认机制、用户取消后重试相同写操作、用 DOM 点击进行跨页面导航（必须用 navigate_wms_page）、填写用户未提供的表单字段值、自行推断模糊的业务对象。',
  // ── 新增导航 ──
  '【新增】用户只说"新增/新建/创建/开单"但未提供表单字段值时，只导航到对应新增页面（navigate_wms_page mode=create），到达后立即结束，提示"已进入新增页面，请自行填写"。严禁操作新增页面任何控件、追问字段值或提交表单。',
  // ── 表单填写 ──
  '【表单】仅当用户在本次请求中明确提供了字段和值时，填写对应控件；不推断、不补全、不编造。除非用户明确要求提交，否则填写后不提交。',
  // ── 写操作 ──
  '【写操作】写操作会自动弹出确认框，严禁用 ask_user 重复确认。destructive 操作（删除/作废/反审）在确认前只用一句话说明即将销毁/变更的对象与数量。',
  // ── 模糊匹配 ──
  '【模糊查询处理】当用户请求中包含具体公司/组织/产品名称（如"沃尔玛"、"京东"、"阿里"）和模糊意图（如"查资料"、"看信息"），但没有明确指明业务对象类型（客户/供应商/产品/员工）时，你必须严格遵循以下规则：',
  '  ① 严禁假设该名称属于哪类业务对象、严禁声称"系统中不存在"、严禁自行导航到任一猜测页面。',
  '  ② 必须使用 ask_user 列出所有可能相关的业务页面，格式为：',
  '     "您要查询的"XXX"是指哪一类业务对象？请在以下候选项中指明：',
  '     - 页面A标题（pageIdA）',
  '     - 页面B标题（pageIdB）"',
  '  ③ 候选页面来自系统指令中的语义页面清单，选取意图关键词匹配度最高的 2~4 个。',
  '  ④ 用户明确选择后，再导航到对应页面。',
  '  【注意】页面名称本身模糊时（如"订单"同时匹配采购订单和销售订单），选匹配度最高的直接导航，不用 ask_user。这条仅适用于页面名模糊，不适用于业务对象名模糊。',
  // ── 输出规则 ──
  '【输出】导航任务仅回复"已抵达 XX 页面"。查询任务输出关键结果，超过 5 条时只给总数 + 前 3 条示例 + 摘要，并建议缩小范围。严禁逐条列出全部结果。',
  '【格式】输出关键数据结果时必须使用 Markdown：数值用表格、单号/代码用行内代码、关键值用加粗、列表用"-"。确保正确渲染 Markdown，不要把原始符号当作普通文本输出。',
  // ── 脱敏与兜底 ──
  '【脱敏】输出中严禁出现域名、IP、端口、URL、路由、接口路径、token、错误堆栈、SQL。仅用业务页面名称和业务动作名称。',
  '【兜底】缺少任务必需且无法从页面获取的信息时，用 ask_user 提一个具体问题，收到回答后继续。',
].join('\n')

/**
 * 页面助手请求代理：将 PageAgent 模型请求转发到 VITE_API_BASE_URL 配置的后端
 * @param input 模型请求地址（相对路径 /api/v1/page-agent/...）
 * @param init 原始请求配置
 * @returns 规范化后的后端响应
 * @throws 未登录或请求目标非 WMS 后端代理时抛出错误
 */
async function pageAgentProxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('token')?.trim()
  if (!token) throw new Error('请先登录 WMS 后再使用小助手')

  // 优先转发到 VITE_API_BASE_URL 指向的远程后端；未配置时回退到当前站点。
  // 兼容相对路径配置(如 '.env.development' 的 '/'):new URL(相对路径) 必须补 base,
  // 否则抛 TypeError: Invalid URL,请求在发出前就失败且无任何网络记录。
  const apiBase = new URL(
    import.meta.env.VITE_API_BASE_URL || window.location.origin,
    window.location.origin,
  )
  const allowedOrigin = apiBase.origin
  const requestUrl = new URL(
    input instanceof Request ? input.url : String(input),
    apiBase,
  )
  if (requestUrl.origin !== allowedOrigin || !requestUrl.pathname.startsWith('/api/v1/page-agent/')) {
    throw new Error('PageAgent 模型请求只能发送到 WMS 后端代理')
  }

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(requestUrl, { ...init, headers })
  return normalizePageAgentModelResponse(response)
}

function buildContextualTask(task: string, messages: AgentChatMessage[]): string {
  const ambiguityGuidance = buildAmbiguityGuidance(task)

  const recentMessages = messages
    .filter((message) => message.kind !== 'error' && message.kind !== 'stopped')
    .slice(-conversationMessageLimit)
    .map((message) => {
      const speaker = message.role === 'user' ? '用户' : 'WMS小助手'
      return `${speaker}: ${message.content.slice(0, 1200)}`
    })

  while (recentMessages.join('\n').length > conversationCharacterLimit) {
    recentMessages.shift()
  }
  if (!recentMessages.length && !ambiguityGuidance) return task
  if (!recentMessages.length && ambiguityGuidance) return [ambiguityGuidance, '本次用户请求：', task].join('\n')

  return [
    '以下内容是同一会话的近期对话，仅用于理解指代和上下文。不得把历史请求当作本次待执行命令，也不得重复历史写操作。',
    '<recent_conversation>',
    recentMessages.join('\n'),
    '</recent_conversation>',
    ambiguityGuidance,
    '本次用户请求：',
    task,
  ].filter(Boolean).join('\n')
}

export const isPageAgentEnabled = () =>
  import.meta.env.VITE_PAGE_AGENT_ENABLED === 'true' || import.meta.env.DEV

export async function initializeAgentRuntime(): Promise<PageAgent | undefined> {
  const store = useAgentUiStore()
  const enabled = isPageAgentEnabled()
  store.setEnabled(enabled)
  if (!enabled) return undefined

  scheduleAgentPagePreload()

  if (pageAgent) return pageAgent
  if (initializationPromise) return initializationPromise

  initializationPromise = import('page-agent')
    .then(({ PageAgent }) => {
      const agent = new PageAgent({
        // PageAgent 本地要求 model 非空；实际上游模型由后端 PAGE_AGENT_LLM_MODEL 决定。
        model: 'server-configured-model',
        baseURL: '/api/v1/page-agent',
        apiKey: '',
        customFetch: pageAgentProxyFetch,
        language: 'zh-CN',
        enableMask: false,
        // Keep PageAgent's DOM indexing available to the model without exposing
        // its diagnostic overlays in the WMS interface.
        highlightOpacity: 0,
        highlightLabelOpacity: 0,
        customTools: {
          navigate_wms_page: navigationTool,
          execute_wms_action: dispatcherTool,
        },
        instructions: {
          system: pageAgentSystemInstructions,
          getPageInstructions: getPageAgentInstructions,
        },
        onAfterTask: (currentAgent) => {
          clearTaskConfirmationDecisions(currentAgent.taskId)
        },
      })

      // 官方 Panel 会在 running 时自动显示。WMS 使用自己的 Vue UI，因此立即释放它。
      agent.panel.dispose()
      agent.onAskUser = (question, options) => {
        if (!options?.signal) throw new Error('ask_user 缺少任务中止信号')
        return agentUiBridge.requestUserInput(question, agent.taskId, options.signal)
      }

      pageAgent = agent
      disconnectUi = connectAgentUi(agent)
      store.setAvailable(true)
      store.setStatus('idle', '等待任务')
      window.pageAgent = agent
      console.info('[PageAgent] WMS runtime ready. Use window.pageAgent for local debugging.')
      return agent
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      store.setError(`PageAgent 初始化失败: ${message}`)
      console.error('[PageAgent] Failed to initialize', error)
      return undefined
    })
    .finally(() => {
      initializationPromise = undefined
    })

  return initializationPromise
}

export function getAgentRuntime(): PageAgent | undefined {
  return pageAgent
}

function immediateResult(success: boolean, data: string): ExecutionResult {
  return { success, data, history: [] }
}

async function executeDeterministicBusinessAction(
  intent: Extract<DeterministicTaskIntent, { kind: 'business-action' }>,
  originalTask: string,
): Promise<ExecutionResult> {
  const store = useAgentUiStore()
  const taskId = `wms-action:${crypto.randomUUID()}`
  const controller = new AbortController()
  deterministicAbortController = controller
  beginTaskExecution(taskId, intent.contract)

  const navigationEntryId = `${taskId}:navigation`
  const actionEntryId = `${taskId}:action`
  store.addTimelineEntry({
    id: navigationEntryId,
    kind: 'navigation',
    title: '直接进入 WMS 页面',
    detail: `正在进入${intent.pageTitle}`,
    status: 'running',
  })
  store.setStatus('executing', '正在定位业务页面')

  try {
    const navigationRaw = await executeWmsNavigation(
      intent.pageId,
      'list',
      taskId,
      controller.signal,
    )
    const navigationOutcome = parseWmsToolOutcome(navigationRaw)
    if (!navigationOutcome?.ok) {
      const message = navigationOutcome?.message ?? '进入目标页面失败'
      const severity = navigationOutcome?.severity ?? 'error'
      store.updateTimelineEntry(navigationEntryId, { detail: message, status: severity })
      store.finalizeTask(taskId, severity === 'error' ? 'error' : 'incomplete', message)
      store.setStatus(severity === 'error' ? 'error' : 'incomplete', message)
      return immediateResult(false, message)
    }

    store.updateTimelineEntry(navigationEntryId, {
      detail: navigationOutcome.message,
      status: 'success',
    })
    await waitForAgentPage(intent.agentPageId, controller.signal)

    store.addTimelineEntry({
      id: actionEntryId,
      kind: 'action',
      title: '执行 WMS 业务查询',
      detail: `正在执行${intent.actionId}`,
      status: 'running',
    })
    store.setStatus('executing', '正在查询业务数据')

    const actionRaw = await executeWmsAction(
      { actionId: intent.actionId, args: intent.args },
      { signal: controller.signal, taskId, task: originalTask },
    )
    const actionOutcome = parseWmsToolOutcome(actionRaw)
    if (!actionOutcome) throw new Error('业务 Action 返回了无法识别的结果')

    const verified = verifyTaskCompletion(taskId, {
      success: actionOutcome.ok,
      text: actionOutcome.message,
    })
    const failureStatus: 'error' | 'incomplete' = actionOutcome.severity === 'error'
      ? 'error'
      : 'incomplete'
    const timelineStatus = verified.success ? 'success' : failureStatus
    store.updateTimelineEntry(actionEntryId, { detail: verified.text, status: timelineStatus })
    store.finalizeTask(taskId, verified.success ? 'result' : failureStatus, verified.text)
    store.setStatus(
      verified.success ? 'success' : failureStatus,
      verified.success ? '任务已完成' : '任务未完成',
    )
    return immediateResult(verified.success, verified.text)
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      const message = '当前任务已停止。'
      store.finalizeTask(taskId, 'stopped', message)
      store.setStatus('stopped', '任务已停止')
      return immediateResult(false, message)
    }
    const message = error instanceof Error ? error.message : '采购订单查询失败'
    store.updateTimelineEntry(actionEntryId, { detail: message, status: 'error' })
    store.finalizeTask(taskId, 'error', message)
    store.setStatus('error', '任务执行失败')
    return immediateResult(false, message)
  } finally {
    clearTaskExecution(taskId)
    clearTaskConfirmationDecisions(taskId)
    clearTaskActionCompletion(taskId)
    if (deterministicAbortController === controller) deterministicAbortController = undefined
  }
}

async function executeDeterministicTask(
  intent: Exclude<DeterministicTaskIntent, { kind: 'agent' }>,
  originalTask: string,
): Promise<ExecutionResult> {
  if (intent.kind === 'business-action') {
    return executeDeterministicBusinessAction(intent, originalTask)
  }

  const store = useAgentUiStore()
  const taskId = `wms-direct:${crypto.randomUUID()}`

  if (intent.kind === 'clarify' || intent.kind === 'unsupported') {
    store.finalizeTask(taskId, 'incomplete', intent.message)
    store.setStatus('incomplete', '任务需要进一步明确')
    return immediateResult(false, intent.message)
  }

  const controller = new AbortController()
  deterministicAbortController = controller
  const entryId = `${taskId}:navigation`
  const pageTitle = intent.kind === 'navigate' ? intent.pageTitle : intent.sectionTitle
  store.addTimelineEntry({
    id: entryId,
    kind: 'navigation',
    title: intent.kind === 'navigate' ? '直接进入 WMS 页面' : '定位 WMS 业务模块',
    detail: `正在进入${pageTitle}`,
    status: 'running',
  })
  store.setStatus('executing', '正在切换业务页面')

  try {
    const rawOutcome = intent.kind === 'navigate'
      ? await executeWmsNavigation(intent.pageId, intent.mode, taskId, controller.signal)
      : await navigateToFinanceSection(controller.signal)
    const outcome = parseWmsToolOutcome(rawOutcome)
    const success = outcome ? outcome.ok : true
    const message = outcome?.message ?? rawOutcome
    const severity = outcome?.severity ?? 'success'

    store.updateTimelineEntry(entryId, { detail: message, status: severity })
    store.finalizeTask(taskId, success ? 'result' : severity === 'error' ? 'error' : 'incomplete', message)
    store.setStatus(
      success ? 'success' : severity === 'error' ? 'error' : 'incomplete',
      success ? '任务已完成' : severity === 'error' ? '任务执行失败' : '任务需要进一步明确',
    )
    // 导航完成后追加 follow-up（如 ambiguous 场景下"如果你指的是其他类型请告诉我"）。
    if (success && intent.kind === 'navigate' && intent.followUp) {
      store.appendAssistantMessage('incomplete', intent.followUp.message)
    }
    return immediateResult(success, message)
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      const message = '当前任务已停止。'
      store.updateTimelineEntry(entryId, { detail: message, status: 'incomplete' })
      store.finalizeTask(taskId, 'stopped', message)
      store.setStatus('stopped', '任务已停止')
      return immediateResult(false, message)
    }

    const message = error instanceof Error ? error.message : '进入目标页面失败'
    store.updateTimelineEntry(entryId, { detail: message, status: 'error' })
    store.finalizeTask(taskId, 'error', message)
    store.setStatus('error', '任务执行失败')
    return immediateResult(false, message)
  } finally {
    if (deterministicAbortController === controller) deterministicAbortController = undefined
  }
}

export async function executeAgentTask(task: string): Promise<ExecutionResult> {
  const normalizedTask = task.trim()
  if (!normalizedTask) throw new Error('请输入任务内容')
  if (!localStorage.getItem('token')?.trim()) throw new Error('请先登录 WMS 后再使用小助手')

  const store = useAgentUiStore()
  if (store.isRunning || pageAgent?.status === 'running') throw new Error('已有任务正在执行')
  const intent = resolveDeterministicTaskIntent(normalizedTask)
  const recentMessages = [...store.messages]
  store.startTask(normalizedTask)
  if (intent.kind !== 'agent') return executeDeterministicTask(intent, normalizedTask)

  const agent = pageAgent ?? (await initializeAgentRuntime())
  if (!agent) throw new Error('PageAgent 尚未就绪')

  const contextualTask = buildContextualTask(normalizedTask, recentMessages)
  const execution = agent.execute(contextualTask)
  const taskId = agent.taskId
  try {
    const result = await execution
    const completedAction = getTaskActionCompletion(taskId)
    return completedAction
      ? immediateResult(true, completedAction.message)
      : result
  } finally {
    clearTaskActionCompletion(taskId)
  }
}

export function answerAgentQuestion(answer: string): boolean {
  const store = useAgentUiStore()
  const questionId = store.pendingQuestion?.questionId
  if (!questionId) return false
  return agentUiBridge.resolveUserInput(questionId, answer)
}

export async function stopAgentTask(): Promise<void> {
  deterministicAbortController?.abort()
  await pageAgent?.stop()
}

export async function shutdownAgentRuntime(): Promise<void> {
  const agent = pageAgent
  pageAgent = undefined
  if (!agent) return

  await agent.stop()
  agentUiBridge.dispose()
  disconnectUi?.()
  disconnectUi = undefined
  agent.dispose()
  window.pageAgent = undefined

  const store = useAgentUiStore()
  store.setAvailable(false)
  store.setStatus('idle', '等待任务')
}
