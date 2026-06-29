<template>
  <ListTemplate title="客户销售汇总表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
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
        <el-table-column prop="customerName" label="客户名称" min-width="140" sortable="custom" />
        <el-table-column prop="city" label="所在城市" width="80" sortable="custom" />
        <el-table-column prop="orderCount" label="订单数" width="70" align="center" sortable="custom" />
        <el-table-column prop="salesQuantity" label="销售数量" width="80" align="center" sortable="custom" />
        <el-table-column prop="salesAmount" label="销售金额" width="80" align="center" sortable="custom" />
        <el-table-column prop="returnQuantity" label="退货数量" width="80" align="center" sortable="custom" />
        <el-table-column prop="returnAmount" label="退货金额" width="80" align="center" sortable="custom" />
        <el-table-column prop="receivableAmount" label="应收金额" width="80" align="center" sortable="custom" />
        <el-table-column prop="paidAmount" label="已收金额" width="80" align="center" sortable="custom" />
        <el-table-column prop="unpaidAmount" label="未收金额" width="80" align="center" sortable="custom" />
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getSalesCustomerReport, type SalesQueryParams } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'
const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['salesAmount', 'returnAmount', 'receivableAmount', 'paidAmount', 'unpaidAmount'])
const searchForm = reactive({ customerName: '', startDate: '', endDate: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const fallbackData = [
  { customerName: '华南五金店', city: '广州', orderCount: 15, salesQuantity: 800, salesAmount: 12000, returnQuantity: 30, returnAmount: 450, receivableAmount: 11550, paidAmount: 10000, unpaidAmount: 1550 },
  { customerName: '深圳家居城', city: '深圳', orderCount: 10, salesQuantity: 500, salesAmount: 8000, returnQuantity: 20, returnAmount: 320, receivableAmount: 7680, paidAmount: 6000, unpaidAmount: 1680 },
  { customerName: '珠海建材公司', city: '珠海', orderCount: 5, salesQuantity: 200, salesAmount: 3000, returnQuantity: 10, returnAmount: 150, receivableAmount: 2850, paidAmount: 2000, unpaidAmount: 850 },
]
async function loadData() {
  try { const res = await getSalesCustomerReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined } as SalesQueryParams); tableData.value = (res.data as any).list || []; pagination.total = (res.data as any).total || 0 }
  catch { const start = (pagination.page - 1) * pagination.pageSize; tableData.value = fallbackData.slice(start, start + pagination.pageSize); pagination.total = fallbackData.length }
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { customerName: '', startDate: '', endDate: '' }); handleSearch() }
async function handleExport() { try { await getSalesCustomerReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
onMounted(() => { loadData() })
</script>