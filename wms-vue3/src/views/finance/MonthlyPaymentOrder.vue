<template>
  <ListTemplate
    ref="listTemplateRef"
    title="月结付款单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="单据编号"><el-input v-model="searchForm.payment_no" placeholder="请输入" clearable style="width:170px" /></el-form-item>
        <el-form-item label="供应商"><el-input v-model="searchForm.supplier_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="科目"><el-input v-model="searchForm.subject_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:110px">
            <el-option label="正常" value="1" />
            <el-option label="已作废" value="2" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
    </template>
    <template #table>
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="payment_no" label="单据编号" width="190" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.payment_no }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="subject_name" label="科目" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.subject_name }">{{ row.subject_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="payment_date" label="付款日期" width="120" sortable="custom">
          <template #default="{ row }">{{ formatTableDate(row.payment_date) }}</template>
        </el-table-column>
        <el-table-column prop="bank_account_name" label="付款银行" min-width="130" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.bank_account_name }">{{ row.bank_account_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="supplier_name" label="供应商" min-width="130" show-overflow-tooltip />
        <el-table-column prop="total_payment_amount" label="付款总额" width="120" align="right" sortable="custom" />
        <el-table-column prop="total_order_amount" label="订单总额" width="120" align="right" />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="handleItems(row)">明细</el-button>
            <el-button link type="warning" size="small" @click="handleVoid(row)" :disabled="row.status === 2">作废</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <MonthlyPaymentItemDialog
    v-model="itemDialogVisible"
    :order="itemDialogOrder"
    @changed="loadData"
  />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getMonthlyPaymentOrderList, searchMonthlyPaymentOrders,
  voidMonthlyPaymentOrder, deleteMonthlyPaymentOrder,
  type MonthlyPaymentOrderListItem
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import MonthlyPaymentItemDialog from './MonthlyPaymentItemDialog.vue'
import { formatTableDate } from '@/utils/date'

const router = useRouter()
const listTemplateRef = ref<any>()
const tableData = ref<MonthlyPaymentOrderListItem[]>([])
const loading = ref(false)
const searchForm = reactive({ payment_no: '', supplier_name: '', subject_name: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

const itemDialogVisible = ref(false)
const itemDialogOrder = ref<MonthlyPaymentOrderListItem | null>(null)

function statusTagType(status?: number) {
  if (status === 1) return 'success'
  if (status === 2) return 'info'
  return 'warning'
}

function statusLabel(status?: number) {
  if (status === 1) return '正常'
  if (status === 2) return '已作废'
  return '-'
}

async function loadData() {
  loading.value = true
  try {
    const hasSearch = searchForm.payment_no.trim() || searchForm.supplier_name.trim() || searchForm.subject_name.trim() || searchForm.status
    if (hasSearch) {
      const fields: string[] = []
      const values: Record<string, string> = {}
      if (searchForm.payment_no.trim()) { fields.push('payment_no'); values['payment_no'] = searchForm.payment_no.trim() }
      if (searchForm.supplier_name.trim()) { fields.push('supplier_name'); values['supplier_name'] = searchForm.supplier_name.trim() }
      if (searchForm.subject_name.trim()) { fields.push('subject_name'); values['subject_name'] = searchForm.subject_name.trim() }
      if (searchForm.status) { fields.push('status'); values['status'] = searchForm.status }
      const res = await searchMonthlyPaymentOrders({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items ?? []
      pagination.total = res.data.total ?? 0
    } else {
      const res = await getMonthlyPaymentOrderList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items ?? []
      pagination.total = res.data.total ?? 0
    }
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { payment_no: '', supplier_name: '', subject_name: '', status: '' })
  handleSearch()
}
function handleAdd() { router.push({ path: '/common/add', query: { type: 'monthlyPaymentOrder' } }) }
function handleEdit(row: MonthlyPaymentOrderListItem) {
  sessionStorage.setItem('editData:monthlyPaymentOrder', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'monthlyPaymentOrder', id: row.monthly_payment_id, mode: 'edit' } })
}
function handleItems(row: MonthlyPaymentOrderListItem) {
  itemDialogOrder.value = row
  itemDialogVisible.value = true
}

async function handleVoid(row: MonthlyPaymentOrderListItem) {
  try {
    await ElMessageBox.confirm(`确认作废月结付款单「${row.payment_no}」？作废后不可恢复。`, '提示', { confirmButtonText: '确认作废', type: 'warning' })
    await voidMonthlyPaymentOrder(row.monthly_payment_id)
    ElMessage.success('作废成功')
    loadData()
  } catch {
    // cancelled or error handled by interceptor
  }
}

async function handleDelete(row: MonthlyPaymentOrderListItem) {
  try {
    await ElMessageBox.confirm(`确认删除月结付款单「${row.payment_no}」？关联的明细将同步删除。`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteMonthlyPaymentOrder(row.monthly_payment_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {
    // cancelled or error handled by interceptor
  }
}

onMounted(loadData)
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
:deep(.el-table--small .el-table__cell) { padding: 8px 12px; }
:deep(.el-table--small th.el-table__cell) { padding: 10px 12px; }
</style>
