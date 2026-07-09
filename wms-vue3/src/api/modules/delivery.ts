/**
 * 模块：配送管理-配送任务（租客接口 tenant-delivery-tasks）
 * 源接口：app/api/v1/endpoints/tenant_delivery_management.py + tenant_navigation.py
 * 功能：配送任务列表、详情、创建、取消、导航路线规划
 * 说明：写操作均为 application/x-www-form-urlencoded 或 multipart/form-data
 */
import { get, post, toFormData, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface DeliveryTaskItem {
  delivery_task_id: string
  delivery_task_no: string
  vehicle_id: string | null
  vehicle_name: string | null
  license_plate: string | null
  driver_id: string | null
  driver_name: string | null
  driver_phone: string | null
  plan_departure_time: string | null
  actual_departure_time: string | null
  actual_return_time: string | null
  origin_address: string | null
  origin_lng: string | null
  origin_lat: string | null
  status: string
  remark: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface DeliveryTaskListResponse {
  total: number
  page: number
  page_size: number
  tasks: DeliveryTaskItem[]
}

export interface DeliveryTaskDetailResponse {
  task: DeliveryTaskItem
  load_details: DeliveryLoadDetailItem[]
}

export interface DeliveryLoadDetailItem {
  delivery_load_detail_id: string
  barcode_code: string
  logistics_no: string | null
  sales_order_no: string | null
  product_name: string | null
  specification: string | null
  customer_name: string | null
  customer_phone: string | null
  delivery_address: string | null
  detail_address: string | null
  dest_lng: string | null
  dest_lat: string | null
  delivery_quantity: number
  status: string
}

export interface DeliveryTaskCreatePayload {
  vehicle_id: string
  origin_address?: string
  driver_id?: string
  plan_departure_time?: string
  remark?: string
  scan_detail_ids?: string
}

export interface DrivingRouteResponse {
  origin: { address: string | null; lng: string | null; lat: string | null }
  distance: string | null
  duration: string | null
  taxi_cost: string | null
  stop_sequence: {
    delivery_load_detail_id: string
    customer_name: string | null
    delivery_address: string | null
    dest_lng: string | null
    dest_lat: string | null
  }[]
  not_in_route: {
    delivery_load_detail_id: string
    customer_name: string | null
    delivery_address: string | null
    reason: string
  }[]
  static_map_url: string | null
  paths: unknown[]
}

/** 查询配送任务列表 */
export function getDeliveryTaskList(params: {
  page?: number
  page_size?: number
  keyword?: string
  status?: string
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<DeliveryTaskListResponse>> {
  return get<DeliveryTaskListResponse>('/api/v1/tenant-delivery-tasks/list', params as unknown as Record<string, unknown>)
}

/** 查询配送任务详情 */
export function getDeliveryTaskDetail(deliveryTaskId: string): Promise<ApiResponse<DeliveryTaskDetailResponse>> {
  return get<DeliveryTaskDetailResponse>('/api/v1/tenant-delivery-tasks/detail', { delivery_task_id: deliveryTaskId })
}

/** 创建配送任务 */
export function createDeliveryTask(data: DeliveryTaskCreatePayload): Promise<ApiResponse<DeliveryTaskItem>> {
  return post<DeliveryTaskItem>('/api/v1/tenant-delivery-tasks/create', toMultipart(data as unknown as Record<string, unknown>))
}

/** 取消配送任务 */
export function cancelDeliveryTask(deliveryTaskId: string): Promise<ApiResponse<{ delivery_task_id: string }>> {
  return post<{ delivery_task_id: string }>('/api/v1/tenant-delivery-tasks/cancel', toFormData({ delivery_task_id: deliveryTaskId }))
}

/** 驾车路径规划 */
export function getDrivingRoute(deliveryTaskId: string): Promise<ApiResponse<DrivingRouteResponse>> {
  return post<DrivingRouteResponse>('/api/v1/tenant/navigation/driving-route', toMultipart({ delivery_task_id: deliveryTaskId }))
}
