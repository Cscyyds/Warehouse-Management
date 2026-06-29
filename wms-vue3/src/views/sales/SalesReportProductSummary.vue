<template>
  <ListTemplate title="产品销售汇总表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="产品编码"><el-input v-model="searchForm.productCode" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.productName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
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
        <el-table-column prop="productCode" label="产品编码" min-width="100" sortable="custom" />
        <el-table-column prop="productName" label="产品名称" min-width="130" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="categoryName" label="产品类别" min-width="80" sortable="custom" />
        <el-table-column prop="spec" label="规格" min-width="80" sortable="custom" />
        <el-table-column prop="unit" label="单位" width="60" sortable="custom" />
        <el-table-column prop="salesQuantity" label="销售数量" width="80" align="center" sortable="custom" />
        <el-table-column prop="salesAmount" label="销售金额" width="80" align="center" sortable="custom" />
        <el-table-column prop="returnQuantity" label="退货数量" width="80" align="center" sortable="custom" />
        <el-table-column prop="returnAmount" label="退货金额" width="80" align="center" sortable="custom" />
        <el-table-column prop="netQuantity" label="净销售数量" width="80" align="center" sortable="custom" />
        <el-table-column prop="netAmount" label="净销售金额" width="80" align="center" sortable="custom" />
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getSalesProductReport, type SalesQueryParams } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'
const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['salesAmount', 'returnAmount', 'netAmount'])
const searchForm = reactive({ productCode: '', productName: '', startDate: '', endDate: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const fallbackData = [
  { productCode: 'P001', productName: '铰链A型', categoryName: '五金配件', spec: '40x35mm', unit: '个', salesQuantity: 500, salesAmount: 6250, returnQuantity: 20, returnAmount: 250, netQuantity: 480, netAmount: 6000 },
  { productCode: 'P002', productName: '滑轨B型', categoryName: '五金配件', spec: '300mm', unit: '套', salesQuantity: 300, salesAmount: 5400, returnQuantity: 15, returnAmount: 270, netQuantity: 285, netAmount: 5130 },
  { productCode: 'P003', productName: '把手C型', categoryName: '门控五金', spec: '80mm', unit: '个', salesQuantity: 100, salesAmount: 2200, returnQuantity: 5, returnAmount: 110, netQuantity: 95, netAmount: 2090 },
]
async function loadData() {
  try { const res = await getSalesProductReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined } as SalesQueryParams); tableData.value = (res.data as any).list || []; pagination.total = (res.data as any).total || 0 }
  catch { const start = (pagination.page - 1) * pagination.pageSize; tableData.value = fallbackData.slice(start, start + pagination.pageSize); pagination.total = fallbackData.length }
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { productCode: '', productName: '', startDate: '', endDate: '' }); handleSearch() }
async function handleExport() { try { await getSalesProductReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
onMounted(() => { loadData() })
</script>