<template>
  <ListTemplate
    ref="listTemplateRef"
    title="其他付款单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="单据编号"><el-input v-model="searchForm.payment_no" placeholder="请输入" clearable style="width:170px" /></el-form-item>
        <el-form-item label="客户"><el-input v-model="searchForm.customer_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="供应商"><el-input v-model="searchForm.supplier_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="付款类型">
          <el-select v-model="searchForm.payment_type" placeholder="请选择" clearable style="width:130px">
            <el-option label="客户付款" value="CUSTOMER_PAYMENT" />
            <el-option label="供应商付款" value="SUPPLIER_PAYMENT" />
            <el-option label="销售退款" value="SALES_REFUND" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:100px">
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
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="payment_no" label="单据编号" width="180" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.payment_no }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="payment_type" label="付款类型" width="120">
          <template #default="{ row }">{{ paymentTypeLabel(row.payment_type) }}</template>
        </el-table-column>
        <el-table-column prop="subject_name" label="科目" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.subject_name }">{{ row.subject_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="payment_date" label="付款日期" width="120" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.payment_date) }}</template>
        </el-table-column>
        <el-table-column prop="payment_method" label="付款方式" width="110">
          <template #default="{ row }">{{ row.payment_method === 'CASH' ? '现金' : row.payment_method === 'TRANSFER' ? '银行转账' : '-' }}</template>
        </el-table-column>
        <el-table-column prop="bank_account_name" label="付款银行" min-width="130" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.bank_account_name }">{{ row.bank_account_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column label="关联对象" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.customer_name">{{ row.customer_name }}</span>
            <span v-else-if="row.supplier_name">{{ row.supplier_name }}</span>
            <span v-else-if="row.sales_return_no">{{ row.sales_return_no }}</span>
            <span v-else class="cell-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="actual_payment_amount" label="实付金额" show-overflow-tooltip width="120" align="right" sortable="custom" />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" :disabled="row.status === 2" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="warning" size="small" :disabled="row.status === 2" @click="handleVoid(row)">作废</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getOtherPaymentList, searchOtherPayments,
  voidOtherPayment, deleteOtherPayment,
  type OtherPaymentListItem
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'

const router = useRouter()
const listTemplateRef = ref<any>()
const tableData = ref<OtherPaymentListItem[]>([])
const loading = ref(false)
const searchForm = reactive({ payment_no: '', customer_name: '', supplier_name: '', payment_type: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

const fallbackData: OtherPaymentListItem[] = []

function paymentTypeLabel(type?: string) {
  if (type === 'CUSTOMER_PAYMENT') return '客户付款'
  if (type === 'SUPPLIER_PAYMENT') return '供应商付款'
  if (type === 'SALES_REFUND') return '销售退款'
  return '-'
}

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
    const hasTextSearch = searchForm.payment_no.trim() || searchForm.customer_name.trim() || searchForm.supplier_name.trim()
    if (hasTextSearch) {
      const fields: string[] = []
      const values: Record<string, string> = {}
      if (searchForm.payment_no.trim()) { fields.push('payment_no'); values['payment_no'] = searchForm.payment_no.trim() }
      if (searchForm.customer_name.trim()) { fields.push('customer_name'); values['customer_name'] = searchForm.customer_name.trim() }
      if (searchForm.supplier_name.trim()) { fields.push('supplier_name'); values['supplier_name'] = searchForm.supplier_name.trim() }
      if (searchForm.status) { fields.push('status'); values['status'] = searchForm.status }
      const res = await searchOtherPayments({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      let rows = res.data.items ?? []
      if (searchForm.payment_type) rows = rows.filter((r: any) => r.payment_type === searchForm.payment_type)
      tableData.value = rows
      pagination.total = rows.length
    } else {
      const res = await getOtherPaymentList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
        payment_type: searchForm.payment_type || undefined,
      })
      let rows = res.data.items ?? []
      if (searchForm.status) rows = rows.filter((r: any) => String(r.status) === searchForm.status)
      tableData.value = rows
      pagination.total = res.data.total ?? 0
    }
  } catch {
    tableData.value = fallbackData
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { payment_no: '', customer_name: '', supplier_name: '', payment_type: '', status: '' })
  handleSearch()
}
function handleAdd() { router.push({ path: '/common/add', query: { type: 'otherPayment' } }) }
function handleEdit(row: OtherPaymentListItem) {
  sessionStorage.setItem('editData:otherPayment', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'otherPayment', id: row.other_payment_id, mode: 'edit' } })
}

async function handleVoid(row: OtherPaymentListItem) {
  try {
    await ElMessageBox.confirm(`确认作废付款单「${row.payment_no}」？作废后不可恢复。`, '提示', { confirmButtonText: '确认作废', type: 'warning' })
    await voidOtherPayment(row.other_payment_id)
    ElMessage.success('作废成功')
    loadData()
  } catch {
    // cancelled or error handled by interceptor
  }
}

async function handleDelete(row: OtherPaymentListItem) {
  try {
    await ElMessageBox.confirm(`确认删除付款单「${row.payment_no}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteOtherPayment(row.other_payment_id)
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
:deep(.el-table--small .el-table__cell) { padding: 8px 12px !important; }
:deep(.el-table--small th.el-table__cell) { padding: 10px 12px !important; }
</style>
