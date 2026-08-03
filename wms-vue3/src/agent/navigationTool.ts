import { tool } from 'page-agent'
import { z } from 'zod'
import router from '@/router'
import {
  resolveAgentNavigation,
  type AgentNavigationMode,
  type AgentNavigationResolution,
} from './navigationCatalog'

function navigationErrorMessage(result: Extract<AgentNavigationResolution, { ok: false }>): string {
  if (result.reason === 'ambiguous') {
    return `页面名称不够明确，请改用以下业务页面名称之一：${result.suggestions.join('、')}`
  }
  if (result.reason === 'mode_not_supported') {
    return `${result.suggestions[0] ?? '该页面'}没有可直接进入的新增页面`
  }
  return '目标页面不在 WMS Agent 导航白名单中'
}

async function waitForPageRender(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener('abort', abort)
      resolve()
    }
    const timeoutId = window.setTimeout(finish, 0)
    const abort = () => {
      window.clearTimeout(timeoutId)
      signal.removeEventListener('abort', abort)
      reject(signal.reason ?? new DOMException('Agent task aborted', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
  })
  signal.throwIfAborted()
}

export const navigationTool = tool({
  description:
    'Navigate directly to a whitelisted WMS business page. Pass only a Chinese business page name and list/create mode. Never pass a URL, route path, query, parameter, or business record ID.',
  inputSchema: z.object({
    page: z.string().trim().min(1).describe('WMS 业务页面名称，例如“销售订单”或“客户资料”'),
    mode: z
      .enum(['list', 'create'])
      .default('list')
      .describe('list 进入业务列表；create 进入空白新增页面'),
  }),
  execute: async function (input, { signal }) {
    signal.throwIfAborted()
    const mode = input.mode as AgentNavigationMode
    const result = resolveAgentNavigation(input.page, mode)
    if (!result.ok) throw new Error(navigationErrorMessage(result))

    const target = router.resolve({
      name: result.location.name,
      query: result.location.query,
    })
    if (!target.matched.length) {
      throw new Error(`WMS 页面“${result.page.title}”的导航配置无效`)
    }

    if (router.currentRoute.value.fullPath !== target.fullPath) {
      await router.push(target)
      signal.throwIfAborted()
      await waitForPageRender(signal)
    }

    return mode === 'create'
      ? `已进入${result.page.title}新增页面。`
      : `已进入${result.page.title}页面。`
  },
})
