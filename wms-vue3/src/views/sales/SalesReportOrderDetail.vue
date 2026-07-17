<template>
  <ListTemplate title="销售订单明细表" layout-key="sales-report-order-detail" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :loading="loading" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="订单编号">
          <el-input v-model="searchForm.sales_order_no" placeholder="请输入" clearable style="width:140px" />
        </el-form-item>
        <el-form-item label="产品名称">
          <el-input v-model="searchForm.product_name" placeholder="请输入" clearable style="width:140px" />
        </el-form-item>
        <el-form-item label="产品编码">
          <el-input v-model="searchForm.product_code" placeholder="请输入" clearable style="width:140px" />
        </el-form-item>
        <el-form-item label="创建日期起">
          <el-date-picker v-model="searchForm.created_at_start" type="date" placeholder="开始日期" style="width:130px" />
        </el-form-item>
        <el-form-item label="创建日期止">
          <el-date-picker v-model="searchForm.created_at_end" type="date" placeholder="结束日期" style="width:130px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button @click="handleExport">
        <el-icon><Download /></el-icon>批量导出
      </el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe border size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="sales_order_no" label="订单编号" min-width="140" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="customer_name" label="客户名称" min-width="120" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="product_code" label="产品编码" min-width="100" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="product_name" label="产品名称" min-width="130" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="specification" label="规格" min-width="80" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="color" label="颜色" width="60" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="unit_name" label="单位" width="60" />
        <el-table-column prop="qty" label="数量" width="70" align="center" sortable="custom" />
        <el-table-column prop="discount_price" label="折后单价" width="90" align="right" sortable="custom" />
        <el-table-column prop="discount_rate" label="折扣率" width="100" align="center" sortable="custom" />
        <el-table-column prop="line_sales_amount" label="销售金额" width="150" align="right" sortable="custom" />
        <el-table-column prop="tax_rate" label="税率" width="100" align="center" sortable="custom" />
        <el-table-column prop="tax_amount" label="税额" width="100" align="right" sortable="custom" />
        <el-table-column prop="line_receivable_amount" label="应收金额" width="150" align="right" sortable="custom" />
        <el-table-column prop="created_at" label="创建日期" width="200" sortable="custom" />
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { searchSalesOrderItems, type SalesOrderItemV2 } from '@/api/modules/sales'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'

const loading = ref(false)
const tableData = ref<(SalesOrderItemV2 & { sales_order_no?: string; customer_name?: string })[]>([])
const getSummaries = createAmountSummary(['line_sales_amount', 'tax_amount', 'line_receivable_amount'])
const searchForm = reactive({ sales_order_no: '', product_name: '', product_code: '', created_at_start: '', created_at_end: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

async function loadData() {
  loading.value = true
  try {
    const searchField: string[] = []
    const searchValue: Record<string, unknown> = {}
    if (searchForm.sales_order_no) { searchField.push('sales_order_no'); searchValue.sales_order_no = searchForm.sales_order_no }
    if (searchForm.product_name) { searchField.push('product_name'); searchValue.product_name = searchForm.product_name }
    if (searchForm.product_code) { searchField.push('product_code'); searchValue.product_code = searchForm.product_code }
    if (searchForm.created_at_start || searchForm.created_at_end) {
      searchField.push('created_at')
      searchValue.created_at = JSON.stringify({ start_time: searchForm.created_at_start || '', end_time: searchForm.created_at_end || '' })
    }
    // 搜索字段不能为空，无筛选条件时默认查当月
    if (searchField.length === 0) {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      searchField.push('created_at')
      searchValue.created_at = JSON.stringify({ start_time: formatDate(firstDay), end_time: '' })
    }
    const res = await searchSalesOrderItems({
      search_field: JSON.stringify(searchField),
      search_value: JSON.stringify(searchValue),
      page: pagination.page,
        page_size: pagination.pageSize,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined
    })
    tableData.value = res.data.items ?? []
    pagination.total = res.data.total || 0
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally { loading.value = false }
}

function formatDate(d: Date) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}` }

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { sales_order_no: '', product_name: '', product_code: '', created_at_start: '', created_at_end: '' }); handleSearch() }
async function handleExport() { try { ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
onMounted(() => { loadData() })
</script>