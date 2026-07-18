<template>
  <ListTemplate title="产品销售汇总表" layout-key="sales-report-product-summary" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :loading="loading" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="产品编码"><el-input v-model="searchForm.product_code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.product_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions><el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button></template>
    <template #table>
      <el-table :data="tableData" stripe border size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries" @sort-change="handleSortChange">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="product_code" label="产品编码" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="product_name" label="产品名称" min-width="160" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="category_name" label="产品类别" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="specification" label="规格" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="unit_name" label="单位" width="60" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="color" label="颜色" width="80" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="actual_sales_qty" label="销售数量" width="100" show-overflow-tooltip align="center" sortable="custom" />
        <el-table-column prop="actual_sales_amount" label="销售金额" width="110" show-overflow-tooltip align="right" sortable="custom" />
        <el-table-column prop="actual_cost_amount" label="成本金额" width="110" show-overflow-tooltip align="right" sortable="custom" />
        <el-table-column prop="actual_profit_amount" label="利润金额" width="110" show-overflow-tooltip align="right" sortable="custom" />
        <el-table-column prop="gross_margin_rate" label="毛利率" width="90" show-overflow-tooltip align="center" sortable="custom" />
        <el-table-column prop="sales_share" label="销售占比" width="90" show-overflow-tooltip align="center" sortable="custom" />
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getProductSalesSummary, type ProductSalesSummaryItem } from '@/api/modules/sales'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'
const loading = ref(false)
const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['actual_sales_amount', 'actual_cost_amount', 'actual_profit_amount'])
const searchForm = reactive({ product_code: '', product_name: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
async function loadData() {
  loading.value = true
  try {
    const res = await getProductSalesSummary({
      page: pagination.page,
        page_size: pagination.pageSize,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
      product_code: searchForm.product_code || undefined,
      product_name: searchForm.product_name || undefined
    })
    tableData.value = res.data.items ?? []
    pagination.total = res.data.total || 0
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally { loading.value = false }
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { product_code: '', product_name: '' }); handleSearch() }
async function handleExport() { ElMessage.success('导出任务已提交') }
onMounted(() => { loadData() })
</script>
