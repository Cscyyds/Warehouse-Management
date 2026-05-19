import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface DictItem {
  id: string
  name: string
  type: string
  isSystem: boolean
  status: string
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface DictQueryParams {
  page: number
  pageSize: number
  name?: string
  type?: string
  status?: string
}

export interface DictListResponse {
  list: DictItem[]
  total: number
  page: number
  pageSize: number
}

export function getDictList(params: DictQueryParams): Promise<ApiResponse<DictListResponse>> {
  return get<DictListResponse>('/system/dict/list', params as unknown as Record<string, unknown>)
}

export function getDictDetail(id: string): Promise<ApiResponse<DictItem>> {
  return get<DictItem>(`/system/dict/${id}`)
}

export function createDict(data: Partial<DictItem>): Promise<ApiResponse<DictItem>> {
  return post<DictItem>('/system/dict', data)
}

export function updateDict(id: string, data: Partial<DictItem>): Promise<ApiResponse<DictItem>> {
  return put<DictItem>(`/system/dict/${id}`, data)
}

export function updateDictStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/system/dict/${id}/status`, { status })
}

export function deleteDict(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/system/dict/${id}`)
}

export interface DictDataItem {
  id: string
  dictId: string
  dictType: string
  label: string
  value: string
  sort: number
  isSystem: boolean
  status: string
  remark: string
  createTime: string
  updateTime: string
  createUserId: string
  createUserName: string
}

export interface DictDataQueryParams {
  page: number
  pageSize: number
  dictId?: string
  dictType?: string
  label?: string
  status?: string
}

export interface DictDataListResponse {
  list: DictDataItem[]
  total: number
  page: number
  pageSize: number
}

export function getDictDataList(params: DictDataQueryParams): Promise<ApiResponse<DictDataListResponse>> {
  return get<DictDataListResponse>('/system/dict-data/list', params as unknown as Record<string, unknown>)
}

export function createDictData(data: Partial<DictDataItem>): Promise<ApiResponse<DictDataItem>> {
  return post<DictDataItem>('/system/dict-data', data)
}

export function updateDictData(id: string, data: Partial<DictDataItem>): Promise<ApiResponse<DictDataItem>> {
  return put<DictDataItem>(`/system/dict-data/${id}`, data)
}

export function deleteDictData(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/system/dict-data/${id}`)
}
