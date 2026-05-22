/**
 * 模块：余额查询
 * 表名：客户余额/账户余额表
 * 功能：4种余额查询（客户余额、账户余额、预存款余额、信用余额）、导出
 */
import { get, post } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface GiftAmountRecord {
  id?: string
  orderNo?: string
  customerName: string
  giftAmount: number
  remark?: string
  createTime?: string
}

export interface CustomerBalanceItem {
  id: string
  customerId: string
  customerName: string
  customerCode: string
  salesUserName?: string
  trackingUserName?: string
  balanceType: string
  totalAmount: number
  frozenAmount: number
  availableAmount: number
  usedAmount: number
  currency: string
  createTime: string
  updateTime: string
}

export interface BalanceQueryParams {
  page: number
  pageSize: number
  customerId?: string
  customerName?: string
  customerCode?: string
  balanceType?: string
}

export interface BalanceListResponse {
  list: CustomerBalanceItem[]
  total: number
  page: number
  pageSize: number
}

export function getCustomerBalanceList(params: BalanceQueryParams): Promise<ApiResponse<BalanceListResponse>> {
  return get<BalanceListResponse>('/balance/customer/list', params as unknown as Record<string, unknown>)
}

export function getAccountBalanceList(params: BalanceQueryParams): Promise<ApiResponse<BalanceListResponse>> {
  return get<BalanceListResponse>('/balance/account/list', params as unknown as Record<string, unknown>)
}

export function getPrepaidBalanceList(params: BalanceQueryParams): Promise<ApiResponse<BalanceListResponse>> {
  return get<BalanceListResponse>('/balance/prepaid/list', params as unknown as Record<string, unknown>)
}

export function getCreditBalanceList(params: BalanceQueryParams): Promise<ApiResponse<BalanceListResponse>> {
  return get<BalanceListResponse>('/balance/credit/list', params as unknown as Record<string, unknown>)
}

export function exportBalance(params: BalanceQueryParams, type: string): Promise<ApiResponse<Blob>> {
  return get<Blob>(`/balance/${type}/export`, params as unknown as Record<string, unknown>)
}

export function getBalanceDetail(id: string, type: string): Promise<ApiResponse<CustomerBalanceItem>> {
  return get<CustomerBalanceItem>(`/balance/${type}/${id}`)
}

export function createGiftAmount(data: GiftAmountRecord): Promise<ApiResponse<GiftAmountRecord>> {
  return post<GiftAmountRecord>('/balance/gift/create', data)
}
