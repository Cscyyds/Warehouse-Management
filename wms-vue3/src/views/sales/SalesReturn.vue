<template>
  <ListTemplate
    title="销售退货单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="退货单号"><el-input v-model="searchForm.return_no" placeholder="请输入" clearable style="width:150px" /></el-form-item>
        <el-form-item label="客户名称"><el-input v-model="searchForm.customer_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="退货方式">
          <el-select v-model="searchForm.return_method" placeholder="请选择" clearable style="width:120px">
            <el-option label="退货退款" value="RETURN_AND_REFUND" />
            <el-option label="仅退货" value="RETURN_ONLY" />
            <el-option label="仅退款" value="REFUND_ONLY" />
          </el-select>
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="searchForm.audit_status" placeholder="请选择" clearable style="width:100px">
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
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
      <el-button :disabled="selectedRows.length === 0" @click="handleBatchAudit(1)"><el-icon><Check /></el-icon>审核</el-button>
      <el-button :disabled="selectedRows.length === 0" @click="handleBatchAudit(2)"><el-icon><Back /></el-icon>反审核</el-button>
      <el-button :disabled="selectedRows.length === 0" @click="handleBatchSendWarehouse"><el-icon><Van /></el-icon>发送仓库</el-button>
      <el-button :disabled="selectedRows.length === 0" @click="handleBatchCancelSend"><el-icon><Back /></el-icon>撤销发送</el-button>
    </template>
    <template #table>
      <el-table
        ref="tableRef"
        :data="tableData"
        stripe
        size="small"
        style="width:100%"
        row-class-name="table-row"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="40" fixed="left" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="return_no" label="退货单号" min-width="190" show-overflow-tooltip fixed="left" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.return_no }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="sales_order_no" label="销售订单号" width="190" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.sales_order_no }">{{ row.sales_order_no || '-' }}</span></template>
        </el-table-column>
        <el-table-column label="退货方式" width="110" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="returnMethodTag(row.return_method)">{{ row.return_method_display || returnMethodLabel(row.return_method) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="return_amount" label="退货金额" show-overflow-tooltip width="110" align="right" sortable="custom" />
        <el-table-column prop="return_date" label="退货日期" width="110" align="center" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.return_date }">{{ formatTableDate(row.return_date) || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="audit_status" label="审核状态" width="110" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="auditTagType(row.audit_status)" size="small">{{ auditLabel(row.audit_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="warehouse_status" label="仓库状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="warehouseTagType(row.warehouse_status)" size="small">{{ warehouseLabel(row.warehouse_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_by_name" label="创建人" width="90" align="center" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="200" sortable="custom"  show-overflow-tooltip>
          <template #default="{ row }" >{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="250" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-if="row.audit_status === 0" link type="success" size="small" @click="handleAudit(row, 1)">审核</el-button>
            <el-button v-if="row.audit_status === 1" link type="warning" size="small" @click="handleAudit(row, 2)">反审核</el-button>
            <el-button v-if="row.audit_status === 1 && row.warehouse_status === 0" link type="primary" size="small" @click="handleSendWarehouse(row)">发送仓库</el-button>
            <el-button v-if="row.can_cancel_send === 1" link type="warning" size="small" @click="handleCancelSend(row)">撤销发送</el-button>
            <el-button v-if="row.audit_status === 0" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Check, Back, Van } from '@element-plus/icons-vue'
import {
  getSalesReturnListV2, searchSalesReturnsV2,
  deleteSalesReturnV2, auditSalesReturnV2, sendSalesReturnToWarehouseV2, cancelSendSalesReturnV2,
  type SalesReturnListItem
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'

const router = useRouter()
const tableRef = ref()
const tableData = ref<SalesReturnListItem[]>([])
const loading = ref(false)
const selectedRows = ref<SalesReturnListItem[]>([])
const searchForm = reactive({ return_no: '', customer_name: '', return_method: '', audit_status: '' as number | '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

const RETURN_METHOD_LABELS: Record<string, string> = {
  RETURN_AND_REFUND: '退货退款', RETURN_ONLY: '仅退货', REFUND_ONLY: '仅退款'
}
function returnMethodLabel(v: string) { return RETURN_METHOD_LABELS[v] || v }
function returnMethodTag(v: string) {
  if (v === 'RETURN_AND_REFUND') return 'warning'
  if (v === 'RETURN_ONLY') return 'info'
  return 'primary'
}

const AUDIT_LABELS: Record<number, string> = { 0: '未审核', 1: '审核通过', 2: '已反审核', 3: '审核失败' }
function auditLabel(s: number) { return AUDIT_LABELS[s] || '-' }
function auditTagType(s: number) {
  if (s === 1) return 'success'; if (s === 3) return 'danger'; if (s === 2) return 'warning'; return 'info'
}

const WAREHOUSE_LABELS: Record<number, string> = { 0: '未发送', 1: '已发送', 2: '仓库退回' }
function warehouseLabel(s: number) { return WAREHOUSE_LABELS[s] || '-' }
function warehouseTagType(s: number) {
  if (s === 1) return 'primary'; if (s === 2) return 'warning'; return 'info'
}

async function loadData() {
  loading.value = true
  try {
    const hasSearch = searchForm.return_no.trim() || searchForm.customer_name.trim() || searchForm.return_method || searchForm.audit_status !== ''
    if (hasSearch) {
      const fields: string[] = []
      const values: Record<string, unknown> = {}
      if (searchForm.return_no.trim()) { fields.push('return_no'); values['return_no'] = searchForm.return_no.trim() }
      if (searchForm.customer_name.trim()) { fields.push('customer_name'); values['customer_name'] = searchForm.customer_name.trim() }
      if (searchForm.return_method) { fields.push('return_method'); values['return_method'] = searchForm.return_method }
      if (searchForm.audit_status !== '') { fields.push('audit_status'); values['audit_status'] = searchForm.audit_status }
      const res = await searchSalesReturnsV2({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.sales_returns || []
      pagination.total = res.data.total ?? 0
    } else {
      const res = await getSalesReturnListV2({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.sales_returns || []
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
  Object.assign(searchForm, { return_no: '', customer_name: '', return_method: '', audit_status: '' })
  handleSearch()
}

function handleAdd() { router.push({ path: '/common/add', query: { type: 'salesReturn' } }) }
function handleEdit(row: SalesReturnListItem) {
  router.push({ path: '/common/add', query: { type: 'salesReturn', id: row.sales_return_id, mode: 'edit' } })
}

async function handleDelete(row: SalesReturnListItem) {
  try {
    await ElMessageBox.confirm(`确认删除退货单「${row.return_no}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteSalesReturnV2(row.sales_return_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

async function handleAudit(row: SalesReturnListItem, targetStatus: number) {
  const label = targetStatus === 1 ? '审核通过' : '反审核'
  try {
    await ElMessageBox.confirm(`确认将退货单「${row.return_no}」设为${label}？`, '审核确认', { type: 'warning' })
    await auditSalesReturnV2(row.sales_return_id, targetStatus)
    ElMessage.success(`${label}成功`)
    loadData()
  } catch {}
}

async function handleSendWarehouse(row: SalesReturnListItem) {
  try {
    await ElMessageBox.confirm(`确认将退货单「${row.return_no}」发送仓库？`, '发送确认', { type: 'warning' })
    await sendSalesReturnToWarehouseV2([row.sales_return_id])
    ElMessage.success('发送成功')
    loadData()
  } catch {}
}

async function handleCancelSend(row: SalesReturnListItem) {
  try {
    await ElMessageBox.confirm(`确认撤销退货单「${row.return_no}」的发送仓库操作？`, '撤销确认', { type: 'warning' })
    await cancelSendSalesReturnV2([row.sales_return_id])
    ElMessage.success('撤销发送成功')
    loadData()
  } catch {}
}

async function handleBatchSendWarehouse() {
  try {
    await ElMessageBox.confirm(`确认将选中的 ${selectedRows.value.length} 条退货单发送仓库？`, '批量发送确认', { type: 'warning' })
    const ids = selectedRows.value.map(r => r.sales_return_id)
    await sendSalesReturnToWarehouseV2(ids)
    ElMessage.success('批量发送成功')
    loadData()
  } catch {}
}

async function handleBatchCancelSend() {
  try {
    await ElMessageBox.confirm(`确认撤销选中的 ${selectedRows.value.length} 条退货单的发送仓库操作？`, '批量撤销确认', { type: 'warning' })
    const ids = selectedRows.value.map(r => r.sales_return_id)
    await cancelSendSalesReturnV2(ids)
    ElMessage.success('批量撤销成功')
    loadData()
  } catch {}
}

async function handleBatchAudit(targetStatus: number) {
  const label = targetStatus === 1 ? '审核通过' : '反审核'
  try {
    await ElMessageBox.confirm(`确认将选中的 ${selectedRows.value.length} 条退货单设为${label}？`, '批量审核确认', { type: 'warning' })
    const ids = selectedRows.value.map(r => r.sales_return_id)
    await auditSalesReturnV2(ids, targetStatus)
    ElMessage.success(`批量${label}成功`)
    loadData()
  } catch {}
}

function handleSelectionChange(rows: SalesReturnListItem[]) {
  selectedRows.value = rows
}

onMounted(loadData)
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
