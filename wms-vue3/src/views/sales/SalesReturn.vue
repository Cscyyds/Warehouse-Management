<template>
  <ListTemplate
    title="销售退货单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
    :show-import="true"
    :import-columns="importColumns"
    @import="handleImport"
    :show-export="true"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="销售退货单"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="退货单号"><el-input v-model="searchForm.orderNo" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="searchForm.auditStatus" placeholder="请选择" clearable style="width:100px">
            <el-option label="待审核" value="待审核" />
            <el-option label="审核通过" value="审核通过" />
            <el-option label="审核驳回" value="审核驳回" />
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
      <el-button @click="handleBatchPrint"><el-icon><Printer /></el-icon>批量打印</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange" show-summary :summary-method="getSummaries">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="returnNo" label="退货单号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="orderNo" label="关联销售单" min-width="130" show-overflow-tooltip />
        <el-table-column prop="customerName" label="客户名称" min-width="120" />
        <el-table-column prop="warehouseName" label="退货仓库" min-width="120" />
        <el-table-column prop="returnDate" label="退货日期" width="110" />
        <el-table-column prop="returnReason" label="退货原因" min-width="120" show-overflow-tooltip />
        <el-table-column prop="totalAmount" label="退货金额" width="80" align="center" />
        <el-table-column prop="auditStatus" label="审核状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.auditStatus === '审核通过' ? 'success' : row.auditStatus === '审核驳回' ? 'danger' : 'warning'" size="small">{{ row.auditStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="warehouseSendStatus" label="仓库状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.warehouseSendStatus === '已发送' ? 'success' : row.warehouseSendStatus === '已退回' ? 'warning' : 'info'" size="small">{{ row.warehouseSendStatus || '未发送' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="success" size="small" @click="handleAudit(row, '审核通过')">审核</el-button>
            <el-button link type="warning" size="small" v-if="row.auditStatus === '审核通过'" @click="handleAudit(row, '待审核')">反审核</el-button>
            <el-button link type="primary" size="small" v-if="row.auditStatus === '审核通过' && !row.warehouseSendStatus" @click="handleSendWarehouse(row)">发送仓库</el-button>
            <el-button link type="warning" size="small" v-if="row.warehouseSendStatus === '已发送'" @click="handleWarehouseReturn(row)">仓库退回</el-button>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Printer } from '@element-plus/icons-vue'
import { getSalesReturnList, deleteSalesReturn, auditSalesReturn, sendSalesReturnToWarehouse, warehouseReturnSalesReturn, type SalesReturnItem, type SalesQueryParams } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'

const router = useRouter()
const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['totalAmount'])
const selectedRows = ref<any[]>([])
const searchForm = reactive({ orderNo: '', customerName: '', auditStatus: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const importColumns = [{ key: 'returnNo', label: '退货单号' }, { key: 'customerName', label: '客户名称' }, { key: 'productCode', label: '产品编码' }, { key: 'productName', label: '产品名称' }, { key: 'quantity', label: '退货数量' }, { key: 'returnReason', label: '退货原因' }]
const exportColumns = [
  { key: 'returnNo', label: '退货单号' }, { key: 'orderNo', label: '关联销售单' }, { key: 'customerName', label: '客户名称' },
  { key: 'warehouseName', label: '退货仓库' }, { key: 'returnDate', label: '退货日期' }, { key: 'returnReason', label: '退货原因' },
  { key: 'totalAmount', label: '退货金额' }, { key: 'auditStatus', label: '审核状态' }, { key: 'warehouseSendStatus', label: '仓库状态' }, { key: 'createTime', label: '创建时间' }
]

const fallbackData: any[] = [
  { id: '1', returnNo: 'SR-20240315-001', orderNo: 'SO-20240301-001', customerName: '华南五金店', warehouseId: '1', warehouseName: '深圳主仓库', returnDate: '2024-03-15', returnReason: '产品质量问题', totalAmount: 3000, auditStatus: '审核通过', warehouseSendStatus: '已发送', createTime: '2024-03-15 09:00', updateTime: '2024-03-17 09:00' },
  { id: '2', returnNo: 'SR-20240320-002', orderNo: 'SO-20240305-002', customerName: '深圳家居城', warehouseId: '1', warehouseName: '深圳主仓库', returnDate: '2024-03-20', returnReason: '客户取消订单', totalAmount: 8000, auditStatus: '待审核', warehouseSendStatus: '', createTime: '2024-03-20 10:00', updateTime: '2024-03-20 10:00' },
]

async function loadData() {
  try {
    const res = await getSalesReturnList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { orderNo, customerName, auditStatus } = searchForm
    const filtered = fallbackData.filter(r => {
      if (orderNo && !r.returnNo.includes(orderNo)) return false
      if (customerName && !r.customerName.includes(customerName)) return false
      if (auditStatus && r.auditStatus !== auditStatus) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { orderNo: '', customerName: '', auditStatus: '' }); handleSearch() }
function handleSelectionChange(rows: any[]) { selectedRows.value = rows }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'salesReturn' } }) }
function handleEdit(row: any) {
  sessionStorage.setItem('editData:salesReturn', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'salesReturn', id: row.id, mode: 'edit' } })
}

async function handleAudit(row: any, status: string) {
  const label = status === '审核通过' ? '审核通过' : '反审核'
  try {
    await ElMessageBox.confirm(`确认${label}退货单「${row.returnNo}」？`, '提示', { confirmButtonText: `确认${label}`, type: 'warning' })
    await auditSalesReturn(row.id, status, '')
    ElMessage.success(`${label}成功`)
    loadData()
  } catch {}
}

async function handleSendWarehouse(row: any) {
  try {
    await ElMessageBox.confirm(`确认发送退货单「${row.returnNo}」到仓库？`, '提示', { confirmButtonText: '确认发送', type: 'warning' })
    await sendSalesReturnToWarehouse(row.id)
    ElMessage.success('已发送到仓库')
    loadData()
  } catch {}
}

async function handleWarehouseReturn(row: any) {
  try {
    await ElMessageBox.confirm(`确认将退货单「${row.returnNo}」退回仓库？`, '提示', { confirmButtonText: '确认退回', type: 'warning' })
    await warehouseReturnSalesReturn(row.id, '')
    ElMessage.success('仓库退回成功')
    loadData()
  } catch {}
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除退货单「${row.returnNo}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteSalesReturn(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

function handleBatchPrint() {
  if (selectedRows.value.length === 0) { ElMessage.warning('请先选择要打印的退货单'); return }
  ElMessage.success('打印任务已提交')
}

function handleImport(data: any[]) {
  ElMessage.success(`成功导入 ${data.length} 条数据`)
  loadData()
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>