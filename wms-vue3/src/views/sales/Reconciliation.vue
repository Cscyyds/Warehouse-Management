<template>
  <ListTemplate
    title="销售对账单"
    :loading="loading"
    :show-export="true"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="销售对账单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="showCreateDialog"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="客户名称">
          <el-input v-model="searchForm.customer_name" placeholder="请输入" clearable style="width:140px" />
        </el-form-item>
        <el-form-item label="对账月份">
          <el-date-picker
            v-model="searchForm.reconciliation_month"
            type="month"
            value-format="YYYY-MM"
            placeholder="请选择"
            clearable
            style="width:140px"
          />
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="searchForm.audit_status" placeholder="全部" clearable style="width:100px">
            <el-option label="未审核" :value="0" />
            <el-option label="审核通过" :value="1" />
            <el-option label="已反审核" :value="2" />
            <el-option label="审核失败" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>

    <template #actions>
      <el-button :disabled="!selection.length" :loading="batchAuditing" @click="batchAudit">批量审核</el-button>
      <el-button type="primary" @click="showCreateDialog"><el-icon><Plus /></el-icon>新增</el-button>
    </template>

    <template #table>
      <el-table border :data="filteredData" stripe size="small" style="width:100%" show-summary :summary-method="getSummaries" @selection-change="onSelection">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="reconciliation_no" label="单据编号" min-width="150" show-overflow-tooltip />
        <el-table-column prop="customer_name" label="客户" min-width="130" show-overflow-tooltip />
        <el-table-column prop="reconciliation_month" label="对账月份" width="100" align="center" show-overflow-tooltip />
        <el-table-column prop="reconciliation_amount" label="对账金额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.reconciliation_amount) }}</template>
        </el-table-column>
        <el-table-column prop="discount_rate" label="折扣(%)" width="80" align="center" show-overflow-tooltip />
        <el-table-column prop="discount_amount" label="折扣金额" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.discount_amount) }}</template>
        </el-table-column>
        <el-table-column prop="deduction_amount" label="抵扣金额" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.deduction_amount) }}</template>
        </el-table-column>
        <el-table-column prop="receivable_amount" label="应收金额" width="150" align="right">
          <template #default="{ row }">{{ formatMoney(row.receivable_amount) }}</template>
        </el-table-column>
        <el-table-column prop="audit_status" label="审核状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="auditTagType(row.audit_status)" size="small">{{ auditStatusLabel(row.audit_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="200"  show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="showDetail(row)">查看</el-button>
            <el-button v-if="row.audit_status === 0" link type="success" size="small" @click="audit(row, 1)">审核</el-button>
            <el-button v-if="row.audit_status === 0" link type="danger" size="small" @click="audit(row, 3)">审核失败</el-button>
            <el-button v-if="row.audit_status === 1" link type="warning" size="small" @click="audit(row, 2)">反审核</el-button>
            <el-button v-if="row.audit_status === 2 || row.audit_status === 3" link type="info" size="small" @click="audit(row, 0)">重置</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <SalesReconciliationDetailDialog
    v-model="detailDialogVisible"
    :reconciliation-id="currentId"
    @updated="loadData"
  />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getSalesReconciliationList, auditSalesReconciliation } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import SalesReconciliationDetailDialog from './SalesReconciliationDetailDialog.vue'
import { formatTableDate } from '@/utils/date'

const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])
const searchForm = reactive({ customer_name: '', reconciliation_month: '', audit_status: '' as number | '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const detailDialogVisible = ref(false)
const currentId = ref('')
const selection = ref<any[]>([])
const batchAuditing = ref(false)
const opt_width = 300

const getSummaries = createAmountSummary(['reconciliation_amount', 'discount_amount', 'deduction_amount', 'receivable_amount'])

const exportColumns = [
  { key: 'reconciliation_no', label: '单据编号' },
  { key: 'customer_name', label: '客户' },
  { key: 'reconciliation_month', label: '对账月份' },
  { key: 'reconciliation_amount', label: '对账金额' },
  { key: 'discount_rate', label: '折扣比例(%)' },
  { key: 'discount_amount', label: '折扣金额' },
  { key: 'deduction_amount', label: '抵扣金额' },
  { key: 'receivable_amount', label: '应收金额' },
  { key: 'created_at', label: '创建时间' },
]

function formatMoney(val: string | number | null | undefined) {
  if (val == null || val === '') return '-'
  const n = Number(val)
  return isNaN(n) ? String(val) : n.toFixed(2)
}

function auditStatusLabel(status: number) {
  const map: Record<number, string> = { 0: '未审核', 1: '审核通过', 2: '已反审核', 3: '审核失败' }
  return map[status] ?? '未知'
}

function auditTagType(status: number) {
  const map: Record<number, string> = { 0: 'warning', 1: 'success', 2: 'info', 3: 'danger' }
  return map[status] ?? 'info'
}

// 客户名前端过滤（后端 list 接口仅支持 customer_id 过滤）
const filteredData = computed(() => {
  if (!searchForm.customer_name.trim()) return tableData.value
  return tableData.value.filter(r =>
    r.customer_name?.includes(searchForm.customer_name.trim())
  )
})

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: pagination.page, page_size: pagination.pageSize }
    if (searchForm.reconciliation_month) params.reconciliation_month = searchForm.reconciliation_month
    if (searchForm.audit_status !== '') params.audit_status = searchForm.audit_status
    const res = await getSalesReconciliationList(params)
    tableData.value = res.data.items || []
    pagination.total = res.data.total || 0
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { customer_name: '', reconciliation_month: '', audit_status: '' })
  handleSearch()
}

function showCreateDialog() { router.push('/sales/reconciliation/add') }
function showDetail(row: any) {
  currentId.value = row.reconciliation_id
  detailDialogVisible.value = true
}

function onSelection(rows: any[]) { selection.value = rows }

async function audit(row: any, status: 0 | 1 | 2 | 3) {
  const actionMap: Record<number, string> = { 0: '重置', 1: '审核', 2: '反审核', 3: '审核失败' }
  const action = actionMap[status] || '操作'
  try { await ElMessageBox.confirm(`确认${action} ${row.reconciliation_no}？`, '提示') } catch { return }
  try {
    await auditSalesReconciliation([row.reconciliation_id], status)
    ElMessage.success(`${action}成功`)
    loadData()
  } catch { /* 拦截器已提示错误 */ }
}

async function batchAudit() {
  const pending = selection.value.filter(r => r.audit_status === 0)
  if (!pending.length) { ElMessage.warning('请选择待审核（未审核）的对账单'); return }
  const skipped = selection.value.length - pending.length
  try {
    await ElMessageBox.confirm(`确认审核选中的 ${pending.length} 张待审核对账单${skipped ? `（另有 ${skipped} 张非待审核已跳过）` : ''}？`, '批量审核')
  } catch { return }
  batchAuditing.value = true
  try {
    await auditSalesReconciliation(pending.map(r => r.reconciliation_id), 1)
    selection.value = []
    ElMessage.success(`批量审核成功 ${pending.length} 张`)
    loadData()
  } catch { selection.value = [] } finally { batchAuditing.value = false }
}

onMounted(() => { loadData() })
</script>
