import { tool } from 'page-agent'
import { z } from 'zod'
import { getAgentAction } from './actionRegistry'
import { getCurrentAgentPage } from './pageRegistry'
import { agentUiBridge } from './runtime/agentUiBridge'
import { useAgentUiStore } from './stores/agentUiStore'
import type {
  WmsAgentConfirmation,
  WmsAgentConfirmationRequest,
  WmsAgentExecutionContext,
} from './types'

const rejectedConfirmations = new Map<string, Set<string>>()

function confirmationFingerprint(actionId: string, args: unknown): string {
  return `${actionId}:${JSON.stringify(args)}`
}

export function clearTaskConfirmationDecisions(taskId: string) {
  rejectedConfirmations.delete(taskId)
}

export function toUiConfirmationRequest(
  confirmation: WmsAgentConfirmation,
  context: WmsAgentExecutionContext,
  actionId: string,
): WmsAgentConfirmationRequest {
  return {
    confirmationId: crypto.randomUUID(),
    taskId: context.taskId,
    actionId,
    pageId: context.pageId,
    title: confirmation.title,
    summary: confirmation.summary,
    details: confirmation.details ?? [],
  }
}

export const dispatcherTool = tool({
  description:
    'Execute one business action registered by the current WMS page. Only use action IDs listed in the current page instructions.',
  inputSchema: z.object({
    actionId: z.string().min(1),
    args: z.record(z.string(), z.unknown()).default({}),
  }),
  execute: async function (input, { signal }) {
    signal.throwIfAborted()

    const currentPage = getCurrentAgentPage()
    if (!currentPage) {
      throw new Error('当前页面未注册 Agent 能力')
    }

    const action = getAgentAction(input.actionId)
    if (!action) {
      throw new Error(`当前页面不允许执行 Action: ${input.actionId}`)
    }

    const parsed = action.inputSchema.safeParse(input.args)
    if (!parsed.success) {
      throw new Error(`Action 参数校验失败: ${z.prettifyError(parsed.error)}`)
    }

    if (action.risk !== 'read' && action.confirmation === 'none') {
      throw new Error(`非只读 Action 必须配置人工确认: ${action.id}`)
    }

    const context: WmsAgentExecutionContext = {
      signal,
      taskId: this.taskId,
      task: useAgentUiStore().currentTask,
      pageId: currentPage.definition.id,
      traceId: crypto.randomUUID(),
    }

    if (action.confirmation !== 'none') {
      const fingerprint = confirmationFingerprint(action.id, parsed.data)
      const rejected = rejectedConfirmations.get(context.taskId)
      if (rejected?.has(fingerprint)) {
        return '用户已取消相同操作，本任务内不会再次请求确认，也未发送写请求。'
      }

      if (!action.prepareConfirmation) {
        throw new Error(`Action 缺少确认预检: ${action.id}`)
      }
      const confirmation = await action.prepareConfirmation(parsed.data, context)
      signal.throwIfAborted()

      const accepted = action.requestConfirmation
        ? await action.requestConfirmation(confirmation, context)
        : await agentUiBridge.requestConfirmation(
            toUiConfirmationRequest(confirmation, context, action.id),
            signal,
          )

      if (!accepted) {
        const taskRejected = rejected ?? new Set<string>()
        taskRejected.add(fingerprint)
        rejectedConfirmations.set(context.taskId, taskRejected)
        return '用户已取消操作，未发送写请求。'
      }
    }

    signal.throwIfAborted()
    const result = await action.execute(parsed.data, context)
    signal.throwIfAborted()
    await action.onSuccess?.(result, parsed.data, context)

    return action.summarizeResult?.(result) ?? `${action.title}已完成。`
  },
})
