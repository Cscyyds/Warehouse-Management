import { tool } from 'page-agent'
import { nextTick } from 'vue'
import { z } from 'zod'
import router from '@/router'
import {
  resolveAgentNavigation,
  type AgentNavigationMode,
  type AgentNavigationResolution,
} from './navigationCatalog'
import { recordTaskNavigationSuccess } from './runtime/taskExecutionLedger'
import { serializeWmsToolOutcome } from './runtime/toolOutcome'

function navigationErrorMessage(result: Extract<AgentNavigationResolution, { ok: false }>): string {
  if (result.reason === 'ambiguous') {
    return `页面名称不够明确，请改用以下业务页面名称之一：${result.suggestions.join('、')}`
  }
  if (result.reason === 'mode_not_supported') {
    return `${result.suggestions[0] ?? '该页面'}没有可直接进入的新增页面`
  }
  return '目标页面不在 WMS Agent 导航白名单中'
}

async function waitForRoutePostcondition(
  routeName: string,
  expectedQuery: Record<string, string>,
  signal: AbortSignal,
): Promise<boolean> {
  const deadline = Date.now() + 1500
  while (Date.now() <= deadline) {
    signal.throwIfAborted()
    const current = router.currentRoute.value
    const queryMatches = Object.entries(expectedQuery).every(
      ([key, value]) => String(current.query[key] ?? '') === value,
    )
    if (String(current.name ?? '') === routeName && queryMatches) {
      await nextTick()
      return true
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 25))
  }
  return false
}

export async function executeWmsNavigation(
  pageName: string,
  mode: AgentNavigationMode,
  taskId: string,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted()
  const result = resolveAgentNavigation(pageName, mode)
  if (!result.ok) {
    return serializeWmsToolOutcome({
      ok: false,
      severity: 'incomplete',
      code: `navigation_${result.reason}`,
      message: navigationErrorMessage(result),
    })
  }

  const target = router.resolve({
    name: result.location.name,
    query: result.location.query,
  })
  if (!target.matched.length) {
    return serializeWmsToolOutcome({
      ok: false,
      severity: 'error',
      code: 'navigation_invalid_route',
      message: `WMS 页面“${result.page.title}”的导航配置无效`,
      pageId: result.page.id,
      mode,
    })
  }

  try {
    if (router.currentRoute.value.fullPath !== target.fullPath) {
      await router.push(target)
    }
    signal.throwIfAborted()
    const reached = await waitForRoutePostcondition(
      result.location.name,
      result.location.query ?? {},
      signal,
    )
    if (!reached) {
      return serializeWmsToolOutcome({
        ok: false,
        severity: 'error',
        code: 'navigation_postcondition_failed',
        message: `未能确认已进入“${result.page.title}”页面`,
        pageId: result.page.id,
        mode,
      })
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    return serializeWmsToolOutcome({
      ok: false,
      severity: 'error',
      code: 'navigation_failed',
      message: `进入“${result.page.title}”页面失败`,
      pageId: result.page.id,
      mode,
    })
  }

  recordTaskNavigationSuccess(taskId, result.page.id, mode)
  return serializeWmsToolOutcome({
    ok: true,
    severity: 'success',
    code: 'navigation_completed',
    message: mode === 'create'
      ? `已进入${result.page.title}新增页面。`
      : `已进入${result.page.title}页面。`,
    pageId: result.page.id,
    mode,
  })
}

export const navigationTool = tool({
  description:
    'Navigate directly to a whitelisted WMS business page. Prefer the semantic page ID from page instructions. Never pass a URL, route path, query, parameter, or business record ID.',
  inputSchema: z.object({
    page: z.string().trim().min(1).describe('WMS 语义页面 ID 或业务页面名称，例如 sales.order 或“销售订单”'),
    mode: z
      .enum(['list', 'create'])
      .default('list')
      .describe('list 进入业务列表；create 进入空白新增页面'),
  }),
  execute: async function (input, { signal }) {
    return executeWmsNavigation(
      input.page,
      input.mode as AgentNavigationMode,
      this.taskId,
      signal,
    )
  },
})
