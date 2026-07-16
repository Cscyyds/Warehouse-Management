import { postForm } from './http'
import type { SubscriptionInfo, TenantInfo } from '@/types/platform'

export interface CreateTenantPayload {
  tenant_name: string
  contact_name: string
  contact_phone: string
  contact_email?: string
}

export interface CreateSubscriptionPayload {
  tenant_id: string
  start_at: string
  end_at: string
  max_user_count: number
  max_warehouse_count: number
  storage_quota_gb: number
}

export const createTenant = (payload: CreateTenantPayload) => postForm<TenantInfo>('/platform-tenants', payload)
export const createTenantSubscription = (payload: CreateSubscriptionPayload) => postForm<SubscriptionInfo>('/platform-tenant-subscriptions', payload)
