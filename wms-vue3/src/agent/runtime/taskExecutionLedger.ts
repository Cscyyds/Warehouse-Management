export type TaskExecutionContract =
  | {
      kind: 'navigation'
      expectedPageId: string
      expectedMode: 'list' | 'create'
    }
  | {
      kind: 'business-action'
      expectedPageId?: string
      expectedActionIds: string[]
    }
  | {
      kind: 'open'
    }

interface NavigationEvidence {
  pageId: string
  mode: 'list' | 'create'
}

interface ActionEvidence {
  actionId: string
  pageId: string
}

interface TaskExecutionRecord {
  contract: TaskExecutionContract
  navigations: NavigationEvidence[]
  actions: ActionEvidence[]
  otherSuccessfulTools: string[]
}

interface CompletionInput {
  success: boolean
  text: string
}

const records = new Map<string, TaskExecutionRecord>()
const navigationClaimPattern = /(?:已|已经|成功).{0,10}(?:进入|打开|抵达|到达|跳转|定位到)/
const actionClaimPattern = /(?:已|已经|成功).{0,10}(?:查询|搜索|审核|创建|新增|提交|保存|删除|更新)/

export function beginTaskExecution(taskId: string, contract: TaskExecutionContract): void {
  records.set(taskId, {
    contract,
    navigations: [],
    actions: [],
    otherSuccessfulTools: [],
  })
}

export function recordTaskNavigationSuccess(
  taskId: string,
  pageId: string,
  mode: 'list' | 'create',
): void {
  records.get(taskId)?.navigations.push({ pageId, mode })
}

export function recordTaskActionSuccess(taskId: string, actionId: string, pageId: string): void {
  records.get(taskId)?.actions.push({ actionId, pageId })
}

export function recordTaskToolSuccess(taskId: string, toolName: string): void {
  const record = records.get(taskId)
  if (!record || ['done', 'ask_user', 'wait'].includes(toolName)) return
  record.otherSuccessfulTools.push(toolName)
}

export function verifyTaskCompletion(
  taskId: string,
  completion: CompletionInput,
): CompletionInput {
  if (!completion.success) return completion
  const record = records.get(taskId)
  if (!record) {
    return {
      success: false,
      text: '任务执行记录已失效，无法确认本次操作是否完成。',
    }
  }

  const contract = record.contract
  if (contract.kind === 'navigation') {
    const matched = record.navigations.some(
      (item) =>
        item.pageId === contract.expectedPageId
        && item.mode === contract.expectedMode,
    )
    if (!matched) {
      return {
        success: false,
        text: '未检测到目标页面的成功导航记录，本次任务没有确认完成。',
      }
    }
  }

  if (contract.kind === 'business-action') {
    const matched = record.actions.some((item) =>
      contract.expectedActionIds.includes(item.actionId),
    )
    if (!matched) {
      return {
        success: false,
        text: '未检测到目标业务能力的成功执行记录，本次查询或操作没有确认完成。',
      }
    }
  }

  if (
    contract.kind === 'open'
    && navigationClaimPattern.test(completion.text)
    && record.navigations.length === 0
  ) {
    return {
      success: false,
      text: '本次任务没有实际完成页面导航，请明确要进入的业务页面。',
    }
  }

  if (
    contract.kind === 'open'
    && actionClaimPattern.test(completion.text)
    && record.actions.length === 0
    && record.otherSuccessfulTools.length === 0
  ) {
    return {
      success: false,
      text: '本次任务没有检测到实际业务操作，请补充更明确的操作目标。',
    }
  }

  return completion
}

export function clearTaskExecution(taskId: string): void {
  records.delete(taskId)
}
