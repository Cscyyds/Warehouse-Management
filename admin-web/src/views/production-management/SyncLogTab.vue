<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { PRODUCTION_DOC_OPTIONS, querySyncLogs } from '@/api/productionManagement'
import type { SyncLogLevel, SyncLogRow, SyncLogStatus } from '@/types/productionManagement'

const props = defineProps<{ tenantId: string }>()

const pageSize = 20
const loading = ref(false)
const rows = ref<SyncLogRow[]>([])
const total = ref(0)
const page = ref(1)
const filters = reactive<{ doc_key: string; log_level: '' | SyncLogLevel; log_status: '' | SyncLogStatus }>({
  doc_key: '',
  log_level: '',
  log_status: '',
})

const levelOptions: Array<{ label: string; value: SyncLogLevel }> = [
  { label: '轮次', value: 'ROUND' },
  { label: '分片', value: 'SLICE' },
]
const statusOptions: Array<{ label: string; value: SyncLogStatus }> = [
  { label: '成功', value: 'SUCCESS' },
  { label: '部分成功', value: 'PARTIAL' },
  { label: '失败', value: 'FAILED' },
  { label: '执行中', value: 'RUNNING' },
]

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function load() {
  loading.value = true
  try {
    const data = await querySyncLogs({
      tenant_id: props.tenantId,
      doc_key: filters.doc_key || undefined,
      log_level: filters.log_level || undefined,
      log_status: filters.log_status || undefined,
      page: page.value,
      page_size: pageSize,
    })
    rows.value = data.logs
    total.value = data.total
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(errorMessage(error, '同步日志加载失败'))
  } finally {
    loading.value = false
  }
}

function applyFilters() { page.value = 1; load() }
function resetFilters() { Object.assign(filters, { doc_key: '', log_level: '', log_status: '' }); applyFilters() }
function changePage(next: number) { page.value = next; load() }

function statusClass(status: string) {
  if (status === 'SUCCESS') return 'is-success'
  if (status === 'FAILED') return 'is-danger'
  if (status === 'PARTIAL') return 'is-warning'
  if (status === 'RUNNING') return 'is-info'
  return 'is-muted'
}

function statusLabel(status: string) {
  return statusOptions.find((item) => item.value === status)?.label || status || '—'
}

function triggerLabel(type?: string | null) {
  if (type === 'TIMER') return '自动调度'
  if (type === 'MANUAL') return '手动'
  if (type === 'FULL') return '全量'
  return type || '—'
}

onMounted(load)
</script>

<template>
  <div class="sync-log-tab">
    <section class="filter-deck filter-deck--compact">
      <div class="filter-grid filter-grid--log">
        <label><span>单据类型</span>
          <el-select v-model="filters.doc_key" clearable placeholder="全部单据">
            <el-option v-for="item in PRODUCTION_DOC_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <label><span>日志级别</span>
          <el-select v-model="filters.log_level" clearable placeholder="全部级别">
            <el-option v-for="item in levelOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <label><span>执行结果</span>
          <el-select v-model="filters.log_status" clearable placeholder="全部结果">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <div class="filter-actions filter-actions--bottom">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" :loading="loading" @click="applyFilters">查询日志</el-button>
        </div>
      </div>
    </section>

    <el-table v-loading="loading" :data="rows" stripe table-layout="fixed" empty-text="暂无同步日志">
      <el-table-column label="开始时间" width="160">
        <template #default="scope"><span class="mono-label">{{ scope.row.started_at || '—' }}</span></template>
      </el-table-column>
      <el-table-column label="单据" min-width="140">
        <template #default="scope"><div class="table-person"><strong>{{ scope.row.doc_name }}</strong><span>{{ scope.row.doc_key }}</span></div></template>
      </el-table-column>
      <el-table-column label="级别" width="80" align="center">
        <template #default="scope"><span class="status-pill" :class="scope.row.log_level === 'ROUND' ? 'is-info' : 'is-muted'">{{ scope.row.log_level === 'ROUND' ? '轮次' : '分片' }}</span></template>
      </el-table-column>
      <el-table-column label="结果" width="94" align="center">
        <template #default="scope"><span class="status-pill" :class="statusClass(scope.row.status)">{{ statusLabel(scope.row.status) }}</span></template>
      </el-table-column>
      <el-table-column label="触发" width="90" align="center">
        <template #default="scope">{{ triggerLabel(scope.row.trigger_type) }}</template>
      </el-table-column>
      <el-table-column label="时间窗" min-width="200">
        <template #default="scope"><span class="mono-label window-cell">{{ scope.row.window_start || '—' }} ~ {{ scope.row.window_end || '—' }}</span></template>
      </el-table-column>
      <el-table-column label="拉取/表头/明细" width="130" align="center">
        <template #default="scope"><span class="mono-label">{{ scope.row.bills_fetched }} / {{ scope.row.headers_upserted }} / {{ scope.row.items_upserted }}</span></template>
      </el-table-column>
      <el-table-column label="ERP删除" width="86" align="center">
        <template #default="scope"><span class="mono-label">{{ scope.row.items_erp_deleted }}</span></template>
      </el-table-column>
      <el-table-column label="未绑品号" width="90" align="center">
        <template #default="scope"><span class="status-pill" :class="scope.row.unbound_prd_count > 0 ? 'is-warning' : 'is-muted'">{{ scope.row.unbound_prd_count }}</span></template>
      </el-table-column>
      <el-table-column label="耗时" width="90" align="center">
        <template #default="scope"><span class="mono-label">{{ scope.row.duration_ms ?? '—' }} ms</span></template>
      </el-table-column>
      <el-table-column label="错误信息" min-width="200">
        <template #default="scope">
          <el-tooltip v-if="scope.row.error_msg" :content="scope.row.error_msg" placement="top">
            <span class="error-msg">{{ scope.row.error_msg }}</span>
          </el-tooltip>
          <span v-else>—</span>
        </template>
      </el-table-column>
    </el-table>

    <div class="detail-pagination">
      <el-pagination
        v-if="total > pageSize"
        background
        layout="prev, pager, next"
        :page-size="pageSize"
        :total="total"
        :current-page="page"
        @current-change="changePage"
      />
    </div>
  </div>
</template>

<style scoped>
.sync-log-tab { display: grid; gap: 16px; }
.filter-grid--log { grid-template-columns: 1.2fr 0.8fr 0.9fr auto; align-items: end; }
.status-pill.is-warning { color: #b0642a; border-color: #f0d5b5; background: #fff5e4; }
.window-cell { font-size: 10px; color: #68798c; }
.error-msg { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ad3e3e; font-size: 11px; vertical-align: bottom; }
@media (max-width: 1180px) {
  .filter-grid--log { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
