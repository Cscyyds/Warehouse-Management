import type { ZodType } from 'zod'

export type AgentActionRisk = 'read' | 'write' | 'state-change' | 'destructive'

export interface WmsAgentConfirmation {
  title: string
  summary: string
  details?: Array<{ label: string; value: string }>
  uiPayload?: unknown
}

export interface WmsAgentExecutionContext {
  signal: AbortSignal
  taskId: string
  task: string
  pageId: string
  traceId: string
}

export interface WmsAgentActionDefinition<TInput = unknown, TResult = unknown> {
  id: string
  title: string
  description: string
  inputSchema: ZodType<TInput>
  inputGuide: string
  risk: AgentActionRisk
  confirmation: 'none' | 'preview' | 'explicit'
  prepareConfirmation?: (
    input: TInput,
    context: WmsAgentExecutionContext,
  ) => Promise<WmsAgentConfirmation> | WmsAgentConfirmation
  requestConfirmation?: (
    confirmation: WmsAgentConfirmation,
    context: WmsAgentExecutionContext,
  ) => Promise<boolean>
  execute: (input: TInput, context: WmsAgentExecutionContext) => Promise<TResult>
  summarizeResult?: (result: TResult) => string
  onSuccess?: (result: TResult, input: TInput, context: WmsAgentExecutionContext) => void | Promise<void>
}

export interface WmsAgentPageDefinition {
  id: string
  title: string
  routePath: string
  description: string
  getContext?: () => unknown
}

export interface RegisteredAgentPage {
  token: symbol
  definition: WmsAgentPageDefinition
}

export interface AgentTimelineEntry {
  id: string
  sequence?: number
  kind: 'action' | 'dom' | 'system' | 'error'
  title: string
  detail: string
  status: 'running' | 'success' | 'error'
  duration?: number
}

export interface AgentChatMessage {
  id: string
  sequence: number
  role: 'user' | 'assistant'
  kind: 'request' | 'question' | 'answer' | 'result' | 'error' | 'stopped'
  content: string
  createdAt: number
}

export type WmsAgentUiStatus =
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'awaiting-input'
  | 'awaiting-confirmation'
  | 'success'
  | 'error'
  | 'stopped'

export interface WmsAgentConfirmationRequest {
  confirmationId: string
  taskId: string
  actionId: string
  pageId: string
  title: string
  summary: string
  details: Array<{ label: string; value: string }>
}

export interface WmsAgentConfirmationHooks {
  onOpen?: () => void
  onSettled?: (accepted: boolean) => void
}

export interface WmsAgentQuestion {
  questionId: string
  taskId: string
  content: string
}
