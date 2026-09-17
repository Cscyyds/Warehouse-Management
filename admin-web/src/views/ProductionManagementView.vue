<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { listChannels, queryProductionConfigs, queryTenantProductionConfig } from '@/api/productionManagement'
import type { ChannelItem, ProductionConfigSummaryRow, TenantProductionConfigData } from '@/types/productionManagement'
import ModuleConfigTab from './production-management/ModuleConfigTab.vue'
import ChannelCredentialTab from './production-management/ChannelCredentialTab.vue'
import SyncStatusTab from './production-management/SyncStatusTab.vue'
import SyncLogTab from './production-management/SyncLogTab.vue'

type DetailTab = 'config' | 'credential' | 'sync' | 'log'

const pageSize = 20
const loading = ref(false)
const rows = ref<ProductionConfigSummaryRow[]>([])
const total = ref(0)
const page = ref(1)
const channels = ref<ChannelItem[]>([])

const drawerOpen = ref(false)
const activeTab = ref<DetailTab>('config')
const currentTenant = ref<ProductionConfigSummaryRow | null>(null)
const tenantDetail = ref<TenantProductionConfigData | null>(null)
const visited = reactive<Record<DetailTab, boolean>>({ config: true, credential: false, sync: false, log: false })

const filters = reactive<{ keyword: string; enabled: '' | 0 | 1; channel_code: string }>({
  keyword: '',
  enabled: '',
  channel_code: '',
})

const enabled = computed(() => tenantDetail.value?.config?.enabled === 1)
const tenantId = computed(() => currentTenant.value?.tenant_id || '')
const syncTabActive = computed(() => drawerOpen.value && activeTab.value === 'sync')

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function loadChannels() {
  try {
    const data = await listChannels()
    channels.value = data.channels
  } catch (error) {
    channels.value = []
    ElMessage.error(errorMessage(error, '渠道枚举加载失败'))
  }
}

async function load() {
  loading.value = true
  try {
    const data = await queryProductionConfigs({
      keyword: filters.keyword.trim() || undefined,
      enabled: filters.enabled === '' ? undefined : filters.enabled,
      channel_code: filters.channel_code || undefined,
      page: page.value,
      page_size: pageSize,
    })
    rows.value = data.items
    total.value = data.total
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(errorMessage(error, '租户生产模块配置加载失败'))
  } finally {
    loading.value = false
  }
}

function applyFilters() { page.value = 1; load() }
function resetFilters() { Object.assign(filters, { keyword: '', enabled: '', channel_code: '' }); applyFilters() }
function changePage(next: number) { page.value = next; load() }

async function refreshTenantDetail() {
  if (!currentTenant.value) return
  try {
    tenantDetail.value = await queryTenantProductionConfig(currentTenant.value.tenant_id)
  } catch (error) {
    ElMessage.error(errorMessage(error, '租户配置查询失败'))
  }
}

async function openDrawer(row: ProductionConfigSummaryRow) {
  currentTenant.value = row
  tenantDetail.value = null
  activeTab.value = 'config'
  Object.assign(visited, { config: true, credential: false, sync: false, log: false })
  drawerOpen.value = true
  await refreshTenantDetail()
}

function handleTabChange(name: string | number) {
  const tab = String(name) as DetailTab
  visited[tab] = true
}

/** 子组件写操作成功后：刷新抽屉内配置与主列表当前页 */
async function onChildChanged() {
  await Promise.all([refreshTenantDetail(), load()])
}

function copyTenantCode() {
  const code = currentTenant.value?.tenant_id
  if (!code) return
  navigator.clipboard.writeText(code)
    .then(() => ElMessage.success('租户编码已复制'))
    .catch(() => ElMessage.warning('复制失败，请手动复制'))
}

/** 同步参数为空时展示后端默认值（600 秒 / 31 天 / 365 天 / 90 天） */
function syncParamText(row: ProductionConfigSummaryRow) {
  return `${row.sync_interval_seconds ?? 600}s / ${row.sync_window_days ?? 31}d / ${row.initial_backfill_days ?? 365}d / ${row.reconcile_days ?? 90}d`
}
function hasDefaultParam(row: ProductionConfigSummaryRow) {
  return row.sync_interval_seconds == null || row.sync_window_days == null
    || row.initial_backfill_days == null || row.reconcile_days == null
}

onMounted(() => { loadChannels(); load() })
</script>

<template>
  <div class="page-stack">
    <PageHeader
      eyebrow="PRODUCTION SYNC"
      title="生产管理配置"
      description="按租户开通生产模块、维护 ERP 渠道凭证、观测并干预 13 类生产单据的自动同步。"
      marker="PLATFORM"
    />

    <section class="filter-deck">
      <div class="filter-deck__head">
        <div><span class="mono-label">QUERY CONTROL</span><h2>租户筛选</h2></div>
        <div class="filter-actions">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" :loading="loading" @click="applyFilters">查询租户</el-button>
        </div>
      </div>
      <div class="filter-grid filter-grid--production">
        <label><span>关键词</span><el-input v-model="filters.keyword" clearable placeholder="租户编码或名称" @keyup.enter="applyFilters" /></label>
        <label><span>开通状态</span>
          <el-select v-model="filters.enabled" clearable placeholder="全部">
            <el-option label="已开启" :value="1" />
            <el-option label="未开启" :value="0" />
          </el-select>
        </label>
        <label><span>接入渠道</span>
          <el-select v-model="filters.channel_code" clearable placeholder="全部渠道">
            <el-option v-for="item in channels" :key="item.channel_code" :label="item.channel_name" :value="item.channel_code" />
          </el-select>
        </label>
      </div>
    </section>

    <section class="data-panel">
      <div class="data-panel__head">
        <div><span class="mono-label">TENANT DIRECTORY</span><h2>租户配置总览</h2></div>
        <span class="record-count"><strong>{{ total }}</strong> 个租户（含未配置）</span>
      </div>
      <el-table v-loading="loading" :data="rows" stripe table-layout="fixed" empty-text="暂无租户数据" @row-dblclick="openDrawer">
        <el-table-column label="租户" fixed="left" min-width="200">
          <template #default="scope"><div class="table-person"><strong>{{ scope.row.tenant_name }}</strong><span>{{ scope.row.tenant_id }}</span></div></template>
        </el-table-column>
        <el-table-column label="租户状态" width="92" align="center">
          <template #default="scope"><span class="status-pill" :class="scope.row.tenant_status === 1 ? 'is-success' : 'is-danger'">{{ scope.row.tenant_status === 1 ? '正常' : '停用' }}</span></template>
        </el-table-column>
        <el-table-column label="联系人" width="140">
          <template #default="scope"><div class="table-person"><strong>{{ scope.row.contact_name || '—' }}</strong><span>{{ scope.row.contact_phone || '—' }}</span></div></template>
        </el-table-column>
        <el-table-column label="生产模块" width="94" align="center">
          <template #default="scope"><span class="status-pill" :class="scope.row.enabled === 1 ? 'is-success' : 'is-muted'">{{ scope.row.enabled === 1 ? '已开启' : '未开启' }}</span></template>
        </el-table-column>
        <el-table-column label="渠道" width="100">
          <template #default="scope">{{ scope.row.channel_name || '—' }}</template>
        </el-table-column>
        <el-table-column label="同步参数（间隔/跨度/回填/对账）" min-width="220">
          <template #default="scope">
            <span class="mono-label sync-param">{{ syncParamText(scope.row) }}</span>
            <el-tag v-if="hasDefaultParam(scope.row)" size="small" effect="plain" class="default-tag">含默认</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="凭证" width="86" align="center">
          <template #default="scope"><span class="status-pill" :class="scope.row.credential_configured ? 'is-success' : 'is-danger'">{{ scope.row.credential_configured ? '齐全' : '未配' }}</span></template>
        </el-table-column>
        <el-table-column label="站点号" min-width="150" show-overflow-tooltip>
          <template #default="scope"><code class="table-code">{{ scope.row.api_base_url || '—' }}</code></template>
        </el-table-column>
        <el-table-column label="更新时间" width="160">
          <template #default="scope"><span class="mono-label">{{ scope.row.updated_at || '—' }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="88" fixed="right">
          <template #default="scope"><el-button link type="primary" @click="openDrawer(scope.row)">配置</el-button></template>
        </el-table-column>
      </el-table>
      <div class="pagination-bar">
        <span>双击租户可打开配置抽屉</span>
        <el-pagination background layout="prev, pager, next" :page-size="pageSize" :total="total" :current-page="page" @current-change="changePage" />
      </div>
    </section>

    <el-drawer v-model="drawerOpen" size="82%" class="tenant-detail-drawer" destroy-on-close>
      <template #header>
        <div v-if="currentTenant" class="tenant-drawer-title">
          <div><span class="mono-label">PRODUCTION CONFIG</span><h2>{{ currentTenant.tenant_name }}</h2></div>
          <button type="button" class="tenant-code-copy" @click="copyTenantCode"><span>{{ currentTenant.tenant_id }}</span><small>点击复制</small></button>
        </div>
      </template>

      <el-tabs v-if="currentTenant" v-model="activeTab" class="tenant-detail-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="模块配置" name="config">
          <ModuleConfigTab
            v-if="visited.config"
            :tenant-id="tenantId"
            :channels="channels"
            :config="tenantDetail?.config ?? null"
            :enabled="enabled"
            @changed="onChildChanged"
          />
        </el-tab-pane>
        <el-tab-pane label="渠道凭证" name="credential">
          <ChannelCredentialTab
            v-if="visited.credential"
            :tenant-id="tenantId"
            :channels="channels"
            @changed="onChildChanged"
          />
        </el-tab-pane>
        <el-tab-pane label="同步状态" name="sync">
          <SyncStatusTab
            v-if="visited.sync"
            :tenant-id="tenantId"
            :enabled="enabled"
            :active="syncTabActive"
          />
        </el-tab-pane>
        <el-tab-pane label="同步日志" name="log">
          <SyncLogTab v-if="visited.log" :tenant-id="tenantId" />
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
  </div>
</template>

<style scoped>
.filter-grid--production { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.sync-param { color: #526b87; }
.default-tag { margin-left: 8px; }
@media (max-width: 1180px) {
  .filter-grid--production { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
