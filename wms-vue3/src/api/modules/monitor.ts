import { get, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface AccessLogItem {
  id: string
  title: string
  requestUrl: string
  logType: string
  operator: string
  isException: boolean
  businessType: string
  businessKey: string
  operateTime: string
  clientIp: string
  deviceName: string
  browserName: string
  responseTime: number
}

export interface AccessLogQueryParams {
  page: number
  pageSize: number
  title?: string
  logType?: string
  operator?: string
  isException?: string
}

export interface AccessLogListResponse {
  list: AccessLogItem[]
  total: number
  page: number
  pageSize: number
}

export function getAccessLogList(params: AccessLogQueryParams): Promise<ApiResponse<AccessLogListResponse>> {
  return get<AccessLogListResponse>('/monitor/access-log/list', params as unknown as Record<string, unknown>)
}

export function deleteAccessLog(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/monitor/access-log/${id}`)
}

export function clearAccessLogs(): Promise<ApiResponse<null>> {
  return del<null>('/monitor/access-log/clear')
}

export interface OnlineUserItem {
  id: string
  userName: string
  createTime: string
  lastAccessTime: string
  timeout: string
  clientHost: string
  userType: string
  deviceType: string
}

export interface OnlineUserQueryParams {
  page: number
  pageSize: number
  userName?: string
  userType?: string
}

export interface OnlineUserListResponse {
  list: OnlineUserItem[]
  total: number
  page: number
  pageSize: number
}

export function getOnlineUserList(params: OnlineUserQueryParams): Promise<ApiResponse<OnlineUserListResponse>> {
  return get<OnlineUserListResponse>('/monitor/online-user/list', params as unknown as Record<string, unknown>)
}

export function forceLogout(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/monitor/online-user/${id}`)
}
