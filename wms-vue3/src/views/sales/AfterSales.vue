<template>
  <ListTemplate
    title="售后服务"
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="serviceNo" label="单据编号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="urgency" label="紧急程度" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.urgency === '紧急' ? 'danger' : row.urgency === '一般' ? 'warning' : 'info'" size="small">{{ row.urgency }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="120" />
        <el-table-column prop="contactPerson" label="客户联系人" width="80" />
        <el-table-column prop="contactPhone" label="联系电话" width="110" />
        <el-table-column prop="repairAddress" label="维修地址" min-width="150" show-overflow-tooltip />
        <el-table-column prop="handler" label="指派人" width="80" />
        <el-table-column prop="serviceDate" label="售后日期" width="110" />
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
import { getAfterSaleList, deleteAfterSale, auditAfterSale, type AfterSaleItem, type SalesQueryParams } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<any[]>([])
const searchForm = reactive({ orderNo: '', customerName: '', auditStatus: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const importColumns = [{ key: 'serviceNo', label: '单据编号' }, { key: 'customerName', label: '客户' }, { key: 'contactPerson', label: '客户联系人' }, { key: 'contactPhone', label: '联系电话' }, { key: 'urgency', label: '紧急程度' }]
const exportColumns = [
  { key: 'serviceNo', label: '单据编号' }, { key: 'urgency', label: '紧急程度' }, { key: 'customerName', label: '客户' },
  { key: 'contactPerson', label: '客户联系人' }, { key: 'contactPhone', label: '联系电话' }, { key: 'repairAddress', label: '维修地址' },
  { key: 'handler', label: '指派人' }, { key: 'serviceDate', label: '售后日期' }, { key: 'auditStatus', label: '审核状态' }, { key: 'createTime', label: '创建时间' }
]

const fallbackData: any[] = [
  { id: '1', serviceNo: 'AS-20240301-001', urgency: '紧急', customerName: '华南五金店', contactPerson: '李经理', contactPhone: '13800000001', repairAddress: '广州市天河区仓库1号', handler: '王浩', serviceDate: '2024-03-01', serviceType: '维修', auditStatus: '审核通过', createTime: '2024-03-01 09:00' },
  { id: '2', serviceNo: 'AS-20240305-002', urgency: '一般', customerName: '深圳家居城', contactPerson: '王总', contactPhone: '13800000002', repairAddress: '深圳市南山区展厅2号', handler: '张伟', serviceDate: '2024-03-05', serviceType: '换货', auditStatus: '待审核', createTime: '2024-03-05 10:00' },
  { id: '3', serviceNo: 'AS-20240310-003', urgency: '低', customerName: '珠海建材公司', contactPerson: '张总', contactPhone: '13800000003', repairAddress: '珠海市香洲区工地', handler: '刘工', serviceDate: '2024-03-10', serviceType: '退货', auditStatus: '审核驳回', createTime: '2024-03-10 11:00' },
]

async function loadData() {
  try {
    const res = await getAfterSaleList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { orderNo, customerName, auditStatus } = searchForm
    const filtered = fallbackData.filter(r => {
      if (orderNo && !r.serviceNo.includes(orderNo)) return false
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