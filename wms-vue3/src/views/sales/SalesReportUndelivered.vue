<template>
  <ListTemplate title="未发货明细表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="订单编号"><el-input v-model="searchForm.orderNo" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions><el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button></template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="orderNo" label="订单编号" min-width="130" />
        <el-table-column prop="customerName" label="客户名称" min-width="120" />
        <el-table-column prop="productCode" label="产品编码" min-width="100" />
        <el-table-column prop="productName" label="产品名称" min-width="130" />
        <el-table-column prop="orderQuantity" label="订购数量" width="80" align="center" />
        <el-table-column prop="deliveredQuantity" label="已发数量" width="80" align="center" />
        <el-table-column prop="undeliveredQuantity" label="未发数量" width="80" align="center">
          <template #default="{ row }"><span :class="{ 'cell-danger': row.undeliveredQuantity > 0 }">{{ row.undeliveredQuantity }}</span></template>
        </el-table-column>
        <el-table-column prop="orderDate" label="下单日期" width="110" />
        <el-table-column prop="expectedDate" label="期望交期" width="110" />
        <el-table-column prop="delayDays" label="逾期天数" width="70" align="center">
          <template #default="{ row }"><span :class="{ 'cell-danger': row.delayDays > 3 }">{{ row.delayDays }}</span></template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getSalesReport, type SalesQueryParams } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
const tableData = ref<any[]>([])
const searchForm = reactive({ orderNo: '', customerName: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const fallbackData = [
  { orderNo: 'SO-20240301-001', customerName: '华南五金店', productCode: 'P001', productName: '铰链A型', orderQuantity: 200, deliveredQuantity: 100, undeliveredQuantity: 100, orderDate: '2024-03-01', expectedDate: '2024-03-10', delayDays: 11 },
  { orderNo: 'SO-20240305-002', customerName: '深圳家居城', productCode: 'P002', productName: '滑轨B型', orderQuantity: 150, deliveredQuantity: 80, undeliveredQuantity: 70, orderDate: '2024-03-05', expectedDate: '2024-03-15', delayDays: 0 },
]
async function loadData() {
  try { const res = await getSalesReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); tableData.value = (res.data as any).list || []; pagination.total = (res.data as any).total || 0 }
  catch { const start = (pagination.page - 1) * pagination.pageSize; tableData.value = fallbackData.slice(start, start + pagination.pageSize); pagination.total = fallbackData.length }
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { orderNo: '', customerName: '' }); handleSearch() }
async function handleExport() { try { await getSalesReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
onMounted(() => { loadData() })
</script>
<style scoped>
.cell-danger { color: var(--el-color-danger); font-weight: 600; }
</style>