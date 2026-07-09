/**
 * 模块：配送管理-配送任务（租客接口 tenant-delivery-tasks）
 * 源接口：app/api/v1/endpoints/tenant_delivery_management.py + tenant_navigation.py
 * 功能：配送任务列表、详情、创建、取消、导航路线规划
 * 说明：写操作均为 application/x-www-form-urlencoded 或 multipart/form-data
 */
import { get, post, toFormData, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface DeliveryTaskItem {
  deliveryTaskId: string
  deliveryTaskNo: string
  vehicleId: string | null
  vehicleName: string | null
  licensePlate: string | null
  driverId: string | null
  driverName: string | null
  driverPhone: string | null
  planDepartureTime: string | null
  actualDepartureTime: string | null
  actualReturnTime: string | null
  status: string
  originAddress: string | null
  originLng: string | null
  originLat: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
  customerCount: number
  deliveryQuantity: number
}

export interface DeliveryTaskListResponse {
  total: number
  page: number
  page_size: number
  items: DeliveryTaskItem[]
}

export interface DeliveryTaskDetailResponse {
  task: DeliveryTaskItem
  loadDetails: DeliveryLoadDetailItem[]
  routeCache: DrivingRouteResponse | null
}

export interface DeliveryLoadDetailItem {
  deliveryLoadDetailId: string
  deliveryTaskId: string
  barcodeCode: string
  logisticsNo: string | null
  salesOrderNo: string | null
  productName: string | null
  specification: string | null
  customerName: string | null
  customerPhone: string | null
  deliveryAddress: string | null
  detailAddress: string | null
  deliveryQuantity: number
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
  navigation_uris: { from_name: string; to_name: string; uri: string }[]
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
  return post<DrivingRouteResponse>('/api/v1/tenant/navigation/driving-route', toFormData({ delivery_task_id: deliveryTaskId }))
}
