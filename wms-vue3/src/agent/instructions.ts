import { getRegisteredAgentActions } from './actionRegistry.ts'
import { getAgentNavigationCatalogText } from './navigationCatalog.ts'
import { getCurrentAgentPage } from './pageRegistry.ts'

let currentTaskContext: string | undefined

// page-agent 以 getPageInstructions(url) 调用本模块，URL 无法表达用户任务；
// 任务上下文改由执行入口显式注入，语义清单才能按当前请求筛选。
export function setAgentTaskContext(task: string): void {
  currentTaskContext = task.trim() || undefined
}

export function getPageAgentInstructions(_pageUrl?: string): string | undefined {
  const navigationInstructions = [
    '页面导航必须优先使用 navigate_wms_page；不得通过 DOM 点击菜单或新增按钮进行白名单内的跨页面导航。',
    'navigate_wms_page 参数：page 优先使用语义页面 ID；mode=list 进入列表，mode=create 进入空白新增页面。不得传 URL、路由、查询参数或记录 ID。',
    'page 只能取自下方清单中列出的页面 ID；清单中不存在的页面视为不可用。',
    '语义页面描述中的“不适用场景”是硬约束；没有唯一匹配页面或业务能力时必须询问用户，不得选择最相似页面。',
    `与当前任务相关的语义页面清单：\n${getAgentNavigationCatalogText(currentTaskContext)}`,
  ].join('\n')

  const currentPage = getCurrentAgentPage()
  if (!currentPage) {
    return [
      navigationInstructions,
      '当前页面未注册 WMS 业务 Action。除白名单页面导航外，只可使用普通页面操作，不得猜测或调用业务接口。',
    ].join('\n')
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
    navigationInstructions,
    `当前 WMS 页面: ${currentPage.definition.title} (${currentPage.definition.id})`,
    currentPage.definition.description,
    '优先使用 execute_wms_action 执行业务查询或状态变更。不得向该工具传 URL、HTTP Method 或 Header。',
    '面向用户的输出不得展示域名、IP、端口、URL、前端路由或后端接口路径；请用业务页面名称或业务动作名称描述结果。',
    '如果必要参数既未由用户提供、也无法从当前页面可靠取得，必须先使用 ask_user 询问；不得自行编造参数值。',
    '当前允许的 Action:',
    actionCatalog,
    contextText,
  ]
    .filter(Boolean)
    .join('\n')
}
