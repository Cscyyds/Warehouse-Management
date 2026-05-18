/**
 * 模块：打印机管理
 * 表名：打印机配置表
 * 功能：打印机CRUD、测试连接
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface PrinterItem {
  id: string
  name: string
  code: string
  type: string
  brand: string
  model: string
  ipAddress: string
  port: number
  paperSize: string
  status: string
  isDefault: boolean
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface PrinterQueryParams {
  page: number
  pageSize: number
  name?: string
  code?: string
  type?: string
  status?: string
}

export interface PrinterListResponse {
  list: PrinterItem[]
  total: number
  page: number
  pageSize: number
}

export function getPrinterList(params: PrinterQueryParams): Promise<ApiResponse<PrinterListResponse>> {
  return get<PrinterListResponse>('/printer/list', params as unknown as Record<string, unknown>)
}

export function getPrinterDetail(id: string): Promise<ApiResponse<PrinterItem>> {
  return get<PrinterItem>(`/printer/${id}`)
}

export function createPrinter(data: Partial<PrinterItem>): Promise<ApiResponse<PrinterItem>> {
  return post<PrinterItem>('/printer', data)
}

export function updatePrinter(id: string, data: Partial<PrinterItem>): Promise<ApiResponse<PrinterItem>> {
  return put<PrinterItem>(`/printer/${id}`, data)
}

export function deletePrinter(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/printer/${id}`)
}

export function testPrinterConnection(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
  return get<{ success: boolean; message: string }>(`/printer/${id}/test`)
}

export function setDefaultPrinter(id: string): Promise<ApiResponse<null>> {
  return post<null>(`/printer/${id}/set-default`)
}
