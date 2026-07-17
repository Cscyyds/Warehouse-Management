import { getData } from './http'
import type { OperationLog } from '@/types/platform'

export interface OperationLogResult { total: number; log: OperationLog[] }
export interface QueryLogParams { tenant_id?: string; admin_id?: string; sort_by?: string; sort_order?: string; page: number }
export interface SearchLogParams extends QueryLogParams { search_field: string; search_value: string }

export const queryOperationLogs = (params: QueryLogParams) => getData<OperationLogResult>('/operation-logs/query', params)
export const searchOperationLogs = (params: SearchLogParams) => getData<OperationLogResult>('/operation-logs/search', params)
