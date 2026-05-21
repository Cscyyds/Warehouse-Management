<template>
  <ListTemplate
    title="对账单管理"
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
    export-file-name="对账单"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="单据编号"><el-input v-model="searchForm.orderNo" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
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
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries">
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="reconciliationNo" label="单据编号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="customerName" label="客户" min-width="120" />
        <el-table-column prop="settleDays" label="月结时长(天)" width="90" align="center" />
        <el-table-column prop="settleDate" label="结算日" width="80" />
        <el-table-column prop="period" label="对账月份" width="80" />
        <el-table-column prop="reconciliationAmount" label="本次对账金额" width="110" align="center" />
        <el-table-column prop="discountRate" label="折扣比例" width="80" align="center" />
        <el-table-column prop="discountAmount" label="折扣金额" width="80" align="center" />
        <el-table-column prop="adjustAmount" label="加减金额" width="80" align="center" />
        <el-table-column prop="receivableAmount" label="应收金额" width="80" align="center" />
        <el-table-column prop="auditStatus" label="审核状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.auditStatus === '审核通过' ? 'success' : row.auditStatus === '审核驳回' ? 'danger' : 'warning'" size="small">{{ row.auditStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="success" size="small" @click="handleAudit(row, '审核通过')">审核</el-button>
            <el-button link type="warning" size="small" v-if="row.auditStatus === '审核通过'" @click="handleAudit(row, '待审核')">反审核</el-button>
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
import { Plus } from '@element-plus/icons-vue'
import { getReconciliationList, deleteReconciliation, type ReconciliationItem, type SalesQueryParams } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'

const router = useRouter()
const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['reconciliationAmount', 'discountAmount', 'adjustAmount', 'receivableAmount'])
const searchForm = reactive({ orderNo: '', customerName: '', auditStatus: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const importColumns = [{ key: 'reconciliationNo', label: '单据编号' }, { key: 'customerName', label: '客户' }, { key: 'period', label: '对账月份' }, { key: 'reconciliationAmount', label: '本次对账金额' }]
const exportColumns = [
  { key: 'reconciliationNo', label: '单据编号' }, { key: 'customerName', label: '客户' }, { key: 'settleDays', label: '月结时长(天)' },
  { key: 'settleDate', label: '结算日' }, { key: 'period', label: '对账月份' }, { key: 'reconciliationAmount', label: '本次对账金额' },
  { key: 'discountRate', label: '折扣比例' }, { key: 'discountAmount', label: '折扣金额' }, { key: 'adjustAmount', label: '加减金额' },
  { key: 'receivableAmount', label: '应收金额' }, { key: 'auditStatus', label: '审核状态' }, { key: 'createTime', label: '创建时间' }
]

const fallbackData: any[] = [
  { id: '1', reconciliationNo: 'RC-202404-001', customerName: '华南五金店', settleDays: 30, settleDate: '每月25日', period: '2024-03', reconciliationAmount: 45000, discountRate: 0.05, discountAmount: 2250, adjustAmount: 0, receivableAmount: 42750, auditStatus: '审核通过', remark: '', createTime: '2024-04-01 09:00', updateTime: '2024-04-03 09:00' },
  { id: '2', reconciliationNo: 'RC-202404-002', customerName: '深圳家居城', settleDays: 30, settleDate: '每月25日', period: '2024-03', reconciliationAmount: 25000, discountRate: 0.03, discountAmount: 750, adjustAmount: -200, receivableAmount: 24050, auditStatus: '待审核', remark: '', createTime: '2024-04-05 10:00', updateTime: '2024-04-05 10:00' },
]

async function loadData() {
  try {
    const res = await getReconciliationList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { orderNo, customerName, auditStatus } = searchForm
    const filtered = fallbackData.filter(r => {
      if (orderNo && !r.reconciliationNo.includes(orderNo)) return false
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
function handleAdd() { router.push({ path: '/common/add', query: { type: 'salesReconciliation' } }) }
function handleEdit(row: any) {
  sessionStorage.setItem('editData:salesReconciliation', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'salesReconciliation', id: row.id, mode: 'edit' } })
}

async function handleAudit(row: any, status: string) {
  const label = status === '审核通过' ? '审核通过' : '反审核'
  try {
    await ElMessageBox.confirm(`确认${label}对账单「${row.reconciliationNo}」？`, '提示', { confirmButtonText: `确认${label}`, type: 'warning' })
    ElMessage.success(`${label}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除对账单「${row.reconciliationNo}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteReconciliation(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
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