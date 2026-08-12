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
  kind: 'action' | 'navigation' | 'dom' | 'system' | 'error'
  title: string
  detail: string
  status: 'running' | 'success' | 'incomplete' | 'error'
  duration?: number
}

export interface AgentChatMessage {
  id: string
  sequence: number
  role: 'user' | 'assistant'
  kind: 'request' | 'question' | 'answer' | 'result' | 'incomplete' | 'error' | 'stopped'
  content: string
  createdAt: number
}

// 办公模式（日常办公）相关类型 ====================================
export type WmsAgentMode = 'page' | 'office'

export interface OfficeAttachment {
  id: string
  name: string
  size: number
  type: string // 文件 MIME 类型；语音统一标记为 'audio/voice'
}

export interface OfficeChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments: OfficeAttachment[]
  createdAt: number
  pending?: boolean // 助手消息是否处于模拟思考中
}

export interface OfficePendingTask {
  id: string
  text: string
  attachments: OfficeAttachment[]
}

export interface AgentConversationSession {
  id: string
  title: string
  messages: AgentChatMessage[]
  timeline: AgentTimelineEntry[]
  createdAt: number
  updatedAt: number
}

export type WmsAgentUiStatus =
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'awaiting-input'
  | 'awaiting-confirmation'
  | 'success'
  | 'incomplete'
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
