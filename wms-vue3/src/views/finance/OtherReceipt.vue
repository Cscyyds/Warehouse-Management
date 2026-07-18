<template>
  <ListTemplate
    ref="listTemplateRef"
    title="其他收款单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="单据编号"><el-input v-model="searchForm.receipt_no" placeholder="请输入" clearable style="width:170px" /></el-form-item>
        <el-form-item label="供应商"><el-input v-model="searchForm.supplier_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户"><el-input v-model="searchForm.customer_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="收款类型">
          <el-select v-model="searchForm.receipt_type" placeholder="请选择" clearable style="width:120px">
            <el-option label="客户收款" value="CUSTOMER_RECEIPT" />
            <el-option label="供应商收款" value="SUPPLIER_RECEIPT" />
            <el-option label="采购退款" value="PURCHASE_REFUND" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款方式">
          <el-select v-model="searchForm.collection_method" placeholder="请选择" clearable style="width:110px">
            <el-option label="现金" value="CASH" />
            <el-option label="银行转账" value="TRANSFER" />
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
        <el-table-column prop="receipt_no" label="单据编号" width="180" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.receipt_no }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="receipt_type_name" label="收款类型" width="110" show-overflow-tooltip />
        <el-table-column prop="subject_name" label="科目" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.subject_name }">{{ row.subject_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="receipt_date" label="收款日期" width="120" sortable="custom">
          <template #default="{ row }">{{ formatTableDate(row.receipt_date) }}</template>
        </el-table-column>
        <el-table-column prop="collection_method_name" label="收款方式" width="110" show-overflow-tooltip />
        <el-table-column prop="bank_account_name" label="收款银行" min-width="130" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.bank_account_name }">{{ row.bank_account_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column label="关联对象" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.customer_name">{{ row.customer_name }}</span>
            <span v-else-if="row.supplier_name">{{ row.supplier_name }}</span>
            <span v-else-if="row.purchase_return_no">{{ row.purchase_return_no }}</span>
            <span v-else class="cell-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="actual_receipt_amount" label="实收金额" width="120" align="right" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="warning" size="small" @click="handleVoid(row)" :disabled="row.status === 2">作废</el-button>
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
  getOtherReceiptList, searchOtherReceipts,
  voidOtherReceipt, deleteOtherReceipt,
  type OtherReceiptListItem
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'

const router = useRouter()
const listTemplateRef = ref<any>()
const tableData = ref<OtherReceiptListItem[]>([])
const loading = ref(false)
const searchForm = reactive({ receipt_no: '', supplier_name: '', customer_name: '', receipt_type: '', collection_method: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)



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
    const hasTextSearch = searchForm.receipt_no.trim() || searchForm.supplier_name.trim() || searchForm.customer_name.trim()
    if (hasTextSearch) {
      const fields: string[] = []
      const values: Record<string, string> = {}
      if (searchForm.receipt_no.trim()) { fields.push('receipt_no'); values['receipt_no'] = searchForm.receipt_no.trim() }
      if (searchForm.supplier_name.trim()) { fields.push('supplier_name'); values['supplier_name'] = searchForm.supplier_name.trim() }
      if (searchForm.customer_name.trim()) { fields.push('customer_name'); values['customer_name'] = searchForm.customer_name.trim() }
      const res = await searchOtherReceipts({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      let rows = res.data.items ?? []
      if (searchForm.receipt_type) rows = rows.filter((r: any) => r.receipt_type === searchForm.receipt_type)
      if (searchForm.collection_method) rows = rows.filter((r: any) => r.collection_method === searchForm.collection_method)
      tableData.value = rows
      pagination.total = rows.length
    } else {
      const res = await getOtherReceiptList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
        receipt_type: searchForm.receipt_type || undefined,
        collection_method: searchForm.collection_method || undefined,
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
  Object.assign(searchForm, { receipt_no: '', supplier_name: '', customer_name: '', receipt_type: '', collection_method: '' })
  handleSearch()
}
function handleAdd() { router.push({ path: '/common/add', query: { type: 'otherReceipt' } }) }
function handleEdit(row: OtherReceiptListItem) {
  sessionStorage.setItem('editData:otherReceipt', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'otherReceipt', id: row.other_receipt_id, mode: 'edit' } })
}

async function handleVoid(row: OtherReceiptListItem) {
  try {
    await ElMessageBox.confirm(`确认作废收款单「${row.receipt_no}」？作废后不可恢复。`, '提示', { confirmButtonText: '确认作废', type: 'warning' })
    await voidOtherReceipt(row.other_receipt_id)
    ElMessage.success('作废成功')
    loadData()
  } catch {
    // cancelled or error handled by interceptor
  }
}

async function handleDelete(row: OtherReceiptListItem) {
  try {
    await ElMessageBox.confirm(`确认删除收款单「${row.receipt_no}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteOtherReceipt(row.other_receipt_id)
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
