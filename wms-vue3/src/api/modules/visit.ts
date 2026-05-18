/**
 * 模块：拜访任务
 * 表名：客户拜访任务表
 * 功能：拜访任务增删改查、审核管理
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface VisitItem {
  id: string
  visitNo: string
  title: string
  customerId: string
  customerName: string
  customerAddress: string
  contactPerson: string
  contactPhone: string
  visitType: string
  visitMode: string
  salesUserId: string
  salesUserName: string
  visitDate: string
  visitStartTime: string
  visitEndTime: string
  content: string
  result: string
  remark: string
  status: string
  auditStatus: string
  auditOpinion: string
  auditUserId: string
  auditUserName: string
  auditTime: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface VisitQueryParams {
  page: number
  pageSize: number
  visitNo?: string
  title?: string
  customerId?: string
  customerName?: string
  visitType?: string
  visitMode?: string
  salesUserId?: string
  status?: string
  auditStatus?: string
  startDate?: string
  endDate?: string
}

export interface VisitListResponse {
  list: VisitItem[]
  total: number
  page: number
  pageSize: number
}

export function getVisitList(params: VisitQueryParams): Promise<ApiResponse<VisitListResponse>> {
  return get<VisitListResponse>('/visit/list', params as unknown as Record<string, unknown>)
}

export function getVisitDetail(id: string): Promise<ApiResponse<VisitItem>> {
  return get<VisitItem>(`/visit/${id}`)
}

export function createVisit(data: Partial<VisitItem>): Promise<ApiResponse<VisitItem>> {
  return post<VisitItem>('/visit', data)
}

export function updateVisit(id: string, data: Partial<VisitItem>): Promise<ApiResponse<VisitItem>> {
  return put<VisitItem>(`/visit/${id}`, data)
}

export function deleteVisit(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/visit/${id}`)
}

export function auditVisit(id: string, auditStatus: string, auditOpinion: string): Promise<ApiResponse<null>> {
  return post<null>(`/visit/${id}/audit`, { auditStatus, auditOpinion })
}

export function batchAuditVisit(ids: string[], auditStatus: string, auditOpinion: string): Promise<ApiResponse<null>> {
  return post<null>('/visit/batch-audit', { ids, auditStatus, auditOpinion })
}
