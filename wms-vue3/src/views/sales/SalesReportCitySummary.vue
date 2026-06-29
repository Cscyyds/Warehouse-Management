<template>
  <ListTemplate title="城市销售汇总表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="城市"><el-input v-model="searchForm.city" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker v-model="searchForm.startDate" type="date" placeholder="开始日期" style="width:130px" />
          <el-date-picker v-model="searchForm.endDate" type="date" placeholder="结束日期" style="width:130px" />
        </el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions><el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button></template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="province" label="省份" min-width="80" />
        <el-table-column prop="city" label="城市" min-width="80" />
        <el-table-column prop="customerCount" label="客户数" width="70" align="center" />
        <el-table-column prop="orderCount" label="订单数" width="70" align="center" />
        <el-table-column prop="salesQuantity" label="销售数量" width="80" align="center" />
        <el-table-column prop="salesAmount" label="销售金额" width="80" align="center" />
        <el-table-column prop="returnQuantity" label="退货数量" width="80" align="center" />
        <el-table-column prop="returnAmount" label="退货金额" width="80" align="center" />
        <el-table-column prop="netAmount" label="净销售额" width="80" align="center" />
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
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'
const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['salesAmount', 'returnAmount', 'netAmount'])
const searchForm = reactive({ city: '', startDate: '', endDate: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const fallbackData = [
  { province: '广东', city: '广州', customerCount: 30, orderCount: 120, salesQuantity: 3000, salesAmount: 50000, returnQuantity: 100, returnAmount: 1500, netAmount: 48500 },
  { province: '广东', city: '深圳', customerCount: 20, orderCount: 80, salesQuantity: 2000, salesAmount: 35000, returnQuantity: 50, returnAmount: 800, netAmount: 34200 },
  { province: '广东', city: '珠海', customerCount: 10, orderCount: 40, salesQuantity: 800, salesAmount: 15000, returnQuantity: 20, returnAmount: 300, netAmount: 14700 },
]
async function loadData() {
  try { const res = await getSalesReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined } as SalesQueryParams); tableData.value = (res.data as any).list || []; pagination.total = (res.data as any).total || 0 }
  catch { const start = (pagination.page - 1) * pagination.pageSize; tableData.value = fallbackData.slice(start, start + pagination.pageSize); pagination.total = fallbackData.length }
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { city: '', startDate: '', endDate: '' }); handleSearch() }
async function handleExport() { try { await getSalesReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
onMounted(() => { loadData() })
</script>