<template>
  <ListTemplate
    ref="listTemplateRef"
    title="收款单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="单据编号"><el-input v-model="searchForm.receipt_no" placeholder="请输入" clearable style="width:170px" /></el-form-item>
        <el-form-item label="科目"><el-input v-model="searchForm.subject_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户"><el-input v-model="searchForm.customer_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
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
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="receipt_no" label="单据编号" width="180" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.receipt_no }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="subject_name" label="科目" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.subject_name }">{{ row.subject_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="collection_date" label="收款日期" width="120" sortable="custom">
          <template #default="{ row }">{{ formatTableDate(row.collection_date) }}</template>
        </el-table-column>
        <el-table-column prop="bank_account_name" label="收款银行" min-width="130" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.bank_account_name }">{{ row.bank_account_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户名称" min-width="130" show-overflow-tooltip />
        <el-table-column prop="total_receipt_amount" label="收款总额" width="120" align="right" sortable="custom" />
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

  <CollectionReceiptItemDialog
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
  getCollectionReceiptList, searchCollectionReceipts,
  voidCollectionReceipt, deleteCollectionReceipt,
  type CollectionReceiptListItem
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'
import CollectionReceiptItemDialog from './CollectionReceiptItemDialog.vue'

const router = useRouter()
const listTemplateRef = ref<any>()
const tableData = ref<CollectionReceiptListItem[]>([])
const loading = ref(false)
const searchForm = reactive({ receipt_no: '', subject_name: '', customer_name: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

const itemDialogVisible = ref(false)
const itemDialogOrder = ref<CollectionReceiptListItem | null>(null)

function handleItems(row: CollectionReceiptListItem) {
  itemDialogOrder.value = row
  itemDialogVisible.value = true
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
    const hasSearch = searchForm.receipt_no.trim() || searchForm.subject_name.trim() || searchForm.customer_name.trim() || searchForm.status
    if (hasSearch) {
      const fields: string[] = []
      const values: Record<string, string> = {}
      if (searchForm.receipt_no.trim()) { fields.push('receipt_no'); values['receipt_no'] = searchForm.receipt_no.trim() }
      if (searchForm.subject_name.trim()) { fields.push('subject_name'); values['subject_name'] = searchForm.subject_name.trim() }
      if (searchForm.customer_name.trim()) { fields.push('customer_name'); values['customer_name'] = searchForm.customer_name.trim() }
      if (searchForm.status) { fields.push('status'); values['status'] = searchForm.status }
      const res = await searchCollectionReceipts({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items ?? []
      pagination.total = res.data.total ?? 0
    } else {
      const res = await getCollectionReceiptList({
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
function handleReset() { Object.assign(searchForm, { receipt_no: '', subject_name: '', customer_name: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'collectionReceipt' } }) }
function handleEdit(row: CollectionReceiptListItem) {
  sessionStorage.setItem('editData:collectionReceipt', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'collectionReceipt', id: row.receipt_id, mode: 'edit' } })
}

async function handleVoid(row: CollectionReceiptListItem) {
  try {
    await ElMessageBox.confirm(`确认作废收款单「${row.receipt_no}」？作废后不可恢复。`, '作废确认', { type: 'warning', confirmButtonText: '确认作废', cancelButtonText: '取消' })
    await voidCollectionReceipt(row.receipt_id)
    ElMessage.success('作废成功')
    loadData()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '作废失败')
  }
}

async function handleDelete(row: CollectionReceiptListItem) {
  try {
    await ElMessageBox.confirm(`确认删除收款单「${row.receipt_no}」？`, '删除确认', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    await deleteCollectionReceipt(row.receipt_id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(() => { loadData() })
</script>
