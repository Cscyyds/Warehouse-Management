/**
 * 模块：系统管理-组织机构
 * 表名：组织及其附属组织表
 * 功能：组织机构增删改查、树形结构查询、状态管理
 */
import { get, post, put, del } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

export interface OrgItem {
  id: string
  code: string
  name: string
  fullName: string
  sort: number
  type: string
  parentId: string
  parentName?: string
  leader: string
  address: string
  email: string
  zipCode: string
  phone: string
  remark: string
  status: string
  createTime: string
  updateTime: string
}

export interface OrgNode {
  id: string
  code?: string
  name: string
  fullName?: string
  type?: string
  parentId?: string
  sort?: number
  status?: string
  children?: OrgNode[]
}

export interface OrgQueryParams {
  page: number
  pageSize: number
  code?: string
  name?: string
  type?: string
  status?: string
  parentId?: string
}

export interface OrgListResponse {
  list: OrgItem[]
  total: number
  page: number
  pageSize: number
}

export interface OrgTreeResponse {
  tree: OrgNode[]
}

export function getOrgTree(): Promise<ApiResponse<OrgTreeResponse>> {
  return get<OrgTreeResponse>('/organization/tree')
}

export function getOrgList(params: OrgQueryParams): Promise<ApiResponse<OrgListResponse>> {
  return get<OrgListResponse>('/organization/list', params as unknown as Record<string, unknown>)
}

export function getOrgDetail(id: string): Promise<ApiResponse<OrgItem>> {
  return get<OrgItem>(`/organization/${id}`)
}

export function createOrg(data: Partial<OrgItem>): Promise<ApiResponse<OrgItem>> {
  return post<OrgItem>('/organization', data)
}

export function updateOrg(id: string, data: Partial<OrgItem>): Promise<ApiResponse<OrgItem>> {
  return put<OrgItem>(`/organization/${id}`, data)
}

export function updateOrgStatus(id: string, status: string): Promise<ApiResponse<null>> {
  return put<null>(`/organization/${id}/status`, { status })
}

export function deleteOrg(id: string): Promise<ApiResponse<null>> {
  return del<null>(`/organization/${id}`)
}
