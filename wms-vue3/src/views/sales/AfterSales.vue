<template>
  <ListTemplate
    title="售后服务"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    @page-change="loadData"
    @add="handleAdd"
    :show-import="true"
    :import-columns="importColumns"
    @import="handleImport"
    :show-export="true"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="售后服务"
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
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="serviceNo" label="单据编号" min-width="200" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="urgency" label="紧急程度" width="80" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.urgency === '紧急' ? 'danger' : row.urgency === '一般' ? 'warning' : 'info'" size="small">{{ row.urgency }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="120" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.customerName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="contactPerson" label="客户联系人" min-width="80" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="contactPhone" label="联系电话" min-width="110" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="repairAddress" label="维修地址" min-width="150" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="handler" label="指派人" min-width="80" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="serviceDate" label="售后日期" width="110" sortable="custom">
          <template #default="{ row }">{{ formatTableDate(row.serviceDate) }}</template>
        </el-table-column>
        <el-table-column prop="auditStatus" label="审核状态" width="80" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.auditStatus === '审核通过' ? 'success' : row.auditStatus === '审核驳回' ? 'danger' : 'warning'" size="small">{{ row.auditStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" sortable="custom">
          <template #default="{ row }">{{ formatTableDate(row.createTime) }}</template>
        </el-table-column>
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
import { getAfterSaleList, deleteAfterSale, auditAfterSale, type AfterSaleItem, type SalesQueryParams } from '@/api/legacy'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'

const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])
const searchForm = reactive({ orderNo: '', customerName: '', auditStatus: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const importColumns = [{ key: 'serviceNo', label: '单据编号' }, { key: 'customerName', label: '客户' }, { key: 'contactPerson', label: '客户联系人' }, { key: 'contactPhone', label: '联系电话' }, { key: 'urgency', label: '紧急程度' }]
const exportColumns = [
  { key: 'serviceNo', label: '单据编号' }, { key: 'urgency', label: '紧急程度' }, { key: 'customerName', label: '客户' },
  { key: 'contactPerson', label: '客户联系人' }, { key: 'contactPhone', label: '联系电话' }, { key: 'repairAddress', label: '维修地址' },
  { key: 'handler', label: '指派人' }, { key: 'serviceDate', label: '售后日期' }, { key: 'auditStatus', label: '审核状态' }, { key: 'createTime', label: '创建时间' }
]

async function loadData() {
  loading.value = true
  try {
    const res = await getAfterSaleList({ ...searchForm, page: pagination.page, page_size: pagination.pageSize, pageSize: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined } as SalesQueryParams)
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
function handleAdd() { router.push({ path: '/common/add', query: { type: 'salesAfterSales' } }) }
function handleEdit(row: any) {
  sessionStorage.setItem('editData:salesAfterSales', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'salesAfterSales', id: row.id, mode: 'edit' } })
}

async function handleAudit(row: any, status: string) {
  const label = status === '审核通过' ? '审核通过' : '反审核'
  try {
    await ElMessageBox.confirm(`确认${label}售后单「${row.serviceNo}」？`, '提示', { confirmButtonText: `确认${label}`, type: 'warning' })
    await auditAfterSale(row.id, status, '')
    ElMessage.success(`${label}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除售后单「${row.serviceNo}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteAfterSale(row.id)
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
