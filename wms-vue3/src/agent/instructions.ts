import { getRegisteredAgentActions } from './actionRegistry'
import { getCurrentAgentPage } from './pageRegistry'

export function getPageAgentInstructions(): string | undefined {
  const currentPage = getCurrentAgentPage()
  if (!currentPage) {
    return '当前页面未注册 WMS 业务 Action。只可使用普通页面操作，不得猜测或调用业务接口。'
  }

  const actions = getRegisteredAgentActions()
  const actionCatalog = actions.length
    ? actions
        .map(
          (action) =>
            `- ${action.id} [${action.risk}]: ${action.description}\n  参数: ${action.inputGuide}`,
        )
        .join('\n')
    : '- 当前页面没有可用业务 Action'

  const context = currentPage.definition.getContext?.()
  const contextText = context ? `\n当前轻量上下文: ${JSON.stringify(context)}` : ''

  return [
    `当前 WMS 页面: ${currentPage.definition.title} (${currentPage.definition.id})`,
    currentPage.definition.description,
    '优先使用 execute_wms_action 执行业务查询或状态变更。不得向该工具传 URL、HTTP Method 或 Header。',
    '当前允许的 Action:',
    actionCatalog,
    contextText,
  ]
    .filter(Boolean)
    .join('\n')
}
