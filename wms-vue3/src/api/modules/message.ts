import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

// -------- 消息公共类型 --------
export interface MessageItem {
  id: string
  title: string
  content: string
  type: string
  templateId: string
  templateName: string
  receiver: string
  receiverName: string
  status: '未完成' | '已完成'
  priority: '高' | '中' | '低'
  createTime: string
  finishTime?: string
  remark?: string
}

export interface MessageQueryParams {
  page: number
  pageSize: number
  title?: string
  type?: string
  receiver?: string
  priority?: string
}

export interface MessageListResponse {
  list: MessageItem[]
  total: number
  page: number
  pageSize: number
}

export function getPendingMessageList(params: MessageQueryParams): Promise<ApiResponse<MessageListResponse>> {
  return get<MessageListResponse>('/system/message/pending', params as unknown as Record<string, unknown>)
}

export function getDoneMessageList(params: MessageQueryParams): Promise<ApiResponse<MessageListResponse>> {
  return get<MessageListResponse>('/system/message/done', params as unknown as Record<string, unknown>)
}

export function deleteMessage(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/system/message/${id}`)
}

export function markMessageDone(id: string): Promise<ApiResponse<null>> {
  return put<null>(`/system/message/${id}/done`, {})
}

// -------- 消息模板 --------
export interface MessageTemplateItem {
  id: string
  name: string
  code: string
  type: string
  content: string
  status: '正常' | '停用'
  remark?: string
  createTime: string
  updateTime: string
}

export interface MessageTemplateQueryParams {
  page: number
  pageSize: number
  name?: string
  code?: string
  type?: string
  status?: string
}

export interface MessageTemplateListResponse {
  list: MessageTemplateItem[]
  total: number
  page: number
  pageSize: number
}

export function getMessageTemplateList(params: MessageTemplateQueryParams): Promise<ApiResponse<MessageTemplateListResponse>> {
  return get<MessageTemplateListResponse>('/system/message-template/list', params as unknown as Record<string, unknown>)
}

export function createMessageTemplate(data: Partial<MessageTemplateItem>): Promise<ApiResponse<MessageTemplateItem>> {
  return post<MessageTemplateItem>('/system/message-template', data)
}

export function updateMessageTemplate(id: string, data: Partial<MessageTemplateItem>): Promise<ApiResponse<MessageTemplateItem>> {
  return put<MessageTemplateItem>(`/system/message-template/${id}`, data)
}

export function deleteMessageTemplate(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/system/message-template/${id}`)
}

export function getMessageTemplateDetail(id: string): Promise<ApiResponse<MessageTemplateItem>> {
  return get<MessageTemplateItem>(`/system/message-template/${id}`)
}
