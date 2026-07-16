<template>
  <ListTemplate title="客户订货明细表" layout-key="sales-report-customer-order-detail" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :loading="loading" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="客户">
          <el-select v-model="searchForm.customer_id" filterable remote :remote-method="searchCustomersRemote" placeholder="不选则展示全部" clearable style="width:200px" @change="onCustomerChange">
            <el-option v-for="c in customerOptions" :key="c.customer_id" :label="c.customer_name" :value="c.customer_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="产品编码">
          <el-input v-model="searchForm.product_code" placeholder="请输入" clearable style="width:140px" />
        </el-form-item>
        <el-form-item label="产品名称">
          <el-input v-model="searchForm.product_name" placeholder="请输入" clearable style="width:140px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe border size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="product_code" label="产品编码" min-width="120" sortable="custom" />
        <el-table-column prop="product_name" label="产品名称" min-width="160" sortable="custom" />
        <el-table-column prop="category_name" label="产品类别" min-width="120" />
        <el-table-column prop="specification" label="规格" min-width="120" />
        <el-table-column prop="color" label="颜色" width="60" />
        <el-table-column prop="unit_name" label="单位" width="70" />
        <el-table-column prop="actual_sales_qty" label="销售数量" width="90" align="center" sortable="custom" />
        <el-table-column prop="actual_sales_amount" label="销售金额" width="110" align="right" sortable="custom" />
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getCustomerSalesDetail, searchCustomerSales, getProductSalesSummary, searchProductSalesSummary, type ProductSalesSummaryItem, type CustomerSalesDetailItem } from '@/api/modules/sales'
import { getCustomerList, searchCustomers } from '@/api/modules/customer'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const loading = ref(false)
const tableData = ref<(ProductSalesSummaryItem | CustomerSalesDetailItem)[]>([])
const searchForm = reactive({ customer_id: '', product_name: '', product_code: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

const customerOptions = ref<{ customer_id: string; customer_name: string }[]>([])
let customerSearchTimer: ReturnType<typeof setTimeout> | null = null

async function loadCustomerOptions(query: string) {
  if (query) {
    const res = await searchCustomers({
      search_field: JSON.stringify(['customer_name']),
      search_value: JSON.stringify({ customer_name: query }),
      page: 1
    })
    const list = (res.data as any).customers ?? (res.data as any).customer ?? []
    customerOptions.value = list.map((c: any) => ({ customer_id: c.customer_id, customer_name: c.customer_name }))
  } else {
    const res = await getCustomerList({ page: 1 })
    const list = (res.data as any).customers ?? (res.data as any).customer ?? []
    customerOptions.value = list.map((c: any) => ({ customer_id: c.customer_id, customer_name: c.customer_name }))
  }
}

function searchCustomersRemote(query: string) {
  if (customerSearchTimer) clearTimeout(customerSearchTimer)
  customerSearchTimer = setTimeout(() => loadCustomerOptions(query), 300)
}

function onCustomerChange() { handleSearch() }

async function loadData() {
  loading.value = true
  try {
    const hasSearch = searchForm.product_name || searchForm.product_code
    let res
    if (searchForm.customer_id) {
      if (hasSearch) {
        const searchField: string[] = []
        const searchValue: Record<string, unknown> = {}
        if (searchForm.product_name) { searchField.push('product_name'); searchValue.product_name = searchForm.product_name }
        if (searchForm.product_code) { searchField.push('product_code'); searchValue.product_code = searchForm.product_code }
        res = await searchCustomerSales({
          query_type: 'detail',
          customer_id: searchForm.customer_id,
          search_field: JSON.stringify(searchField),
          search_value: JSON.stringify(searchValue),
          page: pagination.page,
          sort_by: sortBy.value || undefined,
          sort_order: sortOrder.value || undefined
        })
      } else {
        res = await getCustomerSalesDetail({
          customer_id: searchForm.customer_id,
          page: pagination.page,
          sort_by: sortBy.value || undefined,
          sort_order: sortOrder.value || undefined
        })
      }
    } else {
      if (hasSearch) {
        const searchField: string[] = []
        const searchValue: Record<string, unknown> = {}
        if (searchForm.product_name) { searchField.push('product_name'); searchValue.product_name = searchForm.product_name }
        if (searchForm.product_code) { searchField.push('product_code'); searchValue.product_code = searchForm.product_code }
        res = await searchProductSalesSummary({
          search_field: JSON.stringify(searchField),
          search_value: JSON.stringify(searchValue),
          page: pagination.page,
          sort_by: sortBy.value || undefined,
          sort_order: sortOrder.value || undefined
        })
      } else {
        res = await getProductSalesSummary({
          page: pagination.page,
          sort_by: sortBy.value || undefined,
          sort_order: sortOrder.value || undefined
        })
      }
    }
    tableData.value = (res.data as any).items ?? []
    pagination.total = (res.data as any).total || 0
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally { loading.value = false }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { customer_id: '', product_name: '', product_code: '' }); handleSearch() }
async function handleExport() { try { ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
onMounted(() => { loadData() })
</script>