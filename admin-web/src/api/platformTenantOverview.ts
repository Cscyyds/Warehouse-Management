import { getData } from './http'
import type {
  TenantEmployeeRow,
  TenantOrganizationRow,
  TenantOverviewQueryData,
  TenantOverviewQueryParams,
  TenantPostRow,
  TenantRelatedQueryParams,
  TenantRolePermissionRow,
  TenantWarehouseRow,
} from '@/types/tenantOverview'

export interface TenantEmployeesQueryData { total: number; page: number; page_size: number; user: TenantEmployeeRow[] }
export interface TenantOrganizationsQueryData { total: number; page: number; page_size: number; org: TenantOrganizationRow[] }
export interface TenantPostsQueryData { total: number; page: number; page_size: number; post: TenantPostRow[] }
export interface TenantRolesQueryData { total: number; page: number; page_size: number; role: TenantRolePermissionRow[] }
export interface TenantWarehousesQueryData { total: number; page: number; page_size: number; warehouse: TenantWarehouseRow[] }

export const queryTenantOverview = (params: TenantOverviewQueryParams) =>
  getData<TenantOverviewQueryData>('/platform-tenants/overview/query', params)

export const queryPlatformTenantEmployees = (params: TenantRelatedQueryParams) =>
  getData<TenantEmployeesQueryData>('/platform-tenant-users/query', params)

export const queryPlatformTenantOrganizations = (params: TenantRelatedQueryParams) =>
  getData<TenantOrganizationsQueryData>('/platform-tenant-organizations/query', params)

export const queryPlatformTenantPosts = (params: TenantRelatedQueryParams) =>
  getData<TenantPostsQueryData>('/platform-tenant-posts/query', params)

export const queryPlatformTenantRoles = (params: TenantRelatedQueryParams) =>
  getData<TenantRolesQueryData>('/platform-tenant-role-permissions/query', params)

export const queryPlatformTenantWarehouses = (params: TenantRelatedQueryParams) =>
  getData<TenantWarehousesQueryData>('/platform-tenant-warehouses/query', params)
