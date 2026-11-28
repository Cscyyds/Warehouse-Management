<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { queryPlatformTenants, type TenantOptionRow } from '@/api/platformQueries'
import { queryTenantMode, type TenantMode, type TenantModeInfo } from '@/api/tenantMode'
import type { ChannelItem } from '@/types/productionManagement'
import ModuleConfigTab from './production-management/ModuleConfigTab.vue'
import SyncParametersTab from './production-management/SyncParametersTab.vue'
import ChannelCredentialTab from './production-management/ChannelCredentialTab.vue'
import SyncStatusTab from './production-management/SyncStatusTab.vue'
import SyncLogTab from './production-management/SyncLogTab.vue'
import TradeRejectTab from './production-management/TradeRejectTab.vue'
import SyncConfigTab from './production-management/SyncConfigTab.vue'

const rows = ref<TenantOptionRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const filters = reactive<{ keyword: string; tenant_mode: TenantMode | '' }>({ keyword: '', tenant_mode: '' })
const drawerOpen = ref(false)
const currentTenant = ref<TenantOptionRow | null>(null)
const modeInfo = ref<TenantModeInfo | null>(null)
const detailLoaded = ref(false)
const activeTab = ref('config')
const dataVersion = ref(0)
const tenantId = computed(() => currentTenant.value?.tenant_code || '')
const isTianxin = computed(() => detailLoaded.value && modeInfo.value?.tenant_mode === 'TIANXIN')
const visited = reactive<Record<string, boolean>>({ config: true })
let listGeneration = 0
let detailGeneration = 0
// Unified mode supports only TIANXIN ERP credentials; no retired channel-enumeration request.
const channels: ChannelItem[] = [{
  channel_code: 'TIANXIN', channel_name: '天心', available: true, supported_doc_count: 13,
  credential_fields: [
    { key: 'api_scheme', label: '站点协议', required: true, secret: false, widget: 'scheme' },
    { key: 'api_base_url', label: '站点号（host:port）', required: true, secret: false },
    { key: 'comp_no', label: '账套代号', required: true, secret: false },
    { key: 'usr', label: 'ERPAPI 登录账号', required: true, secret: false },
    { key: 'pwd', label: '登录密码（编辑时留空=不修改）', required: true, secret: true },
    { key: 'default_usr', label: '默认操作者代号（可空）', required: false, secret: false },
  ],
}]
function modeLabel(mode?: TenantMode | null) { return mode === 'LOCAL' ? '本地' : mode === 'TIANXIN' ? '天心' : '待迁移' }
async function load() {
  const current = ++listGeneration
  loading.value = true
  try {
    const data = await queryPlatformTenants({ page: page.value, page_size: pageSize,
      keyword: filters.keyword.trim() || undefined, tenant_mode: filters.tenant_mode || undefined })
    if (current !== listGeneration) return
    rows.value = data.tenant
    total.value = data.total
  } catch (error) {
    if (current !== listGeneration) return
    rows.value = []; total.value = 0
    ElMessage.error(error instanceof Error ? error.message : '租户列表加载失败')
  } finally { if (current === listGeneration) loading.value = false }
}
async function refreshTenantDetail() {
  const id = tenantId.value
  const current = ++detailGeneration
  detailLoaded.value = false
  modeInfo.value = null
  try {
    const data = await queryTenantMode(id)
    if (current !== detailGeneration || id !== tenantId.value) return
    modeInfo.value = data
    detailLoaded.value = true
    if (data.tenant_mode !== 'TIANXIN' && activeTab.value !== 'config' && activeTab.value !== 'parameters') activeTab.value = 'config'
  } catch (error) {
    if (current !== detailGeneration) return
    ElMessage.error(error instanceof Error ? error.message : '租户模式加载失败')
  }
}
async function openDrawer(row: TenantOptionRow) {
  currentTenant.value = row
  activeTab.value = 'config'
  Object.keys(visited).forEach(key => delete visited[key])
  visited.config = true
  drawerOpen.value = true
  await refreshTenantDetail()
}
function handleTabChange(name: string | number) { visited[String(name)] = true }
function applyFilters() { page.value = 1; void load() }
function resetFilters() { filters.keyword = ''; filters.tenant_mode = ''; applyFilters() }
function changePage(next: number) { page.value = next; void load() }
async function onChildChanged() {
  dataVersion.value++
  await Promise.all([refreshTenantDetail(), load()])
}
onMounted(load)
</script>

<template>
  <div class="page-stack">
    <PageHeader eyebrow="TENANT MODE" title="生产管理配置" description="统一管理租户业务模式、天心同步参数、渠道凭证与同步运行状态。" marker="PLATFORM" />
    <section class="filter-deck">
      <div class="filter-deck__head"><h2>租户筛选</h2><div class="filter-actions"><el-button @click="resetFilters">重置</el-button><el-button type="primary" :loading="loading" @click="applyFilters">查询租户</el-button></div></div>
      <div class="filter-grid">
        <label><span>关键词</span><el-input v-model="filters.keyword" clearable placeholder="租户编码或名称" @keyup.enter="applyFilters" /></label>
        <label><span>租户模式</span><el-select v-model="filters.tenant_mode" clearable placeholder="全部"><el-option label="本地" value="LOCAL" /><el-option label="天心" value="TIANXIN" /></el-select></label>
      </div>
    </section>
    <section class="data-panel">
      <div class="data-panel__head"><h2>可用租户</h2><span>{{ total }} 个租户</span></div>
      <el-table v-loading="loading" :data="rows" stripe @row-dblclick="openDrawer">
        <el-table-column prop="tenant_name" label="租户名称" min-width="180" />
        <el-table-column prop="tenant_code" label="租户编码" min-width="240" />
        <el-table-column label="业务模式"><template #default="scope">{{ modeLabel(scope.row.tenant_mode) }}</template></el-table-column>
        <el-table-column prop="tenant_mode_revision" label="模式版本" />
        <el-table-column label="操作" width="100"><template #default="scope"><el-button link type="primary" @click="openDrawer(scope.row)">配置</el-button></template></el-table-column>
      </el-table>
      <div class="pagination-bar"><el-pagination background layout="prev, pager, next" :page-size="pageSize" :total="total" :current-page="page" @current-change="changePage" /></div>
    </section>
    <el-drawer v-model="drawerOpen" size="82%" destroy-on-close>
      <template #header><div><h2>{{ currentTenant?.tenant_name }}</h2><code>{{ tenantId }}</code></div></template>
      <div v-if="currentTenant" :key="tenantId">
        <el-button :disabled="loading" @click="refreshTenantDetail">刷新租户模式</el-button>
        <el-tabs v-model="activeTab" @tab-change="handleTabChange">
          <el-tab-pane label="租户统一模式" name="config"><ModuleConfigTab :tenant-id="tenantId" :info="modeInfo" :loaded="detailLoaded" @changed="onChildChanged" /></el-tab-pane>
          <el-tab-pane label="同步参数" name="parameters"><SyncParametersTab v-if="visited.parameters" :tenant-id="tenantId" :data-version="dataVersion" /></el-tab-pane>
          <el-tab-pane v-if="isTianxin" label="渠道凭证" name="credential"><ChannelCredentialTab v-if="visited.credential" :tenant-id="tenantId" :channels="channels" :data-version="dataVersion" @changed="onChildChanged" /></el-tab-pane>
          <el-tab-pane v-if="isTianxin" label="同步状态" name="sync"><SyncStatusTab v-if="visited.sync" :tenant-id="tenantId" :enabled="isTianxin" :active="drawerOpen && activeTab === 'sync'" :data-version="dataVersion" /></el-tab-pane>
          <el-tab-pane v-if="isTianxin" label="同步日志" name="log"><SyncLogTab v-if="visited.log" :tenant-id="tenantId" /></el-tab-pane>
          <el-tab-pane v-if="isTianxin" label="同步失败记录" name="reject"><TradeRejectTab v-if="visited.reject" :tenant-id="tenantId" /></el-tab-pane>
          <el-tab-pane v-if="isTianxin" label="单据正式开启时间" name="syncConfig"><SyncConfigTab v-if="visited.syncConfig" :tenant-id="tenantId" :data-version="dataVersion" @changed="onChildChanged" /></el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>
  </div>
</template>
