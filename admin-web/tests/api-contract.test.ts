import { beforeEach, describe, expect, it, vi } from 'vitest'

const { postForm, getData } = vi.hoisted(() => ({
  postForm: vi.fn(),
  getData: vi.fn(),
}))

vi.mock('@/api/http', () => ({ postForm, getData }))

import { adminLogin } from '@/api/auth'
import { createTenant, createTenantSubscription } from '@/api/platformTenants'
import {
  createApiResource,
  createButton,
  createMenu,
  createPermission,
  createRole,
} from '@/api/platformAccessResources'
import { createOrganization, createPost, createUser } from '@/api/platformTenantResources'
import { queryOperationLogs, searchOperationLogs } from '@/api/operationLogs'
import {
  createEnumMapping,
  deleteEnumMapping,
  getEnumMappingDetail,
  listEnumMappings,
  updateEnumMapping,
} from '@/api/enumMappings'
import {
  queryPlatformApis,
  queryPlatformButtons,
  queryPlatformMenus,
  queryPlatformPermissions,
  queryPlatformTenants,
  queryTenantEnumMappings,
  queryTenantOrganizations,
  queryTenantPosts,
  queryTenantRoles,
} from '@/api/platformQueries'
import {
  queryPlatformTenantEmployees,
  queryPlatformTenantOrganizations,
  queryPlatformTenantPosts,
  queryPlatformTenantRoles,
  queryPlatformTenantWarehouses,
  queryTenantOverview,
} from '@/api/platformTenantOverview'

describe('admin-web API contract', () => {
  beforeEach(() => {
    postForm.mockReset()
    getData.mockReset()
  })

  it('uses the documented login endpoint', () => {
    adminLogin('admin', 'secret')
    expect(postForm).toHaveBeenCalledWith('/auth/admin/login', { account: 'admin', password: 'secret' })
  })

  it('uses the tenant onboarding endpoints', () => {
    const tenant = { tenant_name: 'A', contact_name: 'B', contact_phone: '13800000000' }
    const subscription = {
      tenant_id: 'tenant_1', start_at: '2026-01-01', end_at: '2026-12-31',
      max_user_count: 10, max_warehouse_count: 2, storage_quota_gb: 5,
    }
    createTenant(tenant)
    createTenantSubscription(subscription)
    expect(postForm).toHaveBeenNthCalledWith(1, '/platform-tenants', tenant)
    expect(postForm).toHaveBeenNthCalledWith(2, '/platform-tenant-subscriptions', subscription)
  })

  it('uses the access-resource creation endpoints', () => {
    const menu = { menu_name: '租客', menu_status: 1 }
    const button = { button_name: '新增', button_status: 1, menu_id: 'menu_1' }
    const api = { api_name: '新增租客', api_path: '/tenants', http_method: 'POST', button_id: 'button_1', api_status: 1 }
    const permission = { perm_name: '新增租客', perm_type: 'API', function_id: 'api_1', sort_no: 1 }
    const role = { tenant_id: 'all', role_name: '管理员', role_type: 'ADMIN', sort_no: 1 }
    createMenu(menu)
    createButton(button)
    createApiResource(api)
    createPermission(permission)
    createRole(role)
    expect(postForm).toHaveBeenNthCalledWith(1, '/platform-menus', menu)
    expect(postForm).toHaveBeenNthCalledWith(2, '/platform-buttons', button)
    expect(postForm).toHaveBeenNthCalledWith(3, '/platform-apis', api)
    expect(postForm).toHaveBeenNthCalledWith(4, '/platform-permissions', permission)
    expect(postForm).toHaveBeenNthCalledWith(5, '/platform-roles', role)
  })

  it('uses the tenant-resource creation endpoints', () => {
    const organization = { tenant_id: 'tenant_1', org_name: '仓储部', sort_no: 1, org_type: 'DEPARTMENT' }
    const post = { tenant_id: 'tenant_1', post_name: '主管', sort_no: 1 }
    const user = {
      tenant_id: 'tenant_1', org_id: 'org_1', user_name: '张三', password: '123456',
      sort_no: 1, role_id: 'role_1',
    }
    createOrganization(organization)
    createPost(post)
    createUser(user)
    expect(postForm).toHaveBeenNthCalledWith(1, '/platform-organizations', organization)
    expect(postForm).toHaveBeenNthCalledWith(2, '/platform-posts', post)
    expect(postForm).toHaveBeenNthCalledWith(3, '/platform-users', user)
  })

  it('uses both operation-log query endpoints', () => {
    const query = { tenant_id: 'tenant_1', sort_by: 'created_at', sort_order: 'desc', page: 1 }
    const search = { ...query, search_field: 'action', search_value: 'create' }
    queryOperationLogs(query)
    searchOperationLogs(search)
    expect(getData).toHaveBeenNthCalledWith(1, '/operation-logs/query', query)
    expect(getData).toHaveBeenNthCalledWith(2, '/operation-logs/search', search)
  })

  it('uses all enum-mapping CRUD endpoints', () => {
    const list = { mapping_group: 'ORDER_STATUS', status: 1, company_id: 'tenant_1', page: 1 }
    const create = {
      mapping_group: 'ORDER_STATUS', input_value: 'new', standard_value: 'NEW',
      display_label: '新建', is_canonical: 1, sort_no: 1, company_id: 'tenant_1',
    }
    const update = { mapping_id: 'mapping_1', display_label: '待处理', status: 1 }
    listEnumMappings(list)
    getEnumMappingDetail('mapping_1')
    createEnumMapping(create)
    updateEnumMapping(update)
    deleteEnumMapping('mapping_1')
    expect(getData).toHaveBeenNthCalledWith(1, '/enum-mappings/list', list)
    expect(getData).toHaveBeenNthCalledWith(2, '/enum-mappings/detail', { mapping_id: 'mapping_1' })
    expect(postForm).toHaveBeenNthCalledWith(1, '/enum-mappings/create', create)
    expect(postForm).toHaveBeenNthCalledWith(2, '/enum-mappings/update', update)
    expect(postForm).toHaveBeenNthCalledWith(3, '/enum-mappings/delete', { mapping_id: 'mapping_1' })
  })

  it('uses platform and reused tenant query endpoints for dropdown options', () => {
    queryPlatformTenants()
    queryPlatformMenus()
    queryPlatformButtons({ menu_id: 'menu_1' })
    queryPlatformApis({ button_id: 'button_1' })
    queryPlatformPermissions({ perm_type: 'API' })
    queryTenantRoles('tenant_1')
    queryTenantOrganizations('tenant_1')
    queryTenantPosts('tenant_1')
    queryTenantEnumMappings('tenant_1', 'ORG_TYPE_MAPPING')

    expect(getData).toHaveBeenNthCalledWith(1, '/platform-tenants/query', { page: 1, page_size: 100 })
    expect(getData).toHaveBeenNthCalledWith(2, '/platform-menus/query', { page: 1, page_size: 100 })
    expect(getData).toHaveBeenNthCalledWith(3, '/platform-buttons/query', { page: 1, page_size: 100, menu_id: 'menu_1' })
    expect(getData).toHaveBeenNthCalledWith(4, '/platform-apis/query', { page: 1, page_size: 100, button_id: 'button_1' })
    expect(getData).toHaveBeenNthCalledWith(5, '/platform-permissions/query', { page: 1, page_size: 100, perm_type: 'API' })
    expect(getData).toHaveBeenNthCalledWith(6, '/tenant-roles/query', { tenant_id: 'tenant_1', page: 1, page_size: 100, sort_by: 'sort_no', sort_order: 'ASC' })
    expect(getData).toHaveBeenNthCalledWith(7, '/tenant-orgs/query', { tenant_id: 'tenant_1', page: 1, page_size: 100, sort_by: 'sort_no', sort_order: 'ASC' })
    expect(getData).toHaveBeenNthCalledWith(8, '/tenant-posts/query', { tenant_id: 'tenant_1', page: 1, page_size: 100, sort_by: 'sort_no', sort_order: 'ASC' })
    expect(getData).toHaveBeenNthCalledWith(9, '/tenant-enum-mappings', { tenant_id: 'tenant_1', mapping_group: 'ORG_TYPE_MAPPING' })
  })

  it('uses the planned SYSTEM administrator tenant panorama endpoints', () => {
    const overview = {
      keyword: '测试',
      tenant_status: 1,
      subscription_state: 'ACTIVE' as const,
      page: 1,
      page_size: 20,
      sort_by: 'created_at' as const,
      sort_order: 'DESC' as const,
    }
    const related = { tenant_id: 'tenant_1', page: 1, page_size: 20, sort_order: 'ASC' as const }

    queryTenantOverview(overview)
    queryPlatformTenantEmployees(related)
    queryPlatformTenantOrganizations(related)
    queryPlatformTenantPosts(related)
    queryPlatformTenantRoles(related)
    queryPlatformTenantWarehouses(related)

    expect(getData).toHaveBeenNthCalledWith(1, '/platform-tenants/overview/query', overview)
    expect(getData).toHaveBeenNthCalledWith(2, '/platform-tenant-users/query', related)
    expect(getData).toHaveBeenNthCalledWith(3, '/platform-tenant-organizations/query', related)
    expect(getData).toHaveBeenNthCalledWith(4, '/platform-tenant-posts/query', related)
    expect(getData).toHaveBeenNthCalledWith(5, '/platform-tenant-role-permissions/query', related)
    expect(getData).toHaveBeenNthCalledWith(6, '/platform-tenant-warehouses/query', related)
  })
})
