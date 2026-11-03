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
// 与 app 工程（aster-mindlink-smartwms 的 ChatModels.kt）逐层对齐。
export type WmsAgentMode = 'page' | 'office'

/** 待发送附件（app PendingFile）：先落占位（url 空），上传完成后整条替换。 */
export interface OfficePendingFile {
  id: string
  name: string
  size: number
  /** 上传到 agent_poc 后返回的文件地址；为空表示尚未上传完成。 */
  url: string
  /** 服务端口径：图片为 image，其余文档统一 excel。 */
  kind: 'excel' | 'image'
  /** 本地预览地址（objectURL），上传完成前缩略图先用它。 */
  localUrl: string
  file?: File
}

/** 已发送消息附带的文件（app UserAttachment）。 */
export interface OfficeUserAttachment {
  name: string
  url: string
  isImage: boolean
  /** 扩展名徽标（最多 4 字符）。 */
  abbreviation: string
  /** 图片附件的本地预览地址（objectURL，刷新后失效自动回退 url）。 */
  localUrl?: string
}

/** 智问 thinking 事件逐步输出的处理步骤（app StatusStep）。 */
export interface OfficeThinkingStep {
  id: string
  content: string
  nodeTitle: string
}

/** 与 app ChatPayload 对齐：思考步骤 / 回复图片 / 用户附件。 */
export interface OfficeMessagePayload {
  statusSteps: OfficeThinkingStep[]
  images: unknown[]
  /** 单文档附件（兼容旧历史记录）。 */
  file?: OfficeUserAttachment
  /** 图片附件（可多张）。 */
  files: OfficeUserAttachment[]
}

export type OfficeChatMessageStatus = 'streaming' | 'success' | 'waiting_input' | 'error' | 'interrupted'

export interface OfficeChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  /** agent_poc 挂起态选项（clarify/select/confirm），点击后作为下一条消息发送。 */
  options: string[]
  payload: OfficeMessagePayload
  status: OfficeChatMessageStatus
  createdAt: number
}

export interface OfficeConversationSession {
  id: string
  title: string
  preview: string
  /** 展示用相对时间文案（刚刚 / N分钟前 / 昨天 / MM-dd HH:mm）。 */
  updatedAt: string
}

/** 对话请求失败的结果弹窗（app ResultDialogState）。 */
export interface OfficeResultDialog {
  success: boolean
  title: string
  content: string
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
