/**
 * 模块：配送管理-车辆管理（租客接口 tenant/vehicle）
 * 源接口：app/api/v1/endpoints/tenant_vehicle_management.py
 * 功能：车辆创建、修改、查询列表、查询详情、删除
 * 说明：写操作均为 multipart/form-data（FormData），支持图片/附件上传
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface VehicleItem {
  vehicle_id: string
  license_plate: string
  vehicle_name: string
  status: string
  remark: string | null
  created_at?: string
  updated_at?: string
}

export interface VehicleDetailItem extends VehicleItem {
  images: { file_id: string; file_name: string; file_url: string }[]
  attachments: { file_id: string; file_name: string; file_url: string }[]
}

export interface VehicleListResponse {
  total: number
  page: number
  page_size: number
  vehicles: VehicleItem[]
}

export interface VehicleCreatePayload {
  license_plate: string
  vehicle_name: string
  remark?: string
}

export interface VehicleUpdatePayload {
  vehicle_id: string
  license_plate?: string
  vehicle_name?: string
  remark?: string
}

/** 查询车辆列表 */
export function getVehicleList(params: {
  page?: number
  page_size?: number
  keyword?: string
  status?: string
}): Promise<ApiResponse<VehicleListResponse>> {
  return get<VehicleListResponse>('/api/v1/tenant/vehicle/list', params as unknown as Record<string, unknown>)
}

/** 查询车辆详情 */
export function getVehicleDetail(vehicleId: string): Promise<ApiResponse<VehicleDetailItem>> {
  return get<VehicleDetailItem>('/api/v1/tenant/vehicle/detail', { vehicle_id: vehicleId })
}

/** 创建车辆 */
export function createVehicle(data: VehicleCreatePayload, files?: { images?: File[]; attachments?: File[] }): Promise<ApiResponse<VehicleItem>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<VehicleItem>('/api/v1/tenant/vehicle/create', fd)
}

/** 修改车辆 */
export function updateVehicle(data: VehicleUpdatePayload, files?: { images?: File[]; attachments?: File[] }): Promise<ApiResponse<VehicleItem>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<VehicleItem>('/api/v1/tenant/vehicle/update', fd)
}

/** 删除车辆 */
export function deleteVehicle(vehicleId: string): Promise<ApiResponse<{ vehicle_id: string }>> {
  const fd = toMultipart({ vehicle_id: vehicleId })
  return post<{ vehicle_id: string }>('/api/v1/tenant/vehicle/delete', fd)
}
