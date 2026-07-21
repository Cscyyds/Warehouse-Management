<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { ApiError } from '@/api/http'
import {
  queryPlatformTenantEmployees,
  queryPlatformTenantOrganizations,
  queryPlatformTenantPosts,
  queryPlatformTenantRoles,
  queryPlatformTenantWarehouses,
  queryTenantOverview,
} from '@/api/platformTenantOverview'
import type {
  SubscriptionState,
  TenantEmployeeRow,
  TenantOrganizationRow,
  TenantOverviewRow,
  TenantPostRow,
  TenantRolePermissionRow,
  TenantWarehouseRow,
} from '@/types/tenantOverview'

type DetailTab = 'overview' | 'employees' | 'organizations' | 'posts' | 'roles' | 'warehouses'
interface DetailState<T> {
  rows: T[]
  total: number
  page: number
  loading: boolean
  loaded: boolean
  error: string
}

const pageSize = 20
const detailPageSize = 20
const loading = ref(false)
const rows = ref<TenantOverviewRow[]>([])
const total = ref(0)
const page = ref(1)
const loadError = ref('')
const drawerOpen = ref(false)
const activeTab = ref<DetailTab>('overview')
const currentTenant = ref<TenantOverviewRow | null>(null)

const filters = reactive<{
  keyword: string
  tenant_status: '' | number
  subscription_state: '' | SubscriptionState
  sort_by: 'tenant_name' | 'created_at' | 'end_at' | 'active_employee_count' | 'active_warehouse_count'
  sort_order: 'ASC' | 'DESC'
}>({
  keyword: '',
  tenant_status: '',
  subscription_state: '',
  sort_by: 'created_at',
  sort_order: 'DESC',
})

const employeeState = reactive<DetailState<TenantEmployeeRow>>({ rows: [], total: 0, page: 1, loading: false, loaded: false, error: '' })
const organizationState = reactive<DetailState<TenantOrganizationRow>>({ rows: [], total: 0, page: 1, loading: false, loaded: false, error: '' })
const postState = reactive<DetailState<TenantPostRow>>({ rows: [], total: 0, page: 1, loading: false, loaded: false, error: '' })
const roleState = reactive<DetailState<TenantRolePermissionRow>>({ rows: [], total: 0, page: 1, loading: false, loaded: false, error: '' })
const warehouseState = reactive<DetailState<TenantWarehouseRow>>({ rows: [], total: 0, page: 1, loading: false, loaded: false, error: '' })

const subscriptionOptions: Array<{ label: string; value: SubscriptionState }> = [
  { label: '未订购', value: 'NONE' },
  { label: '尚未开始', value: 'NOT_STARTED' },
  { label: '订购生效中', value: 'ACTIVE' },
  { label: '即将到期', value: 'EXPIRING' },
  { label: '已过期', value: 'EXPIRED' },
  { label: '已停用', value: 'DISABLED' },
]

const sortOptions = [
  { label: '创建时间', value: 'created_at' },
  { label: '租客名称', value: 'tenant_name' },
  { label: '订购到期时间', value: 'end_at' },
  { label: '有效用户数量', value: 'active_employee_count' },
  { label: '有效仓库数量', value: 'active_warehouse_count' },
] as const

function backendPendingMessage(error: unknown, resource: string) {
  if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
    return `${resource}的 SYSTEM 管理员查询接口尚未由后端提供`
  }
  return error instanceof Error ? error.message : `${resource}加载失败`
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await queryTenantOverview({
      keyword: filters.keyword.trim() || undefined,
      tenant_status: filters.tenant_status === '' ? undefined : filters.tenant_status,
      subscription_state: filters.subscription_state || undefined,
      page: page.value,
      page_size: pageSize,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order,
    })
    rows.value = data.tenant
    total.value = data.total
  } catch (error) {
    rows.value = []
    total.value = 0
    loadError.value = backendPendingMessage(error, '租客全景聚合')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}

function resetFilters() {
  Object.assign(filters, {
    keyword: '',
    tenant_status: '',
    subscription_state: '',
    sort_by: 'created_at',
    sort_order: 'DESC',
  })
  applyFilters()
}

function changePage(next: number) {
  page.value = next
  load()
}

function resetDetailState<T>(state: DetailState<T>) {
  state.rows = []
  state.total = 0
  state.page = 1
  state.loading = false
  state.loaded = false
  state.error = ''
}

function openTenant(row: TenantOverviewRow) {
  currentTenant.value = row
  activeTab.value = 'overview'
  resetDetailState(employeeState)
  resetDetailState(organizationState)
  resetDetailState(postState)
  resetDetailState(roleState)
  resetDetailState(warehouseState)
  drawerOpen.value = true
}

function commonDetailParams(next: number) {
  return {
    tenant_id: currentTenant.value?.tenant_code || '',
    page: next,
    page_size: detailPageSize,
    sort_order: 'ASC' as const,
  }
}

async function loadEmployees(next = 1) {
  if (!currentTenant.value) return
  employeeState.loading = true
  employeeState.error = ''
  try {
    const data = await queryPlatformTenantEmployees({ ...commonDetailParams(next), sort_by: 'created_at', sort_order: 'DESC' })
    employeeState.rows = data.user
    employeeState.total = data.total
    employeeState.page = next
    employeeState.loaded = true
  } catch (error) {
    employeeState.error = backendPendingMessage(error, '员工')
  } finally {
    employeeState.loading = false
  }
}

async function loadOrganizations(next = 1) {
  if (!currentTenant.value) return
  organizationState.loading = true
  organizationState.error = ''
  try {
    const data = await queryPlatformTenantOrganizations({ ...commonDetailParams(next), sort_by: 'sort_no' })
    organizationState.rows = data.org
    organizationState.total = data.total
    organizationState.page = next
    organizationState.loaded = true
  } catch (error) {
    organizationState.error = backendPendingMessage(error, '组织')
  } finally {
    organizationState.loading = false
  }
}

async function loadPosts(next = 1) {
  if (!currentTenant.value) return
  postState.loading = true
  postState.error = ''
  try {
    const data = await queryPlatformTenantPosts({ ...commonDetailParams(next), sort_by: 'sort_no' })
    postState.rows = data.post
    postState.total = data.total
    postState.page = next
    postState.loaded = true
  } catch (error) {
    postState.error = backendPendingMessage(error, '岗位')
  } finally {
    postState.loading = false
  }
}

async function loadRoles(next = 1) {
  if (!currentTenant.value) return
  roleState.loading = true
  roleState.error = ''
  try {
    const data = await queryPlatformTenantRoles({ ...commonDetailParams(next), sort_by: 'sort_no' })
    roleState.rows = data.role
    roleState.total = data.total
    roleState.page = next
    roleState.loaded = true
  } catch (error) {
    roleState.error = backendPendingMessage(error, '角色权限')
  } finally {
    roleState.loading = false
  }
}

async function loadWarehouses(next = 1) {
  if (!currentTenant.value) return
  warehouseState.loading = true
  warehouseState.error = ''
  try {
    const data = await queryPlatformTenantWarehouses({ ...commonDetailParams(next), sort_by: 'created_at', sort_order: 'DESC' })
    warehouseState.rows = data.warehouse
    warehouseState.total = data.total
    warehouseState.page = next
    warehouseState.loaded = true
  } catch (error) {
    warehouseState.error = backendPendingMessage(error, '仓库')
  } finally {
    warehouseState.loading = false
  }
}

function handleTabChange(name: string | number) {
  const tab = String(name) as DetailTab
  if (tab === 'employees' && !employeeState.loaded) loadEmployees()
  if (tab === 'organizations' && !organizationState.loaded) loadOrganizations()
  if (tab === 'posts' && !postState.loaded) loadPosts()
  if (tab === 'roles' && !roleState.loaded) loadRoles()
  if (tab === 'warehouses' && !warehouseState.loaded) loadWarehouses()
}

function subscriptionState(row: TenantOverviewRow): SubscriptionState {
  const subscription = row.current_subscription
  if (!subscription) return 'NONE'
  if (subscription.subscription_state) return subscription.subscription_state
  if (subscription.status !== 1) return 'DISABLED'
  const now = Date.now()
  const start = subscription.start_at ? new Date(subscription.start_at).getTime() : null
  const end = subscription.end_at ? new Date(subscription.end_at).getTime() : null
  if (start && start > now) return 'NOT_STARTED'
  if (end && end < now) return 'EXPIRED'
  if (end && end - now <= 30 * 24 * 60 * 60 * 1000) return 'EXPIRING'
  return 'ACTIVE'
}

function subscriptionLabel(row: TenantOverviewRow) {
  const state = subscriptionState(row)
  return subscriptionOptions.find((item) => item.value === state)?.label || state
}

function subscriptionClass(row: TenantOverviewRow) {
  const state = subscriptionState(row)
  if (state === 'ACTIVE') return 'is-success'
  if (state === 'EXPIRING' || state === 'NOT_STARTED') return 'is-info'
  if (state === 'EXPIRED' || state === 'DISABLED') return 'is-danger'
  return 'is-muted'
}

function formatDate(value?: string | null, dateOnly = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return dateOnly
    ? date.toLocaleDateString('zh-CN')
    : date.toLocaleString('zh-CN', { hour12: false })
}

function quotaPercent(current: number, maximum?: number | null) {
  if (!maximum || maximum <= 0) return 0
  return Math.min(100, Math.round((current / maximum) * 100))
}

function quotaColor(current: number, maximum?: number | null) {
  const percent = quotaPercent(current, maximum)
  if (percent >= 100) return '#c94b4b'
  if (percent >= 80) return '#d98b23'
  return '#2f6fed'
}

function copyTenantCode() {
  const code = currentTenant.value?.tenant_code
  if (!code) return
  navigator.clipboard.writeText(code)
    .then(() => ElMessage.success('租客编码已复制'))
    .catch(() => ElMessage.warning('复制失败，请手动复制'))
}

onMounted(load)
</script>

<template>
  <div class="page-stack tenant-overview-page">
    <PageHeader
      eyebrow="TENANT PANORAMA"
      title="租客全景"
      description="集中查看租客当前订购、用户与仓库配额、组织岗位和角色权限。"
      marker="SYSTEM VIEW"
    />

    <section class="filter-deck">
      <div class="filter-deck__head">
        <div><span class="mono-label">TENANT FILTERS</span><h2>租客筛选</h2></div>
        <div class="filter-actions">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" :loading="loading" @click="applyFilters">查询租客</el-button>
        </div>
      </div>
      <div class="filter-grid tenant-filter-grid">
        <label><span>关键词</span><el-input v-model="filters.keyword" clearable placeholder="编码、名称、联系人或电话" @keyup.enter="applyFilters" /></label>
        <label><span>租客状态</span><el-select v-model="filters.tenant_status" clearable placeholder="全部状态"><el-option label="正常" :value="1" /><el-option label="停用" :value="0" /></el-select></label>
        <label><span>当前订购</span><el-select v-model="filters.subscription_state" clearable placeholder="全部订购状态"><el-option v-for="item in subscriptionOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></label>
        <label><span>排序字段</span><el-select v-model="filters.sort_by"><el-option v-for="item in sortOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></label>
        <label><span>排序方向</span><el-segmented v-model="filters.sort_order" :options="[{ label: '降序', value: 'DESC' }, { label: '升序', value: 'ASC' }]" /></label>
      </div>
    </section>

    <el-alert v-if="loadError" :title="loadError" type="warning" show-icon :closable="false">
      <template #default>前端页面和请求契约已经就绪；后端补齐对应接口后可直接返回真实数据。</template>
    </el-alert>

    <section class="data-panel tenant-data-panel">
      <div class="data-panel__head">
        <div><span class="mono-label">TENANT DIRECTORY</span><h2>租客总览</h2></div>
        <span class="record-count"><strong>{{ total }}</strong> 个租客</span>
      </div>
      <el-table v-loading="loading" :data="rows" stripe table-layout="fixed" empty-text="暂无租客全景数据" @row-dblclick="openTenant">
        <el-table-column label="租客" fixed="left" min-width="205">
          <template #default="scope"><div class="table-person"><strong>{{ scope.row.tenant_name }}</strong><span>{{ scope.row.tenant_code }}</span></div></template>
        </el-table-column>
        <el-table-column label="联系人" width="145">
          <template #default="scope"><div class="table-person"><strong>{{ scope.row.contact_name || '—' }}</strong><span>{{ scope.row.contact_phone || '—' }}</span></div></template>
        </el-table-column>
        <el-table-column label="租客状态" width="90">
          <template #default="scope"><span class="status-pill" :class="scope.row.status === 1 ? 'is-success' : 'is-danger'">{{ scope.row.status === 1 ? '正常' : '停用' }}</span></template>
        </el-table-column>
        <el-table-column label="当前订购" min-width="170">
          <template #default="scope">
            <div class="subscription-cell">
              <span class="status-pill" :class="subscriptionClass(scope.row)">{{ subscriptionLabel(scope.row) }}</span>
              <small>{{ formatDate(scope.row.current_subscription?.end_at, true) }} 到期</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="用户数量 / 上限" min-width="165">
          <template #default="scope">
            <div class="quota-cell">
              <div><strong>{{ scope.row.statistics.active_employee_count }}</strong><span>/ {{ scope.row.current_subscription?.max_user_count ?? '—' }}</span><small>共 {{ scope.row.statistics.employee_total_count }} 人</small></div>
              <el-progress :percentage="quotaPercent(scope.row.statistics.active_employee_count, scope.row.current_subscription?.max_user_count)" :show-text="false" :stroke-width="5" :color="quotaColor(scope.row.statistics.active_employee_count, scope.row.current_subscription?.max_user_count)" />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="仓库数量 / 上限" min-width="165">
          <template #default="scope">
            <div class="quota-cell">
              <div><strong>{{ scope.row.statistics.active_warehouse_count }}</strong><span>/ {{ scope.row.current_subscription?.max_warehouse_count ?? '—' }}</span><small>共 {{ scope.row.statistics.warehouse_total_count }} 个</small></div>
              <el-progress :percentage="quotaPercent(scope.row.statistics.active_warehouse_count, scope.row.current_subscription?.max_warehouse_count)" :show-text="false" :stroke-width="5" :color="quotaColor(scope.row.statistics.active_warehouse_count, scope.row.current_subscription?.max_warehouse_count)" />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="存储配额" width="105">
          <template #default="scope"><strong>{{ scope.row.current_subscription?.storage_quota_gb ?? '—' }}</strong> GB</template>
        </el-table-column>
        <el-table-column label="组织资源" width="130">
          <template #default="scope"><div class="resource-counts"><span>组织 {{ scope.row.statistics.organization_count }}</span><span>岗位 {{ scope.row.statistics.post_count }}</span></div></template>
        </el-table-column>
        <el-table-column label="权限资源" width="130">
          <template #default="scope"><div class="resource-counts"><span>角色 {{ scope.row.statistics.role_count }}</span><span>权限 {{ scope.row.statistics.assigned_permission_count }}</span></div></template>
        </el-table-column>
        <el-table-column label="创建时间" width="165"><template #default="scope">{{ formatDate(scope.row.created_at) }}</template></el-table-column>
        <el-table-column label="操作" width="88" fixed="right"><template #default="scope"><el-button link type="primary" @click="openTenant(scope.row)">查看</el-button></template></el-table-column>
      </el-table>
      <div class="pagination-bar">
        <span>双击租客可打开完整资料</span>
        <el-pagination background layout="prev, pager, next" :page-size="pageSize" :total="total" :current-page="page" @current-change="changePage" />
      </div>
    </section>

    <el-drawer v-model="drawerOpen" size="82%" class="tenant-detail-drawer" destroy-on-close>
      <template #header>
        <div v-if="currentTenant" class="tenant-drawer-title">
          <div><span class="mono-label">TENANT DOSSIER</span><h2>{{ currentTenant.tenant_name }}</h2></div>
          <button type="button" class="tenant-code-copy" @click="copyTenantCode"><span>{{ currentTenant.tenant_code }}</span><small>点击复制</small></button>
        </div>
      </template>

      <el-tabs v-if="currentTenant" v-model="activeTab" class="tenant-detail-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="概览与当前订购" name="overview">
          <div class="tenant-detail-grid">
            <section class="tenant-detail-card">
              <div class="tenant-detail-card__head"><span class="mono-label">PROFILE</span><h3>基本信息</h3></div>
              <dl class="tenant-info-list">
                <dt>租客名称</dt><dd>{{ currentTenant.tenant_name }}</dd>
                <dt>租客编码</dt><dd class="table-code">{{ currentTenant.tenant_code }}</dd>
                <dt>联系人</dt><dd>{{ currentTenant.contact_name || '—' }}</dd>
                <dt>联系电话</dt><dd>{{ currentTenant.contact_phone || '—' }}</dd>
                <dt>联系邮箱</dt><dd>{{ currentTenant.contact_email || '—' }}</dd>
                <dt>租客状态</dt><dd><span class="status-pill" :class="currentTenant.status === 1 ? 'is-success' : 'is-danger'">{{ currentTenant.status === 1 ? '正常' : '停用' }}</span></dd>
                <dt>创建时间</dt><dd>{{ formatDate(currentTenant.created_at) }}</dd>
                <dt>更新时间</dt><dd>{{ formatDate(currentTenant.updated_at) }}</dd>
              </dl>
            </section>

            <section class="tenant-detail-card">
              <div class="tenant-detail-card__head"><span class="mono-label">CURRENT SUBSCRIPTION</span><h3>当前订购</h3></div>
              <div v-if="currentTenant.current_subscription" class="subscription-detail">
                <div class="subscription-detail__status"><span class="status-pill" :class="subscriptionClass(currentTenant)">{{ subscriptionLabel(currentTenant) }}</span><code>{{ currentTenant.current_subscription.subscription_id }}</code></div>
                <dl class="tenant-info-list">
                  <dt>订购开始</dt><dd>{{ formatDate(currentTenant.current_subscription.start_at) }}</dd>
                  <dt>订购结束</dt><dd>{{ formatDate(currentTenant.current_subscription.end_at) }}</dd>
                  <dt>最大用户数</dt><dd>{{ currentTenant.current_subscription.max_user_count }} 人</dd>
                  <dt>最大仓库数</dt><dd>{{ currentTenant.current_subscription.max_warehouse_count }} 个</dd>
                  <dt>存储配额</dt><dd>{{ currentTenant.current_subscription.storage_quota_gb }} GB</dd>
                </dl>
              </div>
              <el-empty v-else description="当前租客尚未订购" :image-size="72" />
            </section>
          </div>

          <section class="tenant-stat-grid">
            <div><span>有效用户</span><strong>{{ currentTenant.statistics.active_employee_count }}</strong><small>总用户 {{ currentTenant.statistics.employee_total_count }}</small></div>
            <div><span>有效仓库</span><strong>{{ currentTenant.statistics.active_warehouse_count }}</strong><small>总仓库 {{ currentTenant.statistics.warehouse_total_count }}</small></div>
            <div><span>组织 / 岗位</span><strong>{{ currentTenant.statistics.organization_count }} / {{ currentTenant.statistics.post_count }}</strong><small>人员组织资源</small></div>
            <div><span>角色 / 权限</span><strong>{{ currentTenant.statistics.role_count }} / {{ currentTenant.statistics.assigned_permission_count }}</strong><small>已分配权限资源</small></div>
          </section>
        </el-tab-pane>

        <el-tab-pane label="员工" name="employees">
          <el-alert v-if="employeeState.error" :title="employeeState.error" type="warning" show-icon :closable="false" class="detail-api-alert" />
          <el-table v-loading="employeeState.loading" :data="employeeState.rows" stripe empty-text="暂无员工数据">
            <el-table-column label="员工" min-width="160"><template #default="scope"><div class="table-person"><strong>{{ scope.row.user_name }}</strong><span>{{ scope.row.user_id }}</span></div></template></el-table-column>
            <el-table-column prop="login_name" label="登录账号" min-width="130" />
            <el-table-column label="组织 / 岗位" min-width="160"><template #default="scope"><div class="table-person"><strong>{{ scope.row.org_name || '—' }}</strong><span>{{ scope.row.post_name || '—' }}</span></div></template></el-table-column>
            <el-table-column label="角色" min-width="140"><template #default="scope"><div class="table-person"><strong>{{ scope.row.role_name || '—' }}</strong><span>{{ scope.row.role_type || '—' }}</span></div></template></el-table-column>
            <el-table-column prop="mobile" label="手机" min-width="120" />
            <el-table-column prop="email" label="邮箱" min-width="170" show-overflow-tooltip />
            <el-table-column label="状态" width="80"><template #default="scope"><span class="status-pill" :class="scope.row.status === 1 ? 'is-success' : 'is-danger'">{{ scope.row.status === 1 ? '正常' : '停用' }}</span></template></el-table-column>
            <el-table-column label="创建时间" width="165"><template #default="scope">{{ formatDate(scope.row.created_at) }}</template></el-table-column>
          </el-table>
          <div class="detail-pagination"><el-pagination v-if="employeeState.total > detailPageSize" background layout="prev, pager, next" :page-size="detailPageSize" :total="employeeState.total" :current-page="employeeState.page" @current-change="loadEmployees" /></div>
        </el-tab-pane>

        <el-tab-pane label="组织" name="organizations">
          <el-alert v-if="organizationState.error" :title="organizationState.error" type="warning" show-icon :closable="false" class="detail-api-alert" />
          <el-table v-loading="organizationState.loading" :data="organizationState.rows" stripe empty-text="暂无组织数据">
            <el-table-column label="组织" min-width="180"><template #default="scope"><div class="table-person"><strong>{{ scope.row.org_name }}</strong><span>{{ scope.row.org_code }}</span></div></template></el-table-column>
            <el-table-column prop="org_full_name" label="组织全称" min-width="180" show-overflow-tooltip />
            <el-table-column prop="org_type_label" label="类型" width="110" />
            <el-table-column prop="parent_org_name" label="上级组织" min-width="130" />
            <el-table-column prop="leader_name" label="负责人" width="100" />
            <el-table-column prop="employee_count" label="员工数" width="85" />
            <el-table-column label="状态" width="80"><template #default="scope"><span class="status-pill" :class="scope.row.status === 1 ? 'is-success' : 'is-danger'">{{ scope.row.status === 1 ? '正常' : '停用' }}</span></template></el-table-column>
            <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
          </el-table>
          <div class="detail-pagination"><el-pagination v-if="organizationState.total > detailPageSize" background layout="prev, pager, next" :page-size="detailPageSize" :total="organizationState.total" :current-page="organizationState.page" @current-change="loadOrganizations" /></div>
        </el-tab-pane>

        <el-tab-pane label="岗位" name="posts">
          <el-alert v-if="postState.error" :title="postState.error" type="warning" show-icon :closable="false" class="detail-api-alert" />
          <el-table v-loading="postState.loading" :data="postState.rows" stripe empty-text="暂无岗位数据">
            <el-table-column label="岗位" min-width="190"><template #default="scope"><div class="table-person"><strong>{{ scope.row.post_name }}</strong><span>{{ scope.row.post_code }}</span></div></template></el-table-column>
            <el-table-column prop="post_category_label" label="岗位分类" min-width="130" />
            <el-table-column prop="employee_count" label="员工数" width="90" />
            <el-table-column prop="sort_no" label="排序" width="80" />
            <el-table-column label="状态" width="80"><template #default="scope"><span class="status-pill" :class="scope.row.status === 1 ? 'is-success' : 'is-danger'">{{ scope.row.status === 1 ? '正常' : '停用' }}</span></template></el-table-column>
            <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
            <el-table-column label="更新时间" width="165"><template #default="scope">{{ formatDate(scope.row.updated_at) }}</template></el-table-column>
          </el-table>
          <div class="detail-pagination"><el-pagination v-if="postState.total > detailPageSize" background layout="prev, pager, next" :page-size="detailPageSize" :total="postState.total" :current-page="postState.page" @current-change="loadPosts" /></div>
        </el-tab-pane>

        <el-tab-pane label="角色权限" name="roles">
          <el-alert v-if="roleState.error" :title="roleState.error" type="warning" show-icon :closable="false" class="detail-api-alert" />
          <el-table v-loading="roleState.loading" :data="roleState.rows" stripe empty-text="暂无角色权限数据">
            <el-table-column label="角色" min-width="180"><template #default="scope"><div class="table-person"><strong>{{ scope.row.role_name }}</strong><span>{{ scope.row.role_code }}</span></div></template></el-table-column>
            <el-table-column prop="role_type_label" label="角色类型" width="110" />
            <el-table-column prop="user_count" label="员工数" width="85" />
            <el-table-column label="权限" min-width="320">
              <template #default="scope"><div class="permission-tags"><el-tag v-for="permission in scope.row.permissions.slice(0, 5)" :key="permission.perm_code" size="small" effect="plain">{{ permission.perm_name }}</el-tag><span v-if="scope.row.permissions.length > 5">+{{ scope.row.permissions.length - 5 }}</span><span v-if="!scope.row.permissions.length && scope.row.role_type === 'ADMIN'" class="all-permission-note">全部权限</span><span v-else-if="!scope.row.permissions.length">—</span></div></template>
            </el-table-column>
            <el-table-column prop="permission_count" label="权限数" width="85" />
            <el-table-column label="状态" width="80"><template #default="scope"><span class="status-pill" :class="scope.row.status === 1 ? 'is-success' : 'is-danger'">{{ scope.row.status === 1 ? '正常' : '停用' }}</span></template></el-table-column>
            <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
          </el-table>
          <div class="detail-pagination"><el-pagination v-if="roleState.total > detailPageSize" background layout="prev, pager, next" :page-size="detailPageSize" :total="roleState.total" :current-page="roleState.page" @current-change="loadRoles" /></div>
        </el-tab-pane>

        <el-tab-pane label="仓库" name="warehouses">
          <el-alert v-if="warehouseState.error" :title="warehouseState.error" type="warning" show-icon :closable="false" class="detail-api-alert" />
          <el-table v-loading="warehouseState.loading" :data="warehouseState.rows" stripe empty-text="暂无仓库数据">
            <el-table-column label="仓库" min-width="180"><template #default="scope"><div class="table-person"><strong>{{ scope.row.warehouse_name }}</strong><span>{{ scope.row.warehouse_no }}</span></div></template></el-table-column>
            <el-table-column prop="warehouse_region_label" label="区域" width="100" />
            <el-table-column prop="warehouse_type_label" label="类型" width="110" />
            <el-table-column prop="area_name" label="行政区域" min-width="120" />
            <el-table-column prop="warehouse_address" label="地址" min-width="200" show-overflow-tooltip />
            <el-table-column label="联系人" min-width="130"><template #default="scope"><div class="table-person"><strong>{{ scope.row.contact_name || '—' }}</strong><span>{{ scope.row.contact_phone || '—' }}</span></div></template></el-table-column>
            <el-table-column prop="location_count" label="货位数" width="85" />
            <el-table-column label="状态" width="80"><template #default="scope"><span class="status-pill" :class="scope.row.status === 1 ? 'is-success' : 'is-danger'">{{ scope.row.status === 1 ? '正常' : '停用' }}</span></template></el-table-column>
            <el-table-column label="创建时间" width="165"><template #default="scope">{{ formatDate(scope.row.created_at) }}</template></el-table-column>
          </el-table>
          <div class="detail-pagination"><el-pagination v-if="warehouseState.total > detailPageSize" background layout="prev, pager, next" :page-size="detailPageSize" :total="warehouseState.total" :current-page="warehouseState.page" @current-change="loadWarehouses" /></div>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
  </div>
</template>
