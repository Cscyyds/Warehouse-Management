<template>
  <ListTemplate
    title="客户授信余额表"
    :show-add="false"
    show-export
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="客户授信余额表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户ID"><el-input v-model="searchForm.customerId" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="customer_id" label="客户ID" width="120" />
        <el-table-column prop="customer_name" label="客户名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="credit_amount" label="授信总额" width="130" align="right">
          <template #default="{ row }">{{ row.credit_amount?.toLocaleString() ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="credit_used_total" label="已用额度" width="130" align="right">
          <template #default="{ row }">{{ row.credit_used_total?.toLocaleString() ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="credit_remaining" label="可用余额" width="130" align="right">
          <template #default="{ row }">
            <span :class="{ 'amount-warning': row.credit_remaining < 0 }">{{ row.credit_remaining?.toLocaleString() ?? '-' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getCreditSummaryList, searchCreditSummary, type CreditSummaryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'

const tableData = ref<CreditSummaryItem[]>([])
const getSummaries = createAmountSummary(['credit_amount', 'credit_used_total', 'credit_remaining'])
const searchForm = reactive({ customerName: '', customerId: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

async function loadData() {
  try {
    let res
    if (searchForm.customerName || searchForm.customerId) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.customerName) {
        searchField.push('customer_name')
        searchValue.customer_name = searchForm.customerName
      }
      if (searchForm.customerId) {
        searchField.push('customer_id')
        searchValue.customer_id = searchForm.customerId
      }
      res = await searchCreditSummary({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      res = await getCreditSummaryList({ page: pagination.page })
    }
    tableData.value = res.data.customers
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { customerName: '', customerId: '' }); handleSearch() }

const exportColumns = [
  { key: 'customer_id', label: '客户ID' }, { key: 'customer_name', label: '客户名称' },
  { key: 'credit_amount', label: '授信总额' }, { key: 'credit_used_total', label: '已用额度' },
  { key: 'credit_remaining', label: '可用余额' },
]

onMounted(() => { loadData() })
</script>

<style scoped>
.amount-warning { color: var(--el-color-danger); }
</style>
