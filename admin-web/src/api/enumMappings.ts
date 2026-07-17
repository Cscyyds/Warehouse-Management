import { getData, postForm } from './http'
import type { EnumMapping } from '@/types/platform'

export interface EnumMappingListResult { total: number; items: EnumMapping[] }
export interface EnumMappingListParams { mapping_group?: string; status?: number; company_id?: string; page: number; page_size?: number }
export interface CreateEnumMappingPayload { mapping_group: string; input_value: string; standard_value: string; display_label: string; is_canonical: number; sort_no: number; company_id: string; remark?: string }
export interface UpdateEnumMappingPayload { mapping_id: string; display_label?: string; is_canonical?: number; sort_no?: number; status?: number; company_id?: string; remark?: string }

export const listEnumMappings = (params: EnumMappingListParams) => getData<EnumMappingListResult>('/enum-mappings/list', params)
export const getEnumMappingDetail = (mapping_id: string) => getData<EnumMapping>('/enum-mappings/detail', { mapping_id })
export const createEnumMapping = (payload: CreateEnumMappingPayload) => postForm<EnumMapping>('/enum-mappings/create', payload)
export const updateEnumMapping = (payload: UpdateEnumMappingPayload) => postForm<EnumMapping>('/enum-mappings/update', payload)
export const deleteEnumMapping = (mapping_id: string) => postForm<unknown>('/enum-mappings/delete', { mapping_id })
