const reservedActions = new Map<string, Set<string>>()

export interface CompletedTaskAction {
  fingerprint: string
  message: string
}

const completedActions = new Map<string, CompletedTaskAction>()

export function actionExecutionFingerprint(actionId: string, args: unknown): string {
  return `${actionId}:${JSON.stringify(args)}`
}

export function reserveTaskAction(taskId: string, fingerprint: string): boolean {
  const taskActions = reservedActions.get(taskId) ?? new Set<string>()
  if (taskActions.has(fingerprint)) return false
  taskActions.add(fingerprint)
  reservedActions.set(taskId, taskActions)
  return true
}

export function releaseTaskAction(taskId: string, fingerprint: string): void {
  const taskActions = reservedActions.get(taskId)
  taskActions?.delete(fingerprint)
  if (!taskActions?.size) reservedActions.delete(taskId)
}

export function clearTaskActions(taskId: string): void {
  reservedActions.delete(taskId)
}

export function recordTaskActionCompletion(
  taskId: string,
  fingerprint: string,
  message: string,
): void {
  completedActions.set(taskId, { fingerprint, message })
}

export function getTaskActionCompletion(taskId: string): CompletedTaskAction | undefined {
  return completedActions.get(taskId)
}

export function clearTaskActionCompletion(taskId: string): void {
  completedActions.delete(taskId)
}
