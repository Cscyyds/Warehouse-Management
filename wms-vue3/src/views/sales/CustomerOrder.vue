<template>
  <ListTemplate
    title="客户订货单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    @page-change="loadData"
    @add="handleAdd"
    :show-export="true"
    :show-import="true"
    :import-columns="importColumns"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="客户订货单"
    @import="handleImport"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="订货单号"><el-input v-model="searchForm.orderNo" placeholder="请输入" clearable style="width:140px" /></el-form-item>
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="orderNo" label="订货单号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="customerName" label="客户" min-width="120">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.customerName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="auditStatus" label="单据状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.auditStatus === '审核通过' ? 'success' : row.auditStatus === '审核驳回' ? 'danger' : 'warning'" size="small">{{ row.auditStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="auditor" label="审核人" width="90" align="center">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.auditor }">{{ row.auditor || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="auditTime" label="审核时间" width="110" align="center">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.auditTime }">{{ formatTableDate(row.auditTime) }}</span></template>
        </el-table-column>
        <el-table-column prop="creator" label="开单人" width="90" align="center" />
        <el-table-column prop="createTime" label="开单时间" width="110" align="center">
          <template #default="{ row }">{{ formatTableDate(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
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
import { Plus, Printer } from '@element-plus/icons-vue'
import { getCustomerOrderList, deleteCustomerOrder, auditCustomerOrder, type SalesQueryParams } from '@/api/legacy'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'

const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])
const selectedRows = ref<any[]>([])
const searchForm = reactive({ orderNo: '', customerName: '', auditStatus: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const importColumns = [{ key: 'orderNo', label: '订货单号' }, { key: 'customerName', label: '客户名称' }, { key: 'productCode', label: '产品编码' }, { key: 'productName', label: '产品名称' }, { key: 'quantity', label: '订货数量' }]
const exportColumns = [{ key: 'orderNo', label: '订货单号' }, { key: 'customerName', label: '客户名称' }, { key: 'productCode', label: '产品编码' }, { key: 'productName', label: '产品名称' }, { key: 'productType', label: '产品类型' }, { key: 'spec', label: '产品规格' }, { key: 'color', label: '颜色' }, { key: 'unit', label: '计量单位' }, { key: 'quantity', label: '订货数量' }, { key: 'projectName', label: '项目名称' }, { key: 'auditStatus', label: '审核状态' }, { key: 'createTime', label: '创建时间' }]

async function loadData() {
  loading.value = true
  try {
    const res = await getCustomerOrderList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { orderNo: '', customerName: '', auditStatus: '' }); handleSearch() }
function handleSelectionChange(rows: any[]) { selectedRows.value = rows }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'salesCustomerOrder' } }) }
function handleEdit(row: any) {
  sessionStorage.setItem('editData:salesCustomerOrder', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'salesCustomerOrder', id: row.sales_order_id, mode: 'edit' } })
}

async function handleAudit(row: any, status: string) {
  const label = status === '审核通过' ? '审核通过' : '反审核'
  try {
    await ElMessageBox.confirm(`确认${label}订货单「${row.orderNo}」？`, '提示', { confirmButtonText: `确认${label}`, type: 'warning' })
    await auditCustomerOrder(row.sales_order_id, status, '')
    ElMessage.success(`${label}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除订货单「${row.orderNo}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteCustomerOrder(row.sales_order_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

function handleBatchPrint() {
  if (selectedRows.value.length === 0) { ElMessage.warning('请先选择要打印的订货单'); return }
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
