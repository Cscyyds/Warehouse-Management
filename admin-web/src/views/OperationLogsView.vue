<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { queryOperationLogs, searchOperationLogs } from '@/api/operationLogs'
import type { OperationLog } from '@/types/platform'

interface SearchCondition { field: string; value: string }

const loading = ref(false)
const rows = ref<OperationLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const detailOpen = ref(false)
const currentLog = ref<OperationLog | null>(null)
const filters = reactive({ tenant_id: '', admin_id: '', sort_by: 'operated_at', sort_order: 'DESC' })
const conditions = ref<SearchCondition[]>([{ field: 'log_title', value: '' }])

const searchFields = [
  ['log_title', '日志标题'], ['request_path', '请求路径'], ['log_type', '日志类型'],
  ['operator_user_id', '操作人 ID'], ['operator_user_name', '操作人姓名'],
  ['operator_identity', '操作人身份'], ['tenant_id', '租客 ID'], ['detail', '详情'],
]
const sortFields = [
  ['operated_at', '操作时间'], ['response_time_ms', '响应耗时'], ['success', '成功状态'],
  ['log_type', '日志类型'], ['tenant_id', '租客 ID'], ['operator_user_id', '操作人 ID'],
  ['operator_identity', '操作人身份'], ['request_path', '请求路径'], ['log_title', '日志标题'],
]

function activeConditions() {
  return conditions.value.filter((item) => item.field && item.value.trim())
}

async function load() {
  loading.value = true
  try {
    const common = {
      tenant_id: filters.tenant_id.trim() || undefined,
      admin_id: filters.admin_id.trim() || undefined,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order,
      page: page.value,
    }
    const active = activeConditions()
    const data = active.length
      ? await searchOperationLogs({
          ...common,
          search_field: JSON.stringify(active.map((item) => item.field)),
          search_value: JSON.stringify(Object.fromEntries(active.map((item) => [item.field, item.value.trim()]))),
        })
      : await queryOperationLogs(common)
    rows.value = data.log
    total.value = data.total
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error instanceof Error ? error.message : '操作日志加载失败')
  } finally {
    loading.value = false
  }
}

function applyFilters() { page.value = 1; load() }
function resetFilters() {
  Object.assign(filters, { tenant_id: '', admin_id: '', sort_by: 'operated_at', sort_order: 'DESC' })
  conditions.value = [{ field: 'log_title', value: '' }]
  applyFilters()
}
function addCondition() { conditions.value.push({ field: 'request_path', value: '' }) }
function removeCondition(index: number) { conditions.value.splice(index, 1); if (!conditions.value.length) addCondition() }
function changePage(next: number) { page.value = next; load() }
function showDetail(row: OperationLog) { currentLog.value = row; detailOpen.value = true }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—' }

onMounted(load)
</script>

<template>
  <div class="page-stack">
    <PageHeader eyebrow="AUDIT TRAIL" title="操作日志" description="按租客、管理员和业务字段追溯每一次平台操作。" marker="READ ONLY" />

    <section class="filter-deck">
      <div class="filter-deck__head"><div><span class="mono-label">QUERY CONTROL</span><h2>查询条件</h2></div><div class="filter-actions"><el-button @click="resetFilters">重置</el-button><el-button type="primary" :loading="loading" @click="applyFilters">查询日志</el-button></div></div>
      <div class="filter-grid">
        <label><span>租客 ID</span><el-input v-model="filters.tenant_id" clearable placeholder="全部租客" /></label>
        <label><span>管理员 ID</span><el-input v-model="filters.admin_id" clearable placeholder="全部管理员" /></label>
        <label><span>排序字段</span><el-select v-model="filters.sort_by"><el-option v-for="item in sortFields" :key="item[0]" :label="item[1]" :value="item[0]" /></el-select></label>
        <label><span>排序方向</span><el-segmented v-model="filters.sort_order" :options="[{ label: '降序', value: 'DESC' }, { label: '升序', value: 'ASC' }]" /></label>
      </div>
      <div class="condition-builder">
        <div class="condition-builder__title"><span>搜索条件</span><button type="button" @click="addCondition">＋ 添加条件</button></div>
        <div v-for="(condition, index) in conditions" :key="index" class="condition-row">
          <el-select v-model="condition.field"><el-option v-for="item in searchFields" :key="item[0]" :label="item[1]" :value="item[0]" /></el-select>
          <el-input v-model="condition.value" clearable placeholder="输入模糊匹配内容" @keyup.enter="applyFilters" />
          <button type="button" aria-label="删除条件" @click="removeCondition(index)">×</button>
        </div>
      </div>
    </section>

    <section class="data-panel">
      <div class="data-panel__head"><div><span class="mono-label">OPERATION RECORDS</span><h2>操作记录</h2></div><span class="record-count"><strong>{{ total }}</strong> 条记录</span></div>
      <el-table v-loading="loading" :data="rows" stripe table-layout="fixed" empty-text="没有符合条件的操作记录" @row-dblclick="showDetail">
        <el-table-column label="操作时间" width="168"><template #default="scope">{{ formatDate(scope.row.operated_at) }}</template></el-table-column>
        <el-table-column prop="log_title" label="操作" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作人" width="150"><template #default="scope"><div class="table-person"><strong>{{ scope.row.operator_user_name || '未知' }}</strong><span>{{ scope.row.operator_user_id || '—' }}</span></div></template></el-table-column>
        <el-table-column prop="tenant_id" label="租客 ID" width="148" show-overflow-tooltip />
        <el-table-column prop="request_path" label="请求路径" min-width="210" show-overflow-tooltip />
        <el-table-column prop="log_type" label="类型" width="90" />
        <el-table-column label="结果" width="88"><template #default="scope"><span class="status-pill" :class="scope.row.success === 1 ? 'is-success' : 'is-danger'">{{ scope.row.success === 1 ? '成功' : '失败' }}</span></template></el-table-column>
        <el-table-column label="耗时" width="92"><template #default="scope"><span class="mono-label">{{ scope.row.response_time_ms ?? '—' }} ms</span></template></el-table-column>
        <el-table-column label="操作" width="88" fixed="right"><template #default="scope"><el-button link type="primary" @click="showDetail(scope.row)">详情</el-button></template></el-table-column>
      </el-table>
      <div class="pagination-bar"><span>双击记录可快速打开详情</span><el-pagination background layout="prev, pager, next" :page-size="pageSize" :total="total" :current-page="page" @current-change="changePage" /></div>
    </section>

    <el-drawer v-model="detailOpen" title="操作日志详情" size="520px" class="detail-drawer">
      <div v-if="currentLog" class="log-detail">
        <div class="detail-hero"><span class="status-pill" :class="currentLog.success === 1 ? 'is-success' : 'is-danger'">{{ currentLog.success === 1 ? '执行成功' : '执行失败' }}</span><h3>{{ currentLog.log_title }}</h3><code>{{ currentLog.log_id }}</code></div>
        <dl><template v-for="(value, key) in currentLog" :key="key"><dt>{{ key }}</dt><dd>{{ value ?? '—' }}</dd></template></dl>
      </div>
    </el-drawer>
  </div>
</template>
