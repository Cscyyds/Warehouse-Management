/**
 * 模块：系统管理-系统监控（访问日志 + 在线用户）
 * 源接口：app/api/v1/endpoints/tenant_employee_management.py（接口 37~41）
 * 文档：docs/03_租客员工_人员组织权限.md
 *   37. GET /api/v1/tenant-operation-logs/query   查询操作日志列表
 *   38. GET /api/v1/tenant-operation-logs/detail   查询操作日志详情
 *   39. GET /api/v1/tenant-operation-logs/search   搜索操作日志（不支持 time 时间范围搜索）
 *   40. GET /api/v1/tenant-users/online/today/query       查询当日在线员工
 *   41. GET /api/v1/tenant-users/online/today/by-name     按姓名查询当日在线员工
 * 说明：均为 GET 接口，参数走 URL Query String；search_field / search_value 为 JSON 字符串
 */
import { get } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 操作日志支持排序的字段（接口 37/39 的 sort_by 白名单） */
export const OPERATION_LOG_SORT_FIELDS = [
  'operated_at',
  'response_time_ms',
  'success',
  'log_type',
  'operator_user_id',
  'operator_identity',
  'request_path',
  'log_title',
] as const
export type OperationLogSortField = (typeof OPERATION_LOG_SORT_FIELDS)[number]

/** 操作日志支持搜索的字段（接口 39 的 search_field 白名单） */
export const OPERATION_LOG_SEARCH_FIELDS = [
  'log_title',
  'request_path',
  'log_type',
  'operator_user_name',
  'detail',
] as const
export type OperationLogSearchField = (typeof OPERATION_LOG_SEARCH_FIELDS)[number]

/** 在线用户支持排序的字段（接口 40 的 sort_by 白名单） */
export const ONLINE_USER_SORT_FIELDS = [
  'updated_at',
  'created_at',
  'user_name',
  'login_name',
  'user_id',
  'client_ip',
  'device_name',
  'browser_name',
] as const
export type OnlineUserSortField = (typeof ONLINE_USER_SORT_FIELDS)[number]

/** 操作日志列表项（接口 37/38/39 返回的单条记录） */
export interface OperationLogItem {
  id: number
  log_id: string
  log_title: string
  request_path: string
  log_type: string
  operator_user_id: string | null
  operator_user_name: string | null
  operator_identity: string
  tenant_id: string | null
  success: number
  detail: string | null
  operated_at: string | null
  client_ip: string | null
  device_name: string | null
  browser_name: string | null
  response_time_ms: number | null
}

/** 操作日志列表响应：{ total, log } */
export interface OperationLogListResponse {
  total: number
  log: OperationLogItem[]
}

/** 操作日志详情响应：{ total, log }（log 为单条对象） */
export interface OperationLogDetailResponse {
  total: number
  log: OperationLogItem
}

/** 在线用户列表项（接口 40/41 返回的单条记录） */
export interface OnlineUserItem {
  id: number
  online_id: string
  tenant_id: string
  user_id: string
  user_name: string | null
  login_name: string | null
  user_type: string | null
  client_ip: string | null
  device_name: string | null
  browser_name: string | null
  created_at: string | null
  updated_at: string | null
}

/** 在线用户列表响应：{ total, online } */
export interface OnlineUserListResponse {
  total: number
  online: OnlineUserItem[]
}

/**
 * 接口 37：查询操作日志列表
 * GET /api/v1/tenant-operation-logs/query
 */
export function getOperationLogList(params: {
  page?: number
  sort_by?: OperationLogSortField | string
  sort_order?: string
}): Promise<ApiResponse<OperationLogListResponse>> {
  return get<OperationLogListResponse>('/api/v1/tenant-operation-logs/query', params as unknown as Record<string, unknown>)
}

/**
 * 接口 38：查询操作日志详情
 * GET /api/v1/tenant-operation-logs/detail
 */
export function getOperationLogDetail(logId: string): Promise<ApiResponse<OperationLogDetailResponse>> {
  return get<OperationLogDetailResponse>('/api/v1/tenant-operation-logs/detail', { log_id: logId })
}

/**
 * 接口 39：搜索操作日志
 * GET /api/v1/tenant-operation-logs/search
 * 注意：该接口不支持 time 时间范围搜索
 * @param searchFields 搜索字段数组（来自 OPERATION_LOG_SEARCH_FIELDS）
 * @param searchValues 搜索内容字典，与 searchFields 一一对应
 */
export function searchOperationLogs(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: OperationLogSortField | string
  sort_order?: string
}): Promise<ApiResponse<OperationLogListResponse>> {
  return get<OperationLogListResponse>('/api/v1/tenant-operation-logs/search', params as unknown as Record<string, unknown>)
}

/**
 * 接口 40：查询当日在线员工
 * GET /api/v1/tenant-users/online/today/query
 */
export function getTodayOnlineUsers(params: {
  page?: number
  sort_by?: OnlineUserSortField | string
  sort_order?: string
}): Promise<ApiResponse<OnlineUserListResponse>> {
  return get<OnlineUserListResponse>('/api/v1/tenant-users/online/today/query', params as unknown as Record<string, unknown>)
}

/**
 * 接口 41：按姓名查询当日在线员工
 * GET /api/v1/tenant-users/online/today/by-name
 */
export function getTodayOnlineUsersByName(params: {
  user_name: string
  page?: number
}): Promise<ApiResponse<OnlineUserListResponse>> {
  return get<OnlineUserListResponse>('/api/v1/tenant-users/online/today/by-name', params as unknown as Record<string, unknown>)
}
