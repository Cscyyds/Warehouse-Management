<template>
  <ListTemplate title="客户销售汇总表" layout-key="sales-report-customer-summary" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :loading="loading" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="客户名称"><el-input v-model="searchForm.customer_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions><el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button></template>
    <template #table>
      <el-table :data="tableData" stripe border size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries" @sort-change="handleSortChange">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="customer_name" label="客户名称" min-width="160" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="customer_type_name" label="客户类型" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="actual_sales_amount" label="实际销售金额" show-overflow-tooltip width="120" align="right" sortable="custom" />
        <el-table-column prop="total_prepayment_amount" label="预付款" show-overflow-tooltip width="100" align="right" sortable="custom" />
        <el-table-column prop="total_gift_amount" label="赠送金额" show-overflow-tooltip width="100" align="right" sortable="custom" />
        <el-table-column prop="total_rounding_amount" label="抹零金额" show-overflow-tooltip width="100" align="right" sortable="custom" />
        <el-table-column prop="total_receivable_amount" label="应收金额" show-overflow-tooltip width="110" align="right" sortable="custom" />
        <el-table-column prop="follower_user_name" label="跟单员" show-overflow-tooltip width="90" sortable="custom" />
        <el-table-column prop="salesman_user_name" label="销售员" show-overflow-tooltip width="90" sortable="custom" />
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getCustomerSalesSummary, type CustomerSalesSummaryItem } from '@/api/modules/sales'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'

const loading = ref(false)
const tableData = ref<CustomerSalesSummaryItem[]>([])
const getSummaries = createAmountSummary(['actual_sales_amount', 'total_prepayment_amount', 'total_gift_amount', 'total_rounding_amount', 'total_receivable_amount'])
const searchForm = reactive({ customer_name: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

async function loadData() {
  loading.value = true
  try {
    const res = await getCustomerSalesSummary({
      page: pagination.page,
        page_size: pagination.pageSize,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
      customer_name: searchForm.customer_name || undefined
    })
    tableData.value = res.data.items ?? []
    pagination.total = res.data.total || 0
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally { loading.value = false }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { customer_name: '' }); handleSearch() }
async function handleExport() { try { await getCustomerSalesSummary({ page: pagination.page, page_size: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined }); ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
onMounted(() => { loadData() })
</script>
