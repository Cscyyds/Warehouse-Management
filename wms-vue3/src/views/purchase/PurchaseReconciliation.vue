<template>
  <ListTemplate
    title="采购对账单"
    :loading="loading"
    :show-export="true"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="采购对账单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="showCreateDialog"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="供应商">
          <el-input v-model="searchForm.supplier_name" placeholder="请输入" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="对账月份">
          <el-date-picker
            v-model="searchForm.reconciliation_month"
            type="month"
            value-format="YYYY-MM"
            placeholder="请选择"
            clearable
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>

    <template #actions>
      <el-button type="primary" @click="showCreateDialog"><el-icon><Plus /></el-icon>新增</el-button>
    </template>

    <template #table>
      <el-table :data="tableData" stripe size="small" style="width: 100%" show-summary :summary-method="getSummaries">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="reconciliation_no" label="单据编号" min-width="140" show-overflow-tooltip />
        <el-table-column prop="supplier_name" label="供应商" min-width="130" />
        <el-table-column prop="reconciliation_month" label="对账月份" width="100" align="center" />
        <el-table-column prop="reconciliation_amount" label="对账金额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.reconciliation_amount) }}</template>
        </el-table-column>
        <el-table-column prop="discount_rate" label="折扣(%)" width="90" align="center" />
        <el-table-column prop="discount_amount" label="折扣金额" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.discount_amount) }}</template>
        </el-table-column>
        <el-table-column prop="deduction_amount" label="抵扣金额" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.deduction_amount) }}</template>
        </el-table-column>
        <el-table-column prop="receivable_amount" label="应收金额" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.receivable_amount) }}</template>
        </el-table-column>
        <el-table-column prop="audit_status" label="审核状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="auditTagType(row.audit_status)" size="small">{{ auditStatusLabel(row.audit_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="showDetail(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <!-- 新增对账单弹窗 -->
  <ReconciliationCreateDialog
    v-model="createDialogVisible"
    @success="loadData"
  />

  <!-- 对账单详情弹窗 -->
  <ReconciliationDetailDialog
    v-model="detailDialogVisible"
    :reconciliation-id="currentReconciliationId"
    @updated="loadData"
  />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { getPurchaseReconciliationList } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import ReconciliationCreateDialog from './ReconciliationCreateDialog.vue'
import ReconciliationDetailDialog from './ReconciliationDetailDialog.vue'
import { formatTableDate } from '@/utils/date'

const loading = ref(false)
const tableData = ref<any[]>([])
const searchForm = reactive({ supplier_name: '', reconciliation_month: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const currentReconciliationId = ref('')

const getSummaries = createAmountSummary(['reconciliation_amount', 'discount_amount', 'deduction_amount', 'receivable_amount'])

const exportColumns = [
  { key: 'reconciliation_no', label: '单据编号' },
  { key: 'supplier_name', label: '供应商' },
  { key: 'reconciliation_month', label: '对账月份' },
  { key: 'reconciliation_amount', label: '对账金额' },
  { key: 'discount_rate', label: '折扣比例(%)' },
  { key: 'discount_amount', label: '折扣金额' },
  { key: 'deduction_amount', label: '抵扣金额' },
  { key: 'receivable_amount', label: '应收金额' },
  { key: 'created_at', label: '创建时间' }
]

function formatMoney(val: string | number | null | undefined) {
  if (val == null || val === '') return '-'
  const n = Number(val)
  return isNaN(n) ? val : n.toFixed(2)
}

function auditStatusLabel(status: number) {
  const map: Record<number, string> = { 0: '未审核', 1: '审核通过', 2: '已反审核', 3: '审核失败' }
  return map[status] ?? '未知'
}

function auditTagType(status: number) {
  const map: Record<number, string> = { 0: 'warning', 1: 'success', 2: 'info', 3: 'danger' }
  return map[status] ?? 'info'
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: pagination.page, page_size: pagination.pageSize }
    if (searchForm.reconciliation_month) params.reconciliation_month = searchForm.reconciliation_month
    const res = await getPurchaseReconciliationList(params)
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
function handleReset() { Object.assign(searchForm, { supplier_name: '', reconciliation_month: '' }); handleSearch() }

function showCreateDialog() { createDialogVisible.value = true }
function showDetail(row: any) {
  currentReconciliationId.value = row.reconciliation_id
  detailDialogVisible.value = true
}

onMounted(() => { loadData() })
</script>
