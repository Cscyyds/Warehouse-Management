export type AgentActivityType =
  | 'thinking'
  | 'executing'
  | 'executed'
  | 'retrying'
  | 'error'

/** 模型瞬时重试属于内部传输状态，不应进入用户可见的对话时间线。 */
export function shouldDisplayAgentActivity(activityType: AgentActivityType): boolean {
  return activityType !== 'retrying'
}
