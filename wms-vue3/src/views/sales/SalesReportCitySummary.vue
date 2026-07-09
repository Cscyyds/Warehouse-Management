<template>
  <ListTemplate title="城市销售汇总表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :loading="loading" @page-change="loadData">
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
        <el-table-column prop="province" label="省份" min-width="120" show-overflow-tooltip />
        <el-table-column prop="city" label="城市" min-width="120" show-overflow-tooltip />
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
import { getSalesReport, type SalesQueryParams } from '@/api/legacy'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'
const loading = ref(false)
const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['salesAmount', 'returnAmount', 'netAmount'])
const searchForm = reactive({ city: '', startDate: '', endDate: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
async function loadData() {
  loading.value = true
  try { const res = await getSalesReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined } as SalesQueryParams); tableData.value = (res.data as any).list ?? []; pagination.total = (res.data as any).total || 0 }
  catch { tableData.value = []; pagination.total = 0 }
  finally { loading.value = false }
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { city: '', startDate: '', endDate: '' }); handleSearch() }
async function handleExport() { try { await getSalesReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
onMounted(() => { loadData() })
</script>
