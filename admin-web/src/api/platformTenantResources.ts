import { postForm } from './http'
import type { OrganizationInfo, PostInfo, UserInfo } from '@/types/platform'

export interface CreateOrganizationPayload {
  tenant_id: string
  org_name: string
  org_full_name?: string
  sort_no: number
  org_type: string
  parent_id?: string
  leader_name?: string
  contact_address?: string
  email?: string
  post_code?: string
  remark?: string
}

export interface CreatePostPayload { tenant_id: string; post_name: string; post_category?: string; sort_no: number; remark?: string }
export interface CreateUserPayload { tenant_id: string; org_id: string; post_id?: string; user_name: string; password: string; mobile?: string; email?: string; sort_no: number; user_type?: string; role_id: string }

export const createOrganization = (payload: CreateOrganizationPayload) => postForm<OrganizationInfo>('/platform-organizations', payload)
export const createPost = (payload: CreatePostPayload) => postForm<PostInfo>('/platform-posts', payload)
export const createUser = (payload: CreateUserPayload) => postForm<UserInfo>('/platform-users', payload)
