<template>
  <ListTemplate
    title="客户订货单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
    :show-export="true"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="客户订货单"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="订货单号"><el-input v-model="searchForm.order_no" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户名称"><el-input v-model="searchForm.customer_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="searchForm.audit_status" placeholder="请选择" clearable style="width:100px">
            <el-option label="待审核" :value="0" />
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
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增订货单</el-button>
      <el-button :disabled="!selectedRows.length" @click="handleBatchAudit"><el-icon><Check /></el-icon>批量审核</el-button>
    </template>
    <template #table>
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" fixed="left" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="order_no" label="订货单号" min-width="200" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <span class="cell-link" @click="handleEdit(row)">{{ row.order_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="audit_status" label="审核状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="auditTagType(row.audit_status)" size="small">{{ auditLabel(row.audit_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_by_name" label="创建人" min-width="90" show-overflow-tooltip align="center" />
        <el-table-column prop="created_at" label="创建时间" width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="240" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-btns">
              <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
              <el-button v-if="row.audit_status === 0" link type="success" size="small" @click="handleAudit(row, 1)">审核</el-button>
              <el-button v-if="row.audit_status === 1" link type="warning" size="small" @click="handleAudit(row, 2)">反审核</el-button>
              <el-button v-if="row.audit_status === 2 || row.audit_status === 3" link type="info" size="small" @click="handleAudit(row, 0)">重置</el-button>
              <el-button v-if="row.audit_status !== 1" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <!-- 详情弹窗 -->
  <el-dialog v-model="detail.visible" title="客户订货单详情" width="1000px" destroy-on-close>
    <el-descriptions :column="3" border>
      <el-descriptions-item label="订货单号">{{ detail.order?.order_no }}</el-descriptions-item>
      <el-descriptions-item label="客户">{{ detail.order?.customer_name }}</el-descriptions-item>
      <el-descriptions-item label="审核状态">{{ auditLabel(detail.order?.audit_status) }}</el-descriptions-item>
      <el-descriptions-item label="备注" :span="3">{{ detail.order?.remark || '-' }}</el-descriptions-item>
      <el-descriptions-item label="图片" :span="3">
        <el-link v-for="f in detail.order?.images || []" :key="f.file_url" :href="f.file_url" target="_blank">{{ f.file_name }}&nbsp;</el-link>
        <span v-if="!detail.order?.images?.length">-</span>
      </el-descriptions-item>
      <el-descriptions-item label="附件" :span="3">
        <el-link v-for="f in detail.order?.attachments || []" :key="f.file_url" :href="f.file_url" target="_blank">{{ f.file_name }}&nbsp;</el-link>
        <span v-if="!detail.order?.attachments?.length">-</span>
      </el-descriptions-item>
    </el-descriptions>
    <el-table :data="detail.order?.items || []" border style="margin-top:16px">
      <el-table-column prop="product_code" label="产品编号" />
      <el-table-column prop="product_name" label="产品名称" min-width="180" />
      <el-table-column prop="unit_name" label="单位" />
      <el-table-column prop="qty" label="数量" />
      <el-table-column prop="project_name" label="项目" />
      <el-table-column prop="line_remark" label="明细备注" />
    </el-table>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Check } from '@element-plus/icons-vue'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { getCustomerOrderList, searchCustomerOrders, deleteCustomerOrder, auditCustomerOrder, getCustomerOrderDetail, type CustomerOrder } from '@/api/modules/customerOrder'
import { formatTableDate } from '@/utils/date'

const router = useRouter()
const tableData = ref<CustomerOrder[]>([])
const selectedRows = ref<CustomerOrder[]>([])
const loading = ref(false)
const searchForm = reactive({ order_no: '', customer_name: '', audit_status: '' as number | '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const detail = reactive<{ visible: boolean; order: CustomerOrder | null }>({ visible: false, order: null })

const exportColumns = [
  { key: 'order_no', label: '订货单号' },
  { key: 'customer_name', label: '客户名称' },
  { key: 'created_by_name', label: '创建人' },
  { key: 'created_at', label: '创建时间' },
]

const AUDIT_LABELS: Record<number, string> = { 0: '待审核', 1: '审核通过', 2: '已反审核', 3: '审核失败' }
function auditLabel(status?: number) {
  return status === undefined || status === null ? '-' : (AUDIT_LABELS[status] || '-')
}
function auditTagType(status: number) {
  if (status === 1) return 'success'
  if (status === 3) return 'danger'
  if (status === 2) return 'warning'
  return 'info'
}

async function loadData() {
  loading.value = true
  try {
    const has = searchForm.order_no.trim() || searchForm.customer_name.trim() || searchForm.audit_status !== ''
    const params: Record<string, unknown> = { page: pagination.page, page_size: pagination.pageSize }
    if (has) {
      const fields: string[] = []
      const values: Record<string, unknown> = {}
      if (searchForm.order_no.trim()) { fields.push('order_no'); values.order_no = searchForm.order_no.trim() }
      if (searchForm.customer_name.trim()) { fields.push('customer_name'); values.customer_name = searchForm.customer_name.trim() }
      if (searchForm.audit_status !== '') { fields.push('audit_status'); values.audit_status = searchForm.audit_status }
      params.search_field = JSON.stringify(fields)
      params.search_value = JSON.stringify(values)
    }
    const res = has ? await searchCustomerOrders(params) : await getCustomerOrderList(params)
    tableData.value = res.data.customer_orders || []
    pagination.total = res.data.total || 0
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { order_no: '', customer_name: '', audit_status: '' }); handleSearch() }
function handleSelectionChange(rows: CustomerOrder[]) { selectedRows.value = rows }
function handleAdd() { router.push('/sales/customer-order/create') }
function handleEdit(row: CustomerOrder) { router.push({ path: '/sales/customer-order/create', query: { mode: 'edit', id: row.customer_order_id } }) }

async function handleDelete(row: CustomerOrder) {
  try {
    await ElMessageBox.confirm(`确认删除客户订货单「${row.order_no}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteCustomerOrder(row.customer_order_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

async function openDetail(row: CustomerOrder) {
  try {
    const r = await getCustomerOrderDetail(row.customer_order_id)
    detail.order = r.data
    detail.visible = true
  } catch {}
}

const AUDIT_ACTIONS: Record<number, string> = { 0: '重置', 1: '审核', 2: '反审核', 3: '审核失败' }
async function handleAudit(row: CustomerOrder, status: number) {
  const action = AUDIT_ACTIONS[status] || '操作'
  try {
    await ElMessageBox.confirm(`确认${action} ${row.order_no}？`, '提示', { type: 'warning' })
    await auditCustomerOrder([row.customer_order_id], status)
  } catch { return }
  ElMessage.success(`${action}成功`)
  loadData()
}

async function handleBatchAudit() {
  const pending = selectedRows.value.filter(r => r.audit_status === 0)
  if (!pending.length) { ElMessage.warning('请选择待审核（状态为待审核）的订货单'); return }
  const skipped = selectedRows.value.length - pending.length
  try {
    await ElMessageBox.confirm(`确认审核选中的 ${pending.length} 张待审核订货单${skipped ? `（另有 ${skipped} 张非待审核已跳过）` : ''}？`, '批量审核', { type: 'warning' })
    await auditCustomerOrder(pending.map(r => r.customer_order_id), 1)
  } catch { return }
  ElMessage.success('批量审核成功')
  loadData()
}

onMounted(loadData)
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
/* 操作列按钮紧凑排列，避免按钮过多时被截断成省略号 */
.action-btns { display: inline-flex; align-items: center; white-space: nowrap; }
.action-btns .el-button + .el-button { margin-left: 6px; }
</style>
