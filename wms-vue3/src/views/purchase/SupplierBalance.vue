<template>
  <ListTemplate title="供应商余额表" :show-add="false" :show-export="fields.confirmed.value" :export-columns="visibleColumns" :export-data="tableData" export-file-name="供应商余额表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline>
        <el-form-item label="供应商"><el-input v-model="searchForm.supplier_name" clearable @keyup.enter="handleSearch" /></el-form-item>
        <el-form-item label="所属地区"><el-input v-model="searchForm.area_name" clearable @keyup.enter="handleSearch" /></el-form-item>
        <el-form-item label="采购员"><el-input v-model="searchForm.purchaser_user_name" clearable @keyup.enter="handleSearch" /></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-alert v-if="fields.hiddenPaths.value.length" title="部分信息受角色权限限制，已隐藏" type="info" :closable="false" />
      <el-alert v-if="loadFailed" title="余额数据加载失败，请刷新重试" type="warning" :closable="false" />
      <div class="balance-totals">
        <div v-for="metric in visibleMetrics" :key="metric.key" class="balance-total"><span>{{ metric.label }}</span><strong>{{ money(summary[metric.key]) }}</strong></div>
      </div>
      <div v-if="visibleMetrics.length" class="balance-note">汇总包含本次筛选范围内的全部供应商，不随分页变化。</div>
      <el-table ref="tableRef" :data="tableData" v-loading="loading" border stripe @sort-change="handleSortChange">
        <el-table-column v-for="column in visibleColumns" :key="column.key" :prop="column.key" :label="column.label" :sortable="column.sortable ? 'custom' : false" :min-width="column.key === 'supplier_name' ? 160 : 110" show-overflow-tooltip>
          <template #default="{ row }"><span>{{ column.money ? money(row[column.key]) : column.key === 'is_monthly_settlement' ? (row.is_monthly_settlement === 1 ? '是' : '否') : row[column.key] ?? '-' }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right"><template #default="{ row }"><el-button v-perm="'GET /api/v1/tenant-suppliers/balance-logs/detail-query'" link type="primary" @click="openLogs(row)">余额流水</el-button></template></el-table-column>
      </el-table>
    </template>
  </ListTemplate>
  <el-dialog v-model="logsVisible" :title="`${logSupplierName || '供应商'} · 余额流水`" width="min(1200px, 95vw)" :close-on-click-modal="false" @closed="closeLogs">
    <el-alert v-if="logFields.hiddenPaths.value.length" title="部分信息受角色权限限制，已隐藏" type="info" :closable="false" />
    <el-alert v-if="logsFailed" title="流水加载失败，请刷新重试" type="warning" :closable="false" />
    <p v-if="logFields.canView('current_balance')">当前余额：<strong>{{ money(logData.current_balance) }}</strong></p>
    <el-form :model="logSearch" inline>
      <el-form-item label="单据编号"><el-input v-model="logSearch.biz_no" clearable style="width:150px" /></el-form-item>
      <el-form-item label="备注"><el-input v-model="logSearch.remark" clearable style="width:150px" /></el-form-item>
      <el-form-item label="操作人"><el-input v-model="logSearch.created_by_name" clearable style="width:120px" /></el-form-item>
      <el-form-item label="日期"><el-date-picker v-model="logDates" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" style="width:240px" /></el-form-item>
      <el-form-item><el-button type="primary" @click="searchLogs">查询</el-button><el-button @click="resetLogs">重置</el-button></el-form-item>
    </el-form>
    <div v-loading="logsLoading">
      <el-empty v-if="!logsFailed && !logsLoading && !logData.daily_groups?.length" description="暂无余额流水" />
      <section v-for="group in logData.daily_groups || []" :key="group.date" class="balance-day">
        <div class="day-summary"><strong>{{ group.date }}</strong><span v-for="metric in dayMetrics.filter(metric => logFields.canView(`daily_groups[].${metric.key}`))" :key="metric.key">{{ metric.label }}：{{ money(group[metric.key]) }}</span></div>
        <el-table :data="group.details || []" border stripe size="small">
          <el-table-column prop="biz_no" label="单据编号" min-width="150" show-overflow-tooltip />
          <el-table-column prop="biz_type" label="业务类型" width="120" show-overflow-tooltip />
          <el-table-column prop="record_type" label="变动类型" width="100" />
          <el-table-column v-for="metric in detailMetrics.filter(metric => logFields.canView(`daily_groups[].details[].${metric.key}`))" :key="metric.key" :label="metric.label" width="125" align="right"><template #default="{ row }">{{ money(row[metric.key]) }}</template></el-table-column>
          <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
          <el-table-column prop="created_by_name" label="操作人" width="100" />
          <el-table-column prop="created_at" label="时间" width="170"><template #default="{ row }">{{ formatTableDate(row.created_at) }}</template></el-table-column>
        </el-table>
      </section>
    </div>
    <div class="log-pagination"><span>共 {{ logPagination.total }} 个日期</span><el-pagination v-model:current-page="logPagination.page" :page-size="logPagination.pageSize" :total="logPagination.total" layout="prev, pager, next" @current-change="loadLogs" /></div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, reactive, ref, watch } from 'vue'
import { getSupplierBalanceSummary, searchSupplierBalanceSummary, getSupplierBalanceLogs, searchSupplierBalanceLogs } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useSensitiveFields } from '@/composables/useSensitiveFields'
import { useTableSort } from '@/composables/useTableSort'
import { usePermissionStore } from '@/stores/permission'
import { buildSearchParams } from '@/utils/data'
import { formatTableDate } from '@/utils/date'
import { useAgentPage } from '@/composables/useAgentPage'
import type { WmsAgentActionDefinition } from '@/agent/types'
import { z } from 'zod'

defineOptions({ name: 'SupplierBalance' })
const session = localStorage.getItem('token')
const permission = usePermissionStore()
const loading = ref(false), loadFailed = ref(false), tableRef = ref<any>()
const tableData = ref<Record<string, any>[]>([]), summary = ref<Record<string, any>>({})
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const searchForm = reactive({ supplier_name: '', area_name: '', purchaser_user_name: '' })
const searchParams = computed(() => buildSearchParams(searchForm))
const interfacePath = computed(() => searchParams.value.search_field === '[]' ? '/tenant-suppliers/balance-summary/query' : '/tenant-suppliers/balance-summary/search')
const fields = useSensitiveFields({ interfacePath: () => interfacePath.value })
const { sortBy, sortOrder, handleSortChange, clearRestrictedSort } = useTableSort(loadData, key => key !== 'balance' || (fields.confirmed.value && fields.canView('suppliers[].balance')))
const columns = [
  { key: 'supplier_name', label: '供应商', sortable: true }, { key: 'area_name', label: '所属地区', sortable: true },
  { key: 'balance', label: '当前余额', money: true, sortable: true }, { key: 'is_monthly_settlement', label: '月结' },
  { key: 'monthly_days', label: '月结天数', sortable: true }, { key: 'settlement_day', label: '结算日', sortable: true }, { key: 'purchaser_user_name', label: '采购员', sortable: true },
]
const visibleColumns = computed(() => columns.filter(column => fields.canView(`suppliers[].${column.key}`)))
const metrics = [{ key: 'global_balance', label: '余额合计' }, { key: 'global_positive_balance', label: '正余额合计' }, { key: 'global_negative_balance', label: '负余额合计' }]
const visibleMetrics = computed(() => metrics.filter(metric => fields.canView(metric.key)))
let sequence = 0, logSequence = 0
function money(value: unknown): string {
  if (value == null || String(value).trim() === '' || !Number.isFinite(Number(value))) return '-'
  return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
async function loadData(): Promise<boolean> {
  const current = ++sequence
  loading.value = true; loadFailed.value = false
  try {
    await fields.refresh()
    if (current !== sequence || session !== localStorage.getItem('token')) return false
    if (clearRestrictedSort()) tableRef.value?.clearSort()
    const params = { page: pagination.page, page_size: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined }
    const response = interfacePath.value.endsWith('/search') ? await searchSupplierBalanceSummary({ ...params, ...searchParams.value }) : await getSupplierBalanceSummary(params)
    if (current !== sequence || session !== localStorage.getItem('token')) return false
    fields.setResponse(response.data)
    if (clearRestrictedSort()) { tableRef.value?.clearSort(); return loadData() }
    const safe = fields.sanitizeOutput(response.data)
    summary.value = safe; tableData.value = safe.suppliers || []
    pagination.total = safe.total ?? 0
    return true
  } catch {
    if (current !== sequence) return false
    summary.value = {}; tableData.value = []; pagination.total = 0; loadFailed.value = true
    return false
  } finally { if (current === sequence) loading.value = false }
}
function handleSearch() { pagination.page = 1; void loadData() }
function handleReset() { Object.keys(searchForm).forEach(key => { searchForm[key as keyof typeof searchForm] = '' }); handleSearch() }

const logsVisible = ref(false), logsLoading = ref(false), logsFailed = ref(false)
const logSupplierId = ref(''), logSupplierName = ref(''), logData = ref<Record<string, any>>({})
const logPagination = reactive({ page: 1, pageSize: 20, total: 0 })
const logSearch = reactive({ biz_no: '', remark: '', created_by_name: '' })
const logDates = ref<[string, string] | null>(null)
const logParams = computed(() => buildSearchParams({ ...logSearch, start_time: logDates.value?.[0] ? `${logDates.value[0]}T00:00:00` : undefined, end_time: logDates.value?.[1] ? `${logDates.value[1]}T23:59:59.999999` : undefined }))
const logInterface = computed(() => logParams.value.search_field === '[]' ? '/tenant-suppliers/balance-logs/detail-query' : '/tenant-suppliers/balance-logs/detail-search')
const logFields = useSensitiveFields({ interfacePath: () => logInterface.value, enabled: () => logsVisible.value })
const dayMetrics = [{ key: 'day_start_balance', label: '期初' }, { key: 'day_end_balance', label: '期末' }, { key: 'day_change_amount', label: '净变动' }]
const detailMetrics = [{ key: 'amount', label: '变动金额' }, { key: 'before_amount', label: '变动前' }, { key: 'after_amount', label: '变动后' }]
function openLogs(row: Record<string, any>) {
  if (!permission.hasUrlPerm('GET /api/v1/tenant-suppliers/balance-logs/detail-query')) return
  logSequence++; logData.value = {}; logSupplierId.value = String(row.supplier_id); logSupplierName.value = String(row.supplier_name || '')
  Object.keys(logSearch).forEach(key => { logSearch[key as keyof typeof logSearch] = '' }); logDates.value = null
  logPagination.page = 1; logPagination.total = 0; logsVisible.value = true
  void loadLogs()
}
async function loadLogs() {
  if (!logsVisible.value || !logSupplierId.value) return
  const current = ++logSequence, supplierId = logSupplierId.value
  logsLoading.value = true; logsFailed.value = false
  try {
    await logFields.refresh()
    if (current !== logSequence || !logsVisible.value || session !== localStorage.getItem('token')) return
    const params = { supplier_id: supplierId, page: logPagination.page, page_size: logPagination.pageSize }
    const response = logInterface.value.endsWith('/detail-search') ? await searchSupplierBalanceLogs({ ...params, ...logParams.value }) : await getSupplierBalanceLogs(params)
    if (current !== logSequence || !logsVisible.value || supplierId !== logSupplierId.value || session !== localStorage.getItem('token')) return
    logFields.setResponse(response.data); logData.value = logFields.sanitizeOutput(response.data)
    logPagination.total = response.data.total ?? 0; logPagination.pageSize = response.data.page_size ?? 20
  } catch {
    if (current !== logSequence) return
    logData.value = {}; logPagination.total = 0; logsFailed.value = true
  } finally { if (current === logSequence) logsLoading.value = false }
}
function searchLogs() { logPagination.page = 1; void loadLogs() }
function resetLogs() { Object.keys(logSearch).forEach(key => { logSearch[key as keyof typeof logSearch] = '' }); logDates.value = null; searchLogs() }
function closeLogs() { if (logsVisible.value) return; logSequence++; logData.value = {}; logsLoading.value = false }
watch(logsVisible, visible => { if (!visible) closeLogs() })
const searchSchema = z.object({ supplierName: z.string().trim().optional(), areaName: z.string().trim().optional(), purchaserName: z.string().trim().optional(), page: z.number().int().positive().optional() })
const supplierBalanceSearchAction = {
  id: 'supplier-balance.search', title: '查询供应商余额', description: '按供应商、所属地区和采购员查询供应商往来余额。', inputSchema: searchSchema,
  inputGuide: 'supplierName?: string, areaName?: string, purchaserName?: string, page?: positive integer', risk: 'read', confirmation: 'none',
  execute: async (input, context) => {
    context.signal.throwIfAborted()
    Object.assign(searchForm, { supplier_name: input.supplierName ?? '', area_name: input.areaName ?? '', purchaser_user_name: input.purchaserName ?? '' })
    pagination.page = input.page ?? 1
    if (!await loadData()) throw new Error('供应商余额查询失败，请刷新重试')
    context.signal.throwIfAborted()
    return { total: pagination.total, visible: tableData.value.length, suppliers: tableData.value.slice(0, 3) }
  },
  summarizeResult: ({ total, visible, suppliers }) => [
    `供应商余额查询完成，共${total}条，当前页显示${visible}条。`,
    ...suppliers.map(supplier => `${supplier.supplier_name || '-'}${fields.canView('suppliers[].balance') ? `，余额 ${money(supplier.balance)}` : ''}`),
  ].join('\n'),
} satisfies WmsAgentActionDefinition<z.infer<typeof searchSchema>, { total: number; visible: number; suppliers: Record<string, any>[] }>
useAgentPage({ id: 'purchase.supplier-balance.list', title: '供应商余额表', routePath: '/purchase/report/supplier-balance', description: '查询供应商往来余额与按天分组的流水。', getContext: () => ({ visibleSuppliers: tableData.value.slice(0, 10).map(supplier => ({ supplierId: supplier.supplier_id, supplierName: supplier.supplier_name, ...(fields.canView('suppliers[].balance') && supplier.balance != null ? { balance: supplier.balance } : {}) })) }) }, [supplierBalanceSearchAction])
let firstActivation = true
onActivated(() => { if (firstActivation) { firstActivation = false; return }; if (logsVisible.value) void loadLogs() })
onDeactivated(() => { sequence++; logSequence++; loading.value = false; logsLoading.value = false })
onMounted(loadData)
</script>

<style scoped>
.balance-totals { display: flex; flex-wrap: wrap; gap: 16px; margin: 16px 0 8px; }
.balance-total { min-width: 180px; padding: 14px 20px; border: 1px solid var(--border-color); border-radius: 8px; display: flex; flex-direction: column; gap: 8px; }
.balance-total span, .balance-note { color: var(--text-secondary); font-size: 13px; }
.balance-total strong { font-size: 22px; }
.balance-note { margin-bottom: 14px; }
.balance-day { margin: 16px 0; }
.day-summary { display: flex; flex-wrap: wrap; gap: 18px; margin-bottom: 10px; }
.log-pagination { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 16px; }
</style>
