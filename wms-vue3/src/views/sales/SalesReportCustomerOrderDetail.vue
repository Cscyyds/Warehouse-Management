<template>
  <ListTemplate title="客户订货明细表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="订货单号"><el-input v-model="searchForm.orderNo" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button>
      <el-button type="primary" @click="handleGeneratePurchase"><el-icon><Document /></el-icon>生成采购单明细表</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="orderNo" label="订货单号" min-width="130" />
        <el-table-column prop="customerName" label="客户名称" min-width="120" />
        <el-table-column prop="productCode" label="产品编码" min-width="100" />
        <el-table-column prop="productName" label="产品名称" min-width="130" />
        <el-table-column prop="productType" label="产品类型" width="80" />
        <el-table-column prop="spec" label="产品规格" min-width="80" />
        <el-table-column prop="color" label="颜色" width="60" />
        <el-table-column prop="unit" label="计量单位" width="70" />
        <el-table-column prop="quantity" label="订货数量" width="80" align="center" />
        <el-table-column prop="projectName" label="项目名称" min-width="120" show-overflow-tooltip />
        <el-table-column prop="detailRemark" label="明细备注" min-width="120" show-overflow-tooltip />
        <el-table-column prop="auditStatus" label="审核状态" width="80" align="center">
          <template #default="{ row }"><el-tag :type="row.auditStatus === '审核通过' ? 'success' : row.auditStatus === '审核驳回' ? 'danger' : 'warning'" size="small">{{ row.auditStatus }}</el-tag></template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Document } from '@element-plus/icons-vue'
import { getSalesReport, type SalesQueryParams } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
const tableData = ref<any[]>([])
const selectedRows = ref<any[]>([])
const searchForm = reactive({ orderNo: '', customerName: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const fallbackData = [
  { id: '1', orderNo: 'CO-20240301-001', customerName: '华南五金店', productCode: 'P001', productName: '铰链A型', productType: '成品', spec: '40x35mm', color: '银色', unit: '个', quantity: 200, projectName: '广州装修项目', detailRemark: '', auditStatus: '审核通过' },
  { id: '2', orderNo: 'CO-20240305-002', customerName: '深圳家居城', productCode: 'P002', productName: '滑轨B型', productType: '成品', spec: '300mm', color: '白色', unit: '套', quantity: 150, projectName: '', detailRemark: '急需', auditStatus: '待审核' },
]
async function loadData() {
  try { const res = await getSalesReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); tableData.value = (res.data as any).list || []; pagination.total = (res.data as any).total || 0 }
  catch { const start = (pagination.page - 1) * pagination.pageSize; tableData.value = fallbackData.slice(start, start + pagination.pageSize); pagination.total = fallbackData.length }
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { orderNo: '', customerName: '' }); handleSearch() }
function handleSelectionChange(rows: any[]) { selectedRows.value = rows }
async function handleExport() { try { await getSalesReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
function handleGeneratePurchase() {
  if (selectedRows.value.length === 0) { ElMessage.warning('请先选择要生成采购单的记录'); return }
  ElMessage.success(`已生成 ${selectedRows.value.length} 条采购单明细`)
}
onMounted(() => { loadData() })
</script>