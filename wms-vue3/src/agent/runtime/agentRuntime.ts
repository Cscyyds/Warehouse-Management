import type { ExecutionResult, PageAgent } from 'page-agent'
import { clearTaskConfirmationDecisions, dispatcherTool } from '@/agent/dispatcherTool'
import { getPageAgentInstructions } from '@/agent/instructions'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import { agentUiBridge, connectAgentUi } from './agentUiBridge'

let pageAgent: PageAgent | undefined
let initializationPromise: Promise<PageAgent | undefined> | undefined
let disconnectUi: (() => void) | undefined

export const isPageAgentEnabled = () =>
  import.meta.env.DEV && import.meta.env.VITE_PAGE_AGENT_ENABLED === 'true'

export async function initializeAgentRuntime(): Promise<PageAgent | undefined> {
  const store = useAgentUiStore()
  const enabled = isPageAgentEnabled()
  store.setEnabled(enabled)
  if (!enabled) return undefined

  if (pageAgent) return pageAgent
  if (initializationPromise) return initializationPromise

  const apiKey = import.meta.env.VITE_PAGE_AGENT_API_KEY?.trim()
  if (!apiKey) {
    store.setError('PageAgent API Key 未配置')
    console.warn('[PageAgent] VITE_PAGE_AGENT_API_KEY is not configured')
    return undefined
  }

  initializationPromise = import('page-agent')
    .then(({ PageAgent }) => {
      const agent = new PageAgent({
        model: import.meta.env.VITE_PAGE_AGENT_MODEL || 'qwen3.5-plus',
        baseURL:
          import.meta.env.VITE_PAGE_AGENT_BASE_URL ||
          'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey,
        language: 'zh-CN',
        enableMask: false,
        // Keep PageAgent's DOM indexing available to the model without exposing
        // its diagnostic overlays in the WMS interface.
        highlightOpacity: 0,
        highlightLabelOpacity: 0,
        customTools: {
          ask_user: null,
          execute_wms_action: dispatcherTool,
        },
        instructions: {
          system:
            '你是 WMS 页面助手。业务查询和状态变更优先使用已注册的 WMS Action；不得猜测接口、绕过权限或在用户取消后重试相同写操作。',
          getPageInstructions: getPageAgentInstructions,
        },
        onAfterTask: (currentAgent) => {
          clearTaskConfirmationDecisions(currentAgent.taskId)
        },
      })

      // 官方 Panel 会在 running 时自动显示。WMS 使用自己的 Vue UI，因此立即释放它。
      agent.panel.dispose()
      agent.onAskUser = undefined

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

  const agent = pageAgent ?? (await initializeAgentRuntime())
  if (!agent) throw new Error('PageAgent 尚未就绪')
  if (agent.status === 'running') throw new Error('已有任务正在执行')

  const store = useAgentUiStore()
  store.startTask(normalizedTask)
  return agent.execute(normalizedTask)
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
