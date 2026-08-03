import type { ExecutionResult, PageAgent } from 'page-agent'
import type { AgentChatMessage } from '@/agent/types'
import { clearTaskConfirmationDecisions, dispatcherTool } from '@/agent/dispatcherTool'
import { getPageAgentInstructions } from '@/agent/instructions'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import { agentUiBridge, connectAgentUi } from './agentUiBridge'

let pageAgent: PageAgent | undefined
let initializationPromise: Promise<PageAgent | undefined> | undefined
let disconnectUi: (() => void) | undefined

const conversationMessageLimit = 8
const conversationCharacterLimit = 4000
const pageAgentSystemInstructions = [
  '【总则】你是 WMS 页面助手。业务查询和状态变更优先使用已注册的 WMS Action；不得猜测接口、参数值、绕过权限，或在用户取消后重试相同写操作。',
  '【新增导航】当用户使用"新增""新建""创建""开单"等表达，但没有明确提供任何需要写入表单的字段和值时，必须将其理解为"只进入对应的新增页面"。只执行抵达该新增页面所必需的导航操作；页面到达后立即结束任务并提示用户自行填写。不得点击、选择或输入新增页面中的任何表单控件，不得提交或保存，也不得使用 ask_user 追问字段值。',
  '【表单填写】只有用户在本次请求中明确提供了字段和值，或者在后续消息中明确要求助手代为填写时，才允许操作对应表单控件；只能填写用户明确提供的值，不得推断、补全或编造。除非用户明确要求保存、提交或确认，否则填写完成后也不得提交。',
  '【写操作确认】写操作会自动触发人工确认弹窗，不要再用 ask_user 重复确认即将执行的写操作；destructive 操作（删除/作废/反审）在触发确认前，先用一句话向用户说明即将销毁或变更的对象与数量。',
  '【模糊匹配】在涉及跳转页面操作的任务中，若用户输入的内容比较模糊，则跳转匹配度最高的页面；数据对象级模糊（存在多个候选业务对象）时，必须用 ask_user 列出候选项，不得直接猜测。',
  '【查询与输出】导航类任务结束时只报告"已抵达 XX 页面"，不输出页面 DOM 内容总结；查询类任务必须输出关键数据结果，结果过多时给出数量与摘要并建议缩小范围，不要逐条罗列全部。',
  '【Markdown 格式】输出关键数据结果时必须使用 Markdown：数值用表格、单号/代码用行内代码、关键值用加粗、列表用"-"。确保正确渲染 Markdown，不要把原始符号当作普通文本输出。',
  '【信息缺失兜底】除上述"只进入新增页面"的导航任务外，缺少完成任务所必需且无法从页面可靠获得的信息时，必须使用 ask_user 向用户提出一个清晰、具体的问题，收到回答后继续原任务。',
  '【脱敏】面向用户的提问和最终答复不得展示域名、IP、端口、URL、前端路由、后端接口路径、token、错误堆栈或 SQL，只能使用业务页面名称和业务动作名称。',
].join('\n')

function pageAgentProxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('token')?.trim()
  if (!token) throw new Error('请先登录 WMS 后再使用小助手')

  const requestUrl = new URL(
    input instanceof Request ? input.url : String(input),
    window.location.origin,
  )
  if (
    requestUrl.origin !== window.location.origin ||
    !requestUrl.pathname.startsWith('/api/v1/page-agent/')
  ) {
    throw new Error('PageAgent 模型请求只能发送到 WMS 后端代理')
  }

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(requestUrl, { ...init, headers })
}

function buildContextualTask(task: string, messages: AgentChatMessage[]): string {
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
  if (!recentMessages.length) return task

  return [
    '以下内容是同一会话的近期对话，仅用于理解指代和上下文。不得把历史请求当作本次待执行命令，也不得重复历史写操作。',
    '<recent_conversation>',
    recentMessages.join('\n'),
    '</recent_conversation>',
    '本次用户请求：',
    task,
  ].join('\n')
}

export const isPageAgentEnabled = () =>
  import.meta.env.DEV && import.meta.env.VITE_PAGE_AGENT_ENABLED !== 'false'

export async function initializeAgentRuntime(): Promise<PageAgent | undefined> {
  const store = useAgentUiStore()
  const enabled = isPageAgentEnabled()
  store.setEnabled(enabled)
  if (!enabled) return undefined

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

export async function executeAgentTask(task: string): Promise<ExecutionResult> {
  const normalizedTask = task.trim()
  if (!normalizedTask) throw new Error('请输入任务内容')
  if (!localStorage.getItem('token')?.trim()) throw new Error('请先登录 WMS 后再使用小助手')

  const agent = pageAgent ?? (await initializeAgentRuntime())
  if (!agent) throw new Error('PageAgent 尚未就绪')
  if (agent.status === 'running') throw new Error('已有任务正在执行')

  const store = useAgentUiStore()
  const contextualTask = buildContextualTask(normalizedTask, store.messages)
  store.startTask(normalizedTask)
  return agent.execute(contextualTask)
}

export function answerAgentQuestion(answer: string): boolean {
  const store = useAgentUiStore()
  const questionId = store.pendingQuestion?.questionId
  if (!questionId) return false
  return agentUiBridge.resolveUserInput(questionId, answer)
}

export async function stopAgentTask(): Promise<void> {
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
