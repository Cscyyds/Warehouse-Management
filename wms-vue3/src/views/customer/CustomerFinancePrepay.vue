<template>
  <ListTemplate
    title="预付款余额表"
    show-export
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="预付款余额表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户编号"><el-input v-model="searchForm.customerCode" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="customerCode" label="客户编号" width="120" />
        <el-table-column prop="customerName" label="客户名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="salesUserName" label="销售员" width="90" />
        <el-table-column prop="trackingUserName" label="跟单员" width="90" />
        <el-table-column prop="totalAmount" label="预付款总额" width="130" align="right">
          <template #default="{ row }">{{ row.totalAmount?.toLocaleString() ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="usedAmount" label="已使用金额" width="130" align="right">
          <template #default="{ row }">{{ row.usedAmount?.toLocaleString() ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="frozenAmount" label="冻结金额" width="130" align="right">
          <template #default="{ row }">{{ row.frozenAmount?.toLocaleString() ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="availableAmount" label="可用余额" width="130" align="right">
          <template #default="{ row }">
            <span :class="{ 'amount-warning': row.availableAmount < 0 }">{{ row.availableAmount?.toLocaleString() ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="currency" label="币种" width="70" align="center" />
        <el-table-column prop="updateTime" label="更新时间" width="160" />
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getPrepaidBalanceList, type CustomerBalanceItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'

const tableData = ref<CustomerBalanceItem[]>([])
const getSummaries = createAmountSummary(['totalAmount', 'usedAmount', 'frozenAmount', 'availableAmount'])
const searchForm = reactive({ customerName: '', customerCode: '', balanceType: 'prepaid' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: CustomerBalanceItem[] = [
  { id: '1', customerId: '1', customerName: '广州百诺建材有限公司', customerCode: 'C001', salesUserName: '李销售', trackingUserName: '王跟单', balanceType: 'prepaid', totalAmount: 100000, frozenAmount: 0, availableAmount: 80000, usedAmount: 20000, currency: 'CNY', createTime: '2024-01-01', updateTime: '2026-04-20 09:00' },
  { id: '2', customerId: '2', customerName: '深圳鑫源五金贸易', customerCode: 'C002', salesUserName: '陈销售', trackingUserName: '张跟单', balanceType: 'prepaid', totalAmount: 50000, frozenAmount: 5000, availableAmount: 40000, usedAmount: 5000, currency: 'CNY', createTime: '2024-01-01', updateTime: '2026-04-18 10:00' },
]

async function loadData() {
  try {
    const res = await getPrepaidBalanceList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { customerName, customerCode } = searchForm
    const filtered = fallbackData.filter(r => {
      if (customerName && !r.customerName.includes(customerName)) return false
      if (customerCode && !r.customerCode.includes(customerCode)) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { customerName: '', customerCode: '', balanceType: 'prepaid' }); handleSearch() }

const exportColumns = [
  { key: 'customerCode', label: '客户编号' }, { key: 'customerName', label: '客户名称' },
  { key: 'totalAmount', label: '预付款总额' }, { key: 'usedAmount', label: '已使用金额' },
  { key: 'frozenAmount', label: '冻结金额' }, { key: 'availableAmount', label: '可用余额' },
  { key: 'currency', label: '币种' }, { key: 'updateTime', label: '更新时间' },
]

onMounted(() => { loadData() })
</script>

<style scoped>
.amount-warning { color: var(--el-color-danger); }
</style>
