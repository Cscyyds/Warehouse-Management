export type TenantMode = 'LOCAL' | 'TIANXIN'

export interface TenantModeSnapshot {
  tenant_mode: TenantMode
  tenant_mode_revision: number
  available_modules: string[]
}

/** Missing/unassigned modes must never become LOCAL by default. */
export function readTenantMode(profile: unknown): TenantModeSnapshot {
  const data = profile as Partial<TenantModeSnapshot> | null
  if (!data || (data.tenant_mode !== 'LOCAL' && data.tenant_mode !== 'TIANXIN')
    || !Number.isSafeInteger(data.tenant_mode_revision) || data.tenant_mode_revision! < 0
    || !Array.isArray(data.available_modules) || !data.available_modules.every(item => typeof item === 'string')) {
    throw new Error('租户模式尚未确定，请刷新或联系平台管理员完成迁移')
  }
  return data as TenantModeSnapshot
}
