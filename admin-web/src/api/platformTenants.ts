import { postForm } from './http'
import type { SubscriptionInfo, TenantInfo } from '@/types/platform'

export interface CreateTenantPayload {
  tenant_name: string
  contact_name: string
  contact_phone: string
  contact_email?: string
  /**
   * 创建时随开天心ERP数据同步总开关（可选，默认 false 不开启）。
   * 仅天心贸易形态租户生效；租户创建时无形态选项（形态由贸易形态 Tab 后续切换），
   * 故此处仅作「同步随开」占位，非天心形态后端忽略并置关。
   */
  enable_erp_sync?: boolean
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
