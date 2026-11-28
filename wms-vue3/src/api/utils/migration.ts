/** change_message 是结构化迁移列表，不能用迁移原因或仅目标 ID 替代。 */
export function migrationForm(fields: Record<string, string>, changes: readonly unknown[]): URLSearchParams {
  const form = new URLSearchParams(fields)
  form.set('change_message', JSON.stringify(changes))
  return form
}

export interface MigrationResult<T> {
  migrated_count: number
  details: T[]
}

export interface CustomerMigrationResult<T> extends MigrationResult<T> {
  customer_migrated_count: number
}

export interface LeadCustomerMigrationResult<T> extends CustomerMigrationResult<T> {
  lead_migrated_count: number
}

export type MigratedCustomerEntity =
  | { type: 'lead'; lead_id: string; lead_name: string }
  | { type: 'customer'; customer_id: string; customer_name: string }
