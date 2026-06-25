<template>
  <ListTemplate
    title="赠送金额余额表"
    show-export
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="赠送金额余额表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #actions>
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>增加</el-button>
    </template>
    <template #search>
      <el-form :model="searchForm" inline size="default" label-width="70px">
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户ID"><el-input v-model="searchForm.customerId" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries" :cell-style="{ padding: '4px 0' }">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="customer_id" label="客户ID" width="120" />
        <el-table-column prop="customer_name" label="客户名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="gift_amount" label="赠送总额" width="130" align="right">
          <template #default="{ row }">{{ row.gift_amount?.toLocaleString() ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="gift_used_total" label="已使用金额" width="130" align="right">
          <template #default="{ row }">{{ row.gift_used_total?.toLocaleString() ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="gift_remaining" label="可用余额" width="130" align="right">
          <template #default="{ row }">
            <span :class="{ 'amount-warning': row.gift_remaining < 0 }">{{ row.gift_remaining?.toLocaleString() ?? '-' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { getGiftSummaryList, searchGiftSummary, type GiftSummaryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'

const router = useRouter()
const tableData = ref<GiftSummaryItem[]>([])
const getSummaries = createAmountSummary(['gift_amount', 'gift_used_total', 'gift_remaining'])
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
      res = await searchGiftSummary({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      res = await getGiftSummaryList({ page: pagination.page })
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
function handleAdd() { router.push('/customer/finance/gift/add') }

const exportColumns = [
  { key: 'customer_id', label: '客户ID' }, { key: 'customer_name', label: '客户名称' },
  { key: 'gift_amount', label: '赠送总额' }, { key: 'gift_used_total', label: '已使用金额' },
  { key: 'gift_remaining', label: '可用余额' },
]

onMounted(() => { loadData() })
</script>

<style scoped>
.amount-warning { color: var(--el-color-danger); }
</style>
