<template>
  <ListTemplate
    ref="listTemplateRef"
    title="预付款单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="单据编号"><el-input v-model="searchForm.prepayment_no" placeholder="请输入" clearable style="width:170px" /></el-form-item>
        <el-form-item label="科目"><el-input v-model="searchForm.subject_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="付款方式">
          <el-select v-model="searchForm.payment_method" placeholder="请选择" clearable style="width:110px">
            <el-option label="现金" value="现金" />
            <el-option label="银行转账" value="银行转账" />
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
        <el-table-column prop="prepayment_no" label="单据编号" width="180" show-overflow-tooltip fixed="left" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.prepayment_no }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="payment_date" label="付款日期" width="120" sortable="custom" />
        <el-table-column prop="subject_name" label="科目" min-width="120" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.subject_name }">{{ row.subject_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="payment_method" label="付款方式" width="100" align="center" sortable="custom" />
        <el-table-column prop="bank_account_name" label="银行账户" min-width="130" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.bank_account_name }">{{ row.bank_account_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="total_actual_amount" label="实付合计" width="120" align="right" sortable="custom" />
        <el-table-column prop="total_prepayment_amount" label="预付合计" width="120" align="right" sortable="custom" />
        <el-table-column prop="total_gift_amount" label="赠送合计" width="120" align="right" sortable="custom" />
        <el-table-column prop="status" label="状态" width="80" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" sortable="custom" />
        <el-table-column label="操作" width="230" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="handleItems(row)">明细</el-button>
            <el-button link type="warning" size="small" @click="handleVoid(row)">{{ row.status === 2 ? '恢复' : '作废' }}</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <PrepaymentItemDialog
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
  getPrepaymentOrderList, searchPrepaymentOrders,
  voidPrepaymentOrder, deletePrepaymentOrder,
  type PrepaymentOrderListItem
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import PrepaymentItemDialog from './PrepaymentItemDialog.vue'

const router = useRouter()
const listTemplateRef = ref<any>()
const tableData = ref<PrepaymentOrderListItem[]>([])
const loading = ref(false)
const searchForm = reactive({ prepayment_no: '', subject_name: '', payment_method: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

// 明细管理弹窗
const itemDialogVisible = ref(false)
const itemDialogOrder = ref<PrepaymentOrderListItem | null>(null)

function statusTagType(status?: number) {
  if (status === 1) return 'success'
  if (status === 2) return 'info'
  return 'warning'
}

/** 状态码 → 中文（0=删除中间态一般不展示，作兜底） */
function statusLabel(status?: number) {
  if (status === 1) return '正常'
  if (status === 2) return '已作废'
  return '-'
}

async function loadData() {
  loading.value = true
  try {
    const hasSearch = searchForm.prepayment_no.trim() || searchForm.subject_name.trim() || searchForm.payment_method || searchForm.status
    if (hasSearch) {
      const fields: string[] = []
      const values: Record<string, string> = {}
      if (searchForm.prepayment_no.trim()) { fields.push('prepayment_no'); values['prepayment_no'] = searchForm.prepayment_no.trim() }
      if (searchForm.subject_name.trim()) { fields.push('subject_name'); values['subject_name'] = searchForm.subject_name.trim() }
      if (searchForm.payment_method) { fields.push('payment_method'); values['payment_method'] = searchForm.payment_method }
      if (searchForm.status) { fields.push('status'); values['status'] = searchForm.status }
      const res = await searchPrepaymentOrders({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.prepayment_orders || []
      pagination.total = res.data.total ?? 0
    } else {
      const res = await getPrepaymentOrderList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.prepayment_orders || []
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
  Object.assign(searchForm, { prepayment_no: '', subject_name: '', payment_method: '', status: '' })
  handleSearch()
}
function handleAdd() { router.push({ path: '/common/add', query: { type: 'prepaymentOrder' } }) }
function handleEdit(row: PrepaymentOrderListItem) {
  sessionStorage.setItem('editData:prepaymentOrder', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'prepaymentOrder', id: row.prepayment_order_id, mode: 'edit' } })
}
function handleItems(row: PrepaymentOrderListItem) {
  itemDialogOrder.value = row
  itemDialogVisible.value = true
}

async function handleVoid(row: PrepaymentOrderListItem) {
  const action = row.status === 2 ? '恢复' : '作废'
  try {
    await ElMessageBox.confirm(`确认${action}预付款单「${row.prepayment_no}」？`, '提示', { confirmButtonText: `确认${action}`, type: 'warning' })
    await voidPrepaymentOrder(row.prepayment_order_id)
    ElMessage.success(`${action}成功`)
    loadData()
  } catch {
    // 用户取消或请求失败（失败已由拦截器提示）
  }
}

async function handleDelete(row: PrepaymentOrderListItem) {
  try {
    await ElMessageBox.confirm(`确认删除预付款单「${row.prepayment_no}」？删除后明细同步删除。`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deletePrepaymentOrder(row.prepayment_order_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {
    // 用户取消或请求失败（失败已由拦截器提示）
  }
}

onMounted(loadData)
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
:deep(.el-table--small .el-table__cell) { padding: 8px 12px; }
:deep(.el-table--small th.el-table__cell) { padding: 10px 12px; }
</style>
