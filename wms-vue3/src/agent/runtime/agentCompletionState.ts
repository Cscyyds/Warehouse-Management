import type { AgentChatMessage, WmsAgentUiStatus } from '@/agent/types'

export interface AgentCompletionPresentation {
  messageKind: Extract<AgentChatMessage['kind'], 'result' | 'incomplete' | 'error'>
  status: Extract<WmsAgentUiStatus, 'success' | 'incomplete' | 'error'>
  activityText: string
}

export function classifyAgentCompletion(
  succeeded: boolean,
  hasTechnicalFailure: boolean,
): AgentCompletionPresentation {
  if (succeeded) {
    return { messageKind: 'result', status: 'success', activityText: '任务已完成' }
  }
  if (hasTechnicalFailure) {
    return { messageKind: 'error', status: 'error', activityText: '任务执行失败' }
  }
  return {
    messageKind: 'incomplete',
    status: 'incomplete',
    activityText: '任务需要进一步明确',
  }
}
