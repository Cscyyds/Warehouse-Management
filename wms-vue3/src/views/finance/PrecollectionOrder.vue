<template>
  <ListTemplate
    title="预收款单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="单据编号"><el-input v-model="searchForm.precollection_no" placeholder="请输入" clearable style="width:170px" /></el-form-item>
        <el-form-item label="科目"><el-input v-model="searchForm.subject_name" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="收款方式">
          <el-select v-model="searchForm.receipt_method" placeholder="请选择" clearable style="width:110px">
            <el-option label="现金" value="CASH" />
            <el-option label="银行转账" value="TRANSFER" />
          </el-select>
        </el-form-item>
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="precollection_no" label="单据编号" width="190" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.precollection_no }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="receipt_date" label="收款日期" width="115" sortable="custom">
          <template #default="{ row }">{{ formatTableDate(row.receipt_date) }}</template>
        </el-table-column>
        <el-table-column prop="subject_name" label="科目" min-width="110" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.subject_name }">{{ row.subject_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column label="收款方式" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.receipt_method === 'CASH' ? 'success' : 'primary'">
              {{ row.receipt_method_display || (row.receipt_method === 'CASH' ? '现金' : '银行转账') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="bank_account_name" label="收款银行" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.bank_account_name }">{{ row.bank_account_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="total_actual_amount" label="实收合计" width="115" align="right" sortable="custom" />
        <el-table-column prop="total_prepayment_amount" label="预收合计" width="115" align="right" />
        <el-table-column prop="total_gift_amount" label="赠送合计" width="110" align="right" />
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

  <PrecollectionItemDialog
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
  getPrecollectionOrderList, searchPrecollectionOrders,
  voidPrecollectionOrder, deletePrecollectionOrder,
  type PrecollectionOrderListItem
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import PrecollectionItemDialog from './PrecollectionItemDialog.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'

const router = useRouter()
const tableData = ref<PrecollectionOrderListItem[]>([])
const loading = ref(false)
const searchForm = reactive({ precollection_no: '', subject_name: '', receipt_method: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const itemDialogVisible = ref(false)
const itemDialogOrder = ref<PrecollectionOrderListItem | null>(null)

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
    const hasSearch = searchForm.precollection_no.trim() || searchForm.subject_name.trim() || searchForm.receipt_method || searchForm.status
    if (hasSearch) {
      const fields: string[] = []
      const values: Record<string, string> = {}
      if (searchForm.precollection_no.trim()) { fields.push('precollection_no'); values['precollection_no'] = searchForm.precollection_no.trim() }
      if (searchForm.subject_name.trim()) { fields.push('subject_name'); values['subject_name'] = searchForm.subject_name.trim() }
      if (searchForm.receipt_method) { fields.push('receipt_method'); values['receipt_method'] = searchForm.receipt_method }
      if (searchForm.status) { fields.push('status'); values['status'] = searchForm.status }
      const res = await searchPrecollectionOrders({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items ?? []
      pagination.total = res.data.total ?? 0
    } else {
      const res = await getPrecollectionOrderList({
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
function handleReset() { Object.assign(searchForm, { precollection_no: '', subject_name: '', receipt_method: '', status: '' }); handleSearch() }
function handleAdd() { router.push('/finance/precollection/add') }
function handleEdit(row: PrecollectionOrderListItem) {
  router.push({ path: '/common/add', query: { type: 'precollectionOrder', id: row.precollection_order_id, mode: 'edit' } })
}
function handleItems(row: PrecollectionOrderListItem) {
  itemDialogOrder.value = row
  itemDialogVisible.value = true
}

async function handleVoid(row: PrecollectionOrderListItem) {
  try {
    await ElMessageBox.confirm(`确认作废预收款单「${row.precollection_no}」？作废后将回滚客户预付款余额。`, '作废确认', { type: 'warning', confirmButtonText: '确认作废', cancelButtonText: '取消' })
    await voidPrecollectionOrder(row.precollection_order_id)
    ElMessage.success('作废成功')
    loadData()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '作废失败')
  }
}

async function handleDelete(row: PrecollectionOrderListItem) {
  try {
    await ElMessageBox.confirm(`确认删除预收款单「${row.precollection_no}」？删除后将回滚客户预付款余额。`, '删除确认', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    await deletePrecollectionOrder(row.precollection_order_id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(() => { loadData() })
</script>
