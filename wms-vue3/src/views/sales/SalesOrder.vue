<template>
  <ListTemplate
    title="销售订单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
    :show-export="true"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="销售订单"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="单据编号"><el-input v-model="searchForm.sales_order_no" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户名称"><el-input v-model="searchForm.customer_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="结算方式">
          <el-select v-model="searchForm.settlement_method" placeholder="请选择" clearable style="width:100px">
            <el-option label="现结" value="CASH" />
            <el-option label="月结" value="MONTHLY" />
            <el-option label="挂账" value="CREDIT" />
            <el-option label="预付款" value="PREPAYMENT" />
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
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="searchForm.created_at"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            clearable
            :shortcuts="orderDateRangeShortcuts"
            :disabled-date="disableFutureOrderDate"
            class="order-date-range-picker"
            popper-class="order-date-range-popper"
            style="width: 280px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
      <el-button :disabled="!selectedRows.length" @click="handleBatchAudit(1)"><el-icon><Check /></el-icon>批量审核</el-button>
      <el-button :disabled="!selectedRows.length" @click="handleBatchSendWarehouse"><el-icon><Van /></el-icon>发送仓库</el-button>
    </template>
    <template #table>
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
        <el-table-column type="selection" width="40" fixed="left" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="sales_order_no" label="单据编号" min-width="200" show-overflow-tooltip fixed="left" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.sales_order_no }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="bill_type" label="单据类型" min-width="100" show-overflow-tooltip />
        <el-table-column prop="customer_name" label="客户名称" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="settlement_method" label="结算方式" min-width="90" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="settlement_bank_name" label="结算银行" min-width="110" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.settlement_bank_name }">{{ row.settlement_bank_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="total_sales_amount" label="销售金额" show-overflow-tooltip width="100" align="right" sortable="custom" />
        <el-table-column prop="use_prepayment_amount" label="预付款" width="90" align="right">
          <template #default="{ row }"><span :class="{ 'cell-empty': row.use_prepayment_amount === '0.00' }">{{ row.use_prepayment_amount === '0.00' ? '-' : row.use_prepayment_amount }}</span></template>
        </el-table-column>
        <el-table-column prop="use_gift_amount" label="赠送" width="80" align="right">
          <template #default="{ row }"><span :class="{ 'cell-empty': row.use_gift_amount === '0.00' }">{{ row.use_gift_amount === '0.00' ? '-' : row.use_gift_amount }}</span></template>
        </el-table-column>
        <el-table-column prop="rounding_amount" label="抹零" width="80" align="right">
          <template #default="{ row }"><span :class="{ 'cell-empty': row.rounding_amount === '0.00' }">{{ row.rounding_amount === '0.00' ? '-' : row.rounding_amount }}</span></template>
        </el-table-column>
        <el-table-column prop="receivable_amount" label="应收金额" show-overflow-tooltip width="100" align="right" sortable="custom" />
        <el-table-column prop="outbound_date" label="出库日期" width="110" align="center" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.outbound_date }">{{ row.outbound_date || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="audit_status" label="审核状态" width="100" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="auditTagType(row.audit_status)" size="small">{{ auditLabel(row.audit_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="warehouse_status_name" label="仓库状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="warehouseTagType(row.warehouse_status)" size="small">{{ row.warehouse_status_name || warehouseLabel(row.warehouse_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_by_name" label="创建人" min-width="90" show-overflow-tooltip align="center" sortable="custom" />
        <el-table-column prop="created_at" label="创建时间" width="170" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-if="row.audit_status === 0" link type="success" size="small" @click="handleAudit(row, 1)">审核</el-button>
            <el-button v-if="row.audit_status === 1" link type="warning" size="small" @click="handleAudit(row, 2)">反审核</el-button>
            <el-button v-if="row.audit_status === 0" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            <el-dropdown v-if="row.warehouse_status >= 1" trigger="click" @command="(cmd: string) => handleRowCommand(cmd, row)">
              <el-button link type="primary" size="small"><el-icon :size="14"><MoreFilled /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="row.can_cancel_send" command="cancelSend">撤销发送</el-dropdown-item>
                  <el-dropdown-item v-if="row.warehouse_status === 1" command="warehouseReturn">仓库退回</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <!-- 审核预览弹窗 -->
  <AuditPreviewDialog
    v-model="auditPreviewDialog.visible"
    :loading="auditPreviewDialog.loading"
    :data="auditPreviewDialog.data"
    :order-count="auditPreviewDialog.orderCount"
    @confirm="handleAuditPreviewConfirm"
  />

  <!-- 仓库退回弹窗 -->
  <el-dialog v-model="returnDialogVisible" title="仓库退回" width="400px" :close-on-click-modal="false">
    <el-form label-width="80px">
      <el-form-item label="退回原因">
        <el-input v-model="returnRemark" type="textarea" :rows="3" placeholder="请输入退回原因（必填）" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="returnDialogVisible = false">取消</el-button>
      <el-button type="primary" :disabled="!returnRemark.trim()" @click="confirmReturn">确认退回</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Check, Van, MoreFilled } from '@element-plus/icons-vue'
import {
  getSalesOrderListV2, searchSalesOrdersV2, deleteSalesOrderV2,
  auditSalesOrderV2, sendSalesOrderToWarehouseV2, warehouseReturnSalesOrderV2, cancelSendSalesOrderV2,
  getSalesAuditPreview,
  type SalesOrderListItemV2, type SalesAuditStatus, type SalesAuditPreview,
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import AuditPreviewDialog from '@/views/purchase/AuditPreviewDialog.vue'
import type { AuditPreviewAggregated } from '@/api'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'
import { disableFutureOrderDate, orderDateRangeShortcuts } from '@/utils/orderDateRange'

const router = useRouter()
const tableData = ref<SalesOrderListItemV2[]>([])
const selectedRows = ref<SalesOrderListItemV2[]>([])
const loading = ref(false)
const searchForm = reactive({ sales_order_no: '', customer_name: '', settlement_method: '', audit_status: '' as number | '', created_at: null as [string, string] | null })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

const exportColumns = [
  { key: 'sales_order_no', label: '单据编号' }, { key: 'bill_type', label: '单据类型' },
  { key: 'settlement_method', label: '结算方式' }, { key: 'customer_name', label: '客户名称' },
  { key: 'total_sales_amount', label: '销售金额' }, { key: 'receivable_amount', label: '应收金额' },
  { key: 'outbound_date', label: '出库日期' }, { key: 'created_at', label: '创建时间' },
]

// 仓库退回
const returnDialogVisible = ref(false)
const returnRemark = ref('')
const pendingReturnId = ref('')

const AUDIT_LABELS: Record<number, string> = { 0: '未审核', 1: '审核通过', 2: '已反审核', 3: '审核失败' }
function auditLabel(status: number) { return AUDIT_LABELS[status] || '-' }
function auditTagType(status: number) {
  if (status === 1) return 'success'
  if (status === 3) return 'danger'
  if (status === 2) return 'warning'
  return 'info'
}

const WAREHOUSE_LABELS: Record<number, string> = { 0: '未发送', 1: '已发送仓库', 2: '仓库退回', 3: '已出库完成' }
function warehouseLabel(status: number) { return WAREHOUSE_LABELS[status] || '-' }
function warehouseTagType(status: number) {
  if (status === 3) return 'success'
  if (status === 1) return 'primary'
  if (status === 2) return 'warning'
  return 'info'
}

async function loadData() {
  loading.value = true
  try {
    const hasSearch = searchForm.sales_order_no.trim() || searchForm.customer_name.trim() || searchForm.settlement_method || searchForm.audit_status !== '' || !!(searchForm.created_at && (searchForm.created_at[0] || searchForm.created_at[1]))
    if (hasSearch) {
      const fields: string[] = []
      const values: Record<string, unknown> = {}
      if (searchForm.sales_order_no.trim()) { fields.push('sales_order_no'); values['sales_order_no'] = searchForm.sales_order_no.trim() }
      if (searchForm.customer_name.trim()) { fields.push('customer_name'); values['customer_name'] = searchForm.customer_name.trim() }
      if (searchForm.settlement_method) { fields.push('settlement_method'); values['settlement_method'] = searchForm.settlement_method }
      if (searchForm.audit_status !== '') { fields.push('audit_status'); values['audit_status'] = searchForm.audit_status }
      if (searchForm.created_at && (searchForm.created_at[0] || searchForm.created_at[1])) {
        fields.push('created_at')
        values['created_at'] = { start_time: searchForm.created_at[0] || undefined, end_time: searchForm.created_at[1] || undefined }
      }
      const res = await searchSalesOrdersV2({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.sales_orders || []
      pagination.total = res.data.total ?? 0
    } else {
      const res = await getSalesOrderListV2({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.sales_orders || []
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
  Object.assign(searchForm, { sales_order_no: '', customer_name: '', settlement_method: '', audit_status: '', created_at: null })
  handleSearch()
}
function handleSelectionChange(rows: SalesOrderListItemV2[]) { selectedRows.value = rows }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'salesOrder' } }) }
function handleEdit(row: SalesOrderListItemV2) {
  sessionStorage.setItem('editData:salesOrder', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'salesOrder', id: row.sales_order_id, mode: 'edit' } })
}

async function handleDelete(row: SalesOrderListItemV2) {
  try {
    await ElMessageBox.confirm(`确认删除销售订单「${row.sales_order_no}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteSalesOrderV2(row.sales_order_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

// 审核预览弹窗状态
const auditPreviewDialog = reactive<{
  visible: boolean
  loading: boolean
  submitting: boolean
  data: AuditPreviewAggregated | null
  orderCount: number
  ids: string[]
}>({ visible: false, loading: false, submitting: false, data: null, orderCount: 0, ids: [] })

function aggregateSalesAuditPreview(items: SalesAuditPreview[]): AuditPreviewAggregated {
  const sum = (key: keyof SalesAuditPreview) =>
    items.reduce((acc, item) => {
      const val = (item as any)[key]
      return acc + (typeof val === 'string' ? Number(val) || 0 : Number(val) || 0)
    }, 0).toFixed(4)
  return {
    has_gift_overflow: items.some(i => i.has_gift_overflow),
    gift_overflow_amount: sum('gift_overflow_amount'),
    requested_gift_amount: sum('requested_gift_amount'),
    actual_gift_amount: sum('actual_gift_amount'),
    has_prepayment_overflow: items.some(i => i.has_prepayment_overflow),
    prepayment_overflow_amount: sum('prepayment_overflow_amount'),
    requested_prepayment_amount: sum('requested_prepayment_amount'),
    actual_prepayment_amount: sum('actual_prepayment_amount'),
  }
}

async function openAuditPreview(ids: string[]) {
  auditPreviewDialog.ids = ids
  auditPreviewDialog.orderCount = ids.length
  auditPreviewDialog.data = null
  auditPreviewDialog.visible = true
  auditPreviewDialog.loading = true
  try {
    const res = await getSalesAuditPreview(ids)
    auditPreviewDialog.data = aggregateSalesAuditPreview(res.data.items)
  } catch {
    ElMessage.error('审核预检失败')
    auditPreviewDialog.visible = false
  } finally {
    auditPreviewDialog.loading = false
  }
}

async function handleAuditPreviewConfirm() {
  if (auditPreviewDialog.submitting) return
  auditPreviewDialog.submitting = true
  try {
    await auditSalesOrderV2(auditPreviewDialog.ids, 1)
    ElMessage.success('审核成功')
    auditPreviewDialog.visible = false
    loadData()
  } catch {
    ElMessage.error('审核失败')
  } finally {
    auditPreviewDialog.submitting = false
  }
}

async function handleAudit(row: SalesOrderListItemV2, targetStatus: SalesAuditStatus) {
  if (targetStatus === 1) {
    await openAuditPreview([row.sales_order_id])
    return
  }
  const actionMap: Record<number, string> = { 2: '反审核', 0: '重置待审核', 3: '审核失败' }
  try {
    await ElMessageBox.confirm(`确认将订单「${row.sales_order_no}」设为${actionMap[targetStatus]}？`, '审核确认', { type: 'warning' })
    await auditSalesOrderV2(row.sales_order_id, targetStatus)
    ElMessage.success(`${actionMap[targetStatus]}成功`)
    loadData()
  } catch {}
}

async function handleBatchAudit(targetStatus: SalesAuditStatus) {
  const ids = selectedRows.value.filter(r => r.audit_status === 0).map(r => r.sales_order_id)
  if (!ids.length) { ElMessage.warning('请选择未审核的订单'); return }
  await openAuditPreview(ids)
}

async function handleBatchSendWarehouse() {
  const ids = selectedRows.value.filter(r => r.audit_status === 1 && r.warehouse_status === 0).map(r => r.sales_order_id)
  if (!ids.length) { ElMessage.warning('请选择已审核且未发送仓库的订单'); return }
  try {
    await ElMessageBox.confirm(`确认将 ${ids.length} 个订单发送仓库？`, '发送仓库', { type: 'warning' })
    await sendSalesOrderToWarehouseV2(ids)
    ElMessage.success('发送仓库成功')
    loadData()
  } catch {}
}

function handleRowCommand(command: string, row: SalesOrderListItemV2) {
  if (command === 'cancelSend') handleCancelSend(row)
  if (command === 'warehouseReturn') { pendingReturnId.value = row.sales_order_id; returnRemark.value = ''; returnDialogVisible.value = true }
}

async function handleCancelSend(row: SalesOrderListItemV2) {
  try {
    await ElMessageBox.confirm(`确认撤销发送仓库「${row.sales_order_no}」？`, '撤销发送', { type: 'warning' })
    await cancelSendSalesOrderV2([row.sales_order_id])
    ElMessage.success('撤销成功')
    loadData()
  } catch {}
}

async function confirmReturn() {
  try {
    await warehouseReturnSalesOrderV2(pendingReturnId.value, returnRemark.value.trim())
    ElMessage.success('退回成功')
    returnDialogVisible.value = false
    loadData()
  } catch {}
}

onMounted(loadData)
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
