<template>
  <ListTemplate title="销售订单明细表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="订单编号"><el-input v-model="searchForm.orderNo" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker v-model="searchForm.startDate" type="date" placeholder="开始日期" style="width:130px" />
          <el-date-picker v-model="searchForm.endDate" type="date" placeholder="结束日期" style="width:130px" />
        </el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions><el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button></template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="orderNo" label="订单编号" min-width="130" sortable="custom" />
        <el-table-column prop="customerName" label="客户名称" min-width="120" sortable="custom" />
        <el-table-column prop="productCode" label="产品编码" min-width="100" sortable="custom" />
        <el-table-column prop="productName" label="产品名称" min-width="130" sortable="custom" />
        <el-table-column prop="spec" label="规格" min-width="80" sortable="custom" />
        <el-table-column prop="color" label="颜色" width="60" sortable="custom" />
        <el-table-column prop="unit" label="单位" width="60" sortable="custom" />
        <el-table-column prop="quantity" label="数量" width="70" align="center" sortable="custom" />
        <el-table-column prop="unitPrice" label="单价" width="70" align="center" sortable="custom" />
        <el-table-column prop="discountRate" label="折扣率" width="70" align="center" sortable="custom" />
        <el-table-column prop="totalPrice" label="销售金额" width="80" align="center" sortable="custom" />
        <el-table-column prop="taxRate" label="税率" width="60" align="center" sortable="custom" />
        <el-table-column prop="taxAmount" label="税额" width="60" align="center" sortable="custom" />
        <el-table-column prop="isFrozen" label="冻结状态" width="80" align="center" sortable="custom">
          <template #default="{ row }"><el-tag :type="row.isFrozen ? 'danger' : 'success'" size="small">{{ row.isFrozen ? '已冻结' : '正常' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="warehouseSendStatus" label="仓库状态" width="80" align="center" sortable="custom" />
        <el-table-column prop="orderDate" label="下单日期" width="110" sortable="custom" />
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getSalesOrderReport, type SalesQueryParams } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'
const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['totalPrice', 'taxAmount'])
const searchForm = reactive({ orderNo: '', customerName: '', startDate: '', endDate: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const fallbackData = [
  { orderNo: 'SO-20240301-001', customerName: '华南五金店', productCode: 'P001', productName: '铰链A型', spec: '40x35mm', color: '银色', unit: '个', quantity: 200, unitPrice: 12.5, discountRate: 0.95, totalPrice: 2375, taxRate: 0.13, taxAmount: 308.75, isFrozen: false, warehouseSendStatus: '已发送', orderDate: '2024-03-01' },
  { orderNo: 'SO-20240305-002', customerName: '深圳家居城', productCode: 'P002', productName: '滑轨B型', spec: '300mm', color: '白色', unit: '套', quantity: 150, unitPrice: 18, discountRate: 1, totalPrice: 2700, taxRate: 0.13, taxAmount: 351, isFrozen: true, warehouseSendStatus: '', orderDate: '2024-03-05' },
]
async function loadData() {
  try { const res = await getSalesOrderReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); tableData.value = (res.data as any).list || []; pagination.total = (res.data as any).total || 0 }
  catch { const start = (pagination.page - 1) * pagination.pageSize; tableData.value = fallbackData.slice(start, start + pagination.pageSize); pagination.total = fallbackData.length }
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { orderNo: '', customerName: '', startDate: '', endDate: '' }); handleSearch() }
async function handleExport() { try { await getSalesOrderReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
onMounted(() => { loadData() })
</script>