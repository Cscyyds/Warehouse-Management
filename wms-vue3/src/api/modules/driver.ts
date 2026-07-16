/**
 * 模块：配送管理-司机档案（租客接口 tenant-drivers）
 * 源接口：app/api/v1/endpoints/tenant_delivery_management.py
 * 功能：司机档案 CRUD、搜索、下拉选项
 * 说明：写操作均为 multipart/form-data
 */
import { get, post, toMultipart, toFormData } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 司机档案项 */
export interface DriverItem {
  driver_id: string
  company_id: string
  driver_type: string
  user_id: string | null
  driver_name: string
  driver_phone: string
  driver_license_no: string | null
  license_expire_date: string | null
  status: string
  remark: string | null
  deleted_flag: number
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
}

/** 司机列表响应 */
export interface DriverListResponse {
  total: number
  page: number
  page_size: number
  driver: DriverItem[]
}

/** 司机下拉选项（轻量，用于承运绑定选择器） */
export interface DriverOptionItem {
  driver_id: string
  driver_type: string
  driver_name: string
  driver_phone: string
}

/** 创建司机档案入参 */
export interface DriverCreatePayload {
  driver_type: string
  user_id?: string
  driver_name?: string
  driver_phone?: string
  driver_license_no?: string
  license_expire_date?: string
  status?: string
  remark?: string
}

/** 修改司机档案入参 */
export interface DriverUpdatePayload {
  driver_id: string
  user_id?: string
  driver_name?: string
  driver_phone?: string
  driver_license_no?: string
  license_expire_date?: string
  status?: string
  remark?: string
}

/** 查询司机档案列表 */
export function getDriverList(params: {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<DriverListResponse>> {
  return get<DriverListResponse>('/api/v1/tenant-drivers/query', params as unknown as Record<string, unknown>)
}

/** 搜索司机档案 */
export function searchDrivers(params: {
  page?: number
  page_size?: number
  keyword?: string
  driver_type?: string
  status?: string
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<DriverListResponse>> {
  return get<DriverListResponse>('/api/v1/tenant-drivers/search', params as unknown as Record<string, unknown>)
}

/** 司机下拉选项（承运绑定用） */
export function getDriverOptions(params: {
  keyword?: string
  driver_type?: string
  status?: string
  limit?: number
}): Promise<ApiResponse<{ options: DriverOptionItem[] }>> {
  return get<{ options: DriverOptionItem[] }>('/api/v1/tenant-drivers/options', params as unknown as Record<string, unknown>)
}

/** 查询司机档案详情 */
export function getDriverDetail(driverId: string): Promise<ApiResponse<DriverItem>> {
  return get<DriverItem>('/api/v1/tenant-drivers/detail', { driver_id: driverId })
}

/** 创建司机档案 */
export function createDriver(data: DriverCreatePayload): Promise<ApiResponse<DriverItem>> {
  return post<DriverItem>('/api/v1/tenant-drivers/create', toMultipart(data as unknown as Record<string, unknown>))
}

/** 修改司机档案 */
export function updateDriver(data: DriverUpdatePayload): Promise<ApiResponse<DriverItem>> {
  return post<DriverItem>('/api/v1/tenant-drivers/update', toMultipart(data as unknown as Record<string, unknown>))
}

/** 删除司机档案（逻辑删除；被有效物流记录或未完成任务引用时返回 409） */
export function deleteDriver(driverId: string): Promise<ApiResponse<{ driver_id: string }>> {
  return post<{ driver_id: string }>('/api/v1/tenant-drivers/delete', toFormData({ driver_id: driverId }))
}
