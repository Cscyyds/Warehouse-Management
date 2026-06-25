/**
 * 模块：拜访任务单（tenant-visit-tasks）
 * 源接口：app/api/v1/endpoints/tenant_crm_management.py
 * 功能：拜访任务新建、查询（员工/管理员）、详情、完成、图片删除、搜索、审核、删除
 * 说明：写操作均为 multipart/form-data，支持图片上传（最多 5 张）
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 拜访任务项（list/detail 返回） */
export interface VisitTaskItem {
  visit_task_id: string
  task_no?: string
  task_type: string
  task_type_name?: string
  customer_id: string
  customer_name?: string
  contact_name: string
  contact_phone: string
  visit_address: string
  salesman_user_id: string
  salesman_user_name?: string
  visit_time?: string
  visit_plan: string
  visit_result?: string
  next_visit_plan?: string
  sign_in_time?: string
  sign_out_time?: string
  sign_in_address?: string
  sign_out_address?: string
  complete_time?: string
  audit_status: number
  audit_status_name?: string
  audit_remark?: string
  audit_content?: string
  status: number
  remark?: string
  image_urls: string[]
  created_by?: string
  created_by_name?: string
  created_at?: string
  updated_at?: string
}

/** 拜访任务列表响应 */
export interface VisitTaskListResponse {
  total: number
  visit_task: VisitTaskItem[]
}

/** 拜访任务详情响应 */
export interface VisitTaskDetailResponse {
  total: number
  visit_task: VisitTaskItem
}

/** 创建拜访任务入参 */
export interface VisitTaskCreatePayload {
  task_type: string
  customer_id: string
  contact_name: string
  contact_phone: string
  visit_address: string
  salesman_user_id: string
  visit_plan: string
  status: number
  visit_time?: string
  remark?: string
  images?: File[]
}

/** 修改拜访任务入参 */
export interface VisitTaskUpdatePayload {
  visit_task_id: string
  task_type: string
  customer_id: string
  contact_name: string
  contact_phone: string
  visit_address: string
  salesman_user_id: string
  visit_plan: string
  status: number
  visit_time?: string
  remark?: string
  images?: File[]
}

/** 员工完成拜访任务入参 */
export interface VisitTaskCompletePayload {
  visit_task_id: string
  sign_in_time: string
  sign_out_time: string
  sign_in_address: string
  sign_out_address: string
  visit_result: string
  next_visit_plan?: string
  images?: File[]
}

/** 审核拜访任务入参 */
export interface VisitTaskAuditPayload {
  visit_task_id: string
  audit_status: number
  audit_remark?: string
}

/** 删除任务图片结果 */
export interface VisitTaskImageDeleteResult {
  deleted_image_urls: string[]
  remaining_image_urls: string[]
}

/* ===================== 员工端（my）接口 ===================== */

/** 新建拜访任务单 */
export function createVisitTask(data: VisitTaskCreatePayload): Promise<ApiResponse<VisitTaskItem>> {
  return post<VisitTaskItem>(
    '/api/v1/tenant-visit-tasks',
    toMultipart(data as unknown as Record<string, unknown>)
  )
}

/** 查询我的拜访任务列表（仅 salesman_user_id=当前用户 且 status=1） */
export function getMyVisitTaskList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<VisitTaskListResponse>> {
  return get<VisitTaskListResponse>(
    '/api/v1/tenant-visit-tasks/my',
    params as unknown as Record<string, unknown>
  )
}

/** 获取我的指定任务详情（非任务负责人返回 403） */
export function getMyVisitTaskDetail(visitTaskId: string): Promise<ApiResponse<VisitTaskDetailResponse>> {
  return get<VisitTaskDetailResponse>(
    '/api/v1/tenant-visit-tasks/my/detail',
    { visit_task_id: visitTaskId }
  )
}

/** 员工完成拜访任务（提交后 audit_status 变为 2 待审核） */
export function completeMyVisitTask(data: VisitTaskCompletePayload): Promise<ApiResponse<VisitTaskItem>> {
  return post<VisitTaskItem>(
    '/api/v1/tenant-visit-tasks/my/complete',
    toMultipart(data as unknown as Record<string, unknown>)
  )
}

/** 员工删除自身任务图片 */
export function deleteMyVisitTaskImages(params: {
  visit_task_id: string
  image_urls: string
}): Promise<ApiResponse<VisitTaskImageDeleteResult>> {
  return post<VisitTaskImageDeleteResult>(
    '/api/v1/tenant-visit-tasks/my/images/delete',
    toMultipart(params as unknown as Record<string, unknown>)
  )
}

/** 搜索我的拜访任务 */
export function searchMyVisitTasks(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<VisitTaskListResponse>> {
  return get<VisitTaskListResponse>(
    '/api/v1/tenant-visit-tasks/my/search',
    params as unknown as Record<string, unknown>
  )
}

/* ===================== 管理员端接口 ===================== */

/** 查询所有拜访任务列表 */
export function getVisitTaskList(params: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<VisitTaskListResponse>> {
  return get<VisitTaskListResponse>(
    '/api/v1/tenant-visit-tasks',
    params as unknown as Record<string, unknown>
  )
}

/** 获取指定任务详情（管理员） */
export function getVisitTaskDetail(visitTaskId: string): Promise<ApiResponse<VisitTaskDetailResponse>> {
  return get<VisitTaskDetailResponse>(
    '/api/v1/tenant-visit-tasks/detail',
    { visit_task_id: visitTaskId }
  )
}

/** 更新拜访任务（管理员） */
export function updateVisitTask(data: VisitTaskUpdatePayload): Promise<ApiResponse<VisitTaskItem>> {
  return post<VisitTaskItem>(
    '/api/v1/tenant-visit-tasks/update',
    toMultipart(data as unknown as Record<string, unknown>)
  )
}

/** 管理员删除任务图片 */
export function deleteVisitTaskImages(params: {
  visit_task_id: string
  image_urls: string
}): Promise<ApiResponse<VisitTaskImageDeleteResult>> {
  return post<VisitTaskImageDeleteResult>(
    '/api/v1/tenant-visit-tasks/images/delete',
    toMultipart(params as unknown as Record<string, unknown>)
  )
}

/** 审核拜访任务（仅 audit_status=2 可审核；audit_status: 1=通过, 3=驳回） */
export function auditVisitTask(data: VisitTaskAuditPayload): Promise<ApiResponse<VisitTaskItem>> {
  return post<VisitTaskItem>(
    '/api/v1/tenant-visit-tasks/audit',
    toMultipart(data as unknown as Record<string, unknown>)
  )
}

/** 删除拜访任务（软删除，status 置 0） */
export function deleteVisitTask(visitTaskId: string): Promise<ApiResponse<{ visit_task_id: string }>> {
  return post<{ visit_task_id: string }>(
    '/api/v1/tenant-visit-tasks/delete',
    toMultipart({ visit_task_id: visitTaskId })
  )
}

/** 搜索所有拜访任务 */
export function searchVisitTasks(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<VisitTaskListResponse>> {
  return get<VisitTaskListResponse>(
    '/api/v1/tenant-visit-tasks/search',
    params as unknown as Record<string, unknown>
  )
}
