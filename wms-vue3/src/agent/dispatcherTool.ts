import { tool } from 'page-agent'
import { z } from 'zod'
import { getAgentAction } from './actionRegistry'
import { getCurrentAgentPage } from './pageRegistry'
import { agentUiBridge } from './runtime/agentUiBridge'
import { recordTaskActionSuccess } from './runtime/taskExecutionLedger'
import { serializeWmsToolOutcome } from './runtime/toolOutcome'
import {
  actionExecutionFingerprint,
  clearTaskActions,
  recordTaskActionCompletion,
  releaseTaskAction,
  reserveTaskAction,
} from './runtime/taskActionExecutionGuard'
import { useAgentUiStore } from './stores/agentUiStore'
import type {
  WmsAgentConfirmation,
  WmsAgentConfirmationRequest,
  WmsAgentExecutionContext,
} from './types'

const rejectedConfirmations = new Map<string, Set<string>>()

const dispatcherInputSchema = z.object({
  actionId: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
})

type DispatcherInput = z.infer<typeof dispatcherInputSchema>

function confirmationFingerprint(actionId: string, args: unknown): string {
  return `${actionId}:${JSON.stringify(args)}`
}

export function clearTaskConfirmationDecisions(taskId: string) {
  rejectedConfirmations.delete(taskId)
  clearTaskActions(taskId)
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

/** Execute a registered WMS action after the orchestrator has selected it. */
export async function executeWmsAction(
  input: DispatcherInput,
  options: { signal: AbortSignal; taskId: string; task?: string },
): Promise<string> {
  const { signal, taskId } = options
  signal.throwIfAborted()

  const currentPage = getCurrentAgentPage()
  if (!currentPage) {
    return serializeWmsToolOutcome({
      ok: false,
      severity: 'incomplete',
      code: 'action_page_not_registered',
      message: '当前页面未注册 Agent 能力',
      actionId: input.actionId,
    })
  }

  const action = getAgentAction(input.actionId)
  if (!action) {
    return serializeWmsToolOutcome({
      ok: false,
      severity: 'incomplete',
      code: 'action_not_allowed',
      message: `当前页面不允许执行业务能力：${input.actionId}`,
      actionId: input.actionId,
    })
  }

  const parsed = action.inputSchema.safeParse(input.args)
  if (!parsed.success) {
    return serializeWmsToolOutcome({
      ok: false,
      severity: 'incomplete',
      code: 'action_invalid_arguments',
      message: `业务能力参数校验失败：${z.prettifyError(parsed.error)}`,
      actionId: action.id,
    })
  }

  if (action.risk !== 'read' && action.confirmation === 'none') {
    return serializeWmsToolOutcome({
      ok: false,
      severity: 'error',
      code: 'action_confirmation_misconfigured',
      message: `非只读业务能力缺少人工确认配置：${action.id}`,
      actionId: action.id,
    })
  }

  const context: WmsAgentExecutionContext = {
    signal,
    taskId,
    task: options.task ?? useAgentUiStore().currentTask,
    pageId: currentPage.definition.id,
    traceId: crypto.randomUUID(),
  }

  if (action.confirmation !== 'none') {
    const fingerprint = confirmationFingerprint(action.id, parsed.data)
    const rejected = rejectedConfirmations.get(context.taskId)
    if (rejected?.has(fingerprint)) {
      return serializeWmsToolOutcome({
        ok: false,
        severity: 'incomplete',
        code: 'action_cancelled',
        message: '用户已取消相同操作，本任务内不会再次请求确认，也未发送写请求。',
        actionId: action.id,
      })
    }

    if (!action.prepareConfirmation) {
      return serializeWmsToolOutcome({
        ok: false,
        severity: 'error',
        code: 'action_preview_misconfigured',
        message: `业务能力缺少确认预检：${action.id}`,
        actionId: action.id,
      })
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
      return serializeWmsToolOutcome({
        ok: false,
        severity: 'incomplete',
        code: 'action_cancelled',
        message: '用户已取消操作，未发送写请求。',
        actionId: action.id,
      })
    }
  }

  signal.throwIfAborted()
  const executionFingerprint = actionExecutionFingerprint(action.id, parsed.data)
  if (!reserveTaskAction(taskId, executionFingerprint)) {
    return serializeWmsToolOutcome({
      ok: true,
      severity: 'success',
      code: 'action_already_completed',
      message: `${action.title}已在本次任务中完成，不再重复执行。`,
      actionId: action.id,
    })
  }

  let actionExecuted = false
  let result: unknown
  try {
    result = await action.execute(parsed.data, context)
    actionExecuted = true
    signal.throwIfAborted()
    await action.onSuccess?.(result, parsed.data, context)
  } catch (error) {
    if (!actionExecuted) releaseTaskAction(taskId, executionFingerprint)
    throw error
  }

  const message = action.summarizeResult?.(result) ?? `${action.title}已完成。`
  recordTaskActionSuccess(context.taskId, action.id, currentPage.definition.id)
  recordTaskActionCompletion(context.taskId, executionFingerprint, message)
  return serializeWmsToolOutcome({
    ok: true,
    severity: 'success',
    code: 'action_completed',
    message,
    actionId: action.id,
  })
}

export const dispatcherTool = tool({
  description:
    'Execute one business action registered by the current WMS page. Only use action IDs listed in the current page instructions.',
  inputSchema: dispatcherInputSchema,
  execute: async function (input, { signal }) {
    return executeWmsAction(input, { signal, taskId: this.taskId })
  },
})
