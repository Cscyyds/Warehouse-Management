<template>
  <ListTemplate
    title="月结收款单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="单据编号"><el-input v-model="searchForm.receipt_no" placeholder="请输入" clearable style="width:170px" /></el-form-item>
        <el-form-item label="客户"><el-input v-model="searchForm.customer_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="科目"><el-input v-model="searchForm.subject_name" placeholder="请输入" clearable style="width:130px" /></el-form-item>
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
        <el-table-column prop="receipt_no" label="单据编号" width="190" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.receipt_no }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="subject_name" label="科目" min-width="110" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.subject_name }">{{ row.subject_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="receipt_date" label="收款日期" width="115" sortable="custom">
          <template #default="{ row }">{{ formatTableDate(row.receipt_date) }}</template>
        </el-table-column>
        <el-table-column prop="bank_account_name" label="收款银行" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.bank_account_name }">{{ row.bank_account_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户名称" min-width="130" show-overflow-tooltip />
        <el-table-column prop="total_receipt_amount" label="收款总额" width="115" align="right" sortable="custom" />
        <el-table-column prop="total_order_amount" label="订单总额" width="115" align="right" />
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

  <MonthlyReceiptItemDialog
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
  getMonthlyReceiptOrderList, searchMonthlyReceiptOrders,
  voidMonthlyReceiptOrder, deleteMonthlyReceiptOrder,
  type MonthlyReceiptListItem
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import MonthlyReceiptItemDialog from './MonthlyReceiptItemDialog.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'

const router = useRouter()
const tableData = ref<MonthlyReceiptListItem[]>([])
const loading = ref(false)
const searchForm = reactive({ receipt_no: '', customer_name: '', subject_name: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const itemDialogVisible = ref(false)
const itemDialogOrder = ref<MonthlyReceiptListItem | null>(null)

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
    const hasSearch = searchForm.receipt_no.trim() || searchForm.customer_name.trim() || searchForm.subject_name.trim() || searchForm.status
    if (hasSearch) {
      const fields: string[] = []
      const values: Record<string, string> = {}
      if (searchForm.receipt_no.trim()) { fields.push('receipt_no'); values['receipt_no'] = searchForm.receipt_no.trim() }
      if (searchForm.customer_name.trim()) { fields.push('customer_name'); values['customer_name'] = searchForm.customer_name.trim() }
      if (searchForm.subject_name.trim()) { fields.push('subject_name'); values['subject_name'] = searchForm.subject_name.trim() }
      const res = await searchMonthlyReceiptOrders({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      const rows = res.data.items ?? []
      tableData.value = searchForm.status ? rows.filter((r: any) => String(r.status) === searchForm.status) : rows
      pagination.total = res.data.total ?? 0
    } else {
      const res = await getMonthlyReceiptOrderList({
        page: pagination.page,
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
function handleReset() { Object.assign(searchForm, { receipt_no: '', customer_name: '', subject_name: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/finance/gift/add' }) }
function handleEdit(row: MonthlyReceiptListItem) {
  router.push({ path: '/common/add', query: { type: 'monthlyReceiptOrder', id: row.monthly_receipt_id, mode: 'edit' } })
}
function handleItems(row: MonthlyReceiptListItem) {
  itemDialogOrder.value = row
  itemDialogVisible.value = true
}

async function handleVoid(row: MonthlyReceiptListItem) {
  try {
    await ElMessageBox.confirm(`确认作废收款单「${row.receipt_no}」？作废后不可恢复。`, '作废确认', { type: 'warning', confirmButtonText: '确认作废', cancelButtonText: '取消' })
    await voidMonthlyReceiptOrder(row.monthly_receipt_id)
    ElMessage.success('作废成功')
    loadData()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '作废失败')
  }
}

async function handleDelete(row: MonthlyReceiptListItem) {
  try {
    await ElMessageBox.confirm(`确认删除收款单「${row.receipt_no}」？`, '删除确认', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    await deleteMonthlyReceiptOrder(row.monthly_receipt_id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(() => { loadData() })
</script>
