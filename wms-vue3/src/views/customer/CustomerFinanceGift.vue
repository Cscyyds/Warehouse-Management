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
    :loading="loading"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #actions>
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>增加</el-button>
    </template>
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
      <el-table border :data="tableData" stripe size="default" style="width:100%" row-class-name="table-row" highlight-current-row show-summary :summary-method="getSummaries" @sort-change="handleSortChange" @row-click="handleRowClick">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="customer_id" label="客户ID" min-width="220" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="customer_name" label="客户名称" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="gift_amount" label="赠送余额" width="130" align="right" sortable="custom">
          <template #default="{ row }">{{ row.gift_amount?.toLocaleString() ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="cumulative_used_gift_amount" label="累计已使用" width="130" align="right" sortable="custom">
          <template #default="{ row }">{{ row.cumulative_used_gift_amount?.toLocaleString() ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="remaining_gift_amount" label="可用余额" width="130" align="right" sortable="custom">
          <template #default="{ row }">
            <span :class="{ 'amount-warning': row.remaining_gift_amount < 0 }">{{ row.remaining_gift_amount?.toLocaleString() ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="cumulative_added_gift_amount" label="累计新增" width="130" align="right" sortable="custom">
          <template #default="{ row }">{{ row.cumulative_added_gift_amount?.toLocaleString() ?? '-' }}</template>
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
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<GiftSummaryItem[]>([])
const getSummaries = createAmountSummary(['gift_amount', 'cumulative_used_gift_amount', 'remaining_gift_amount', 'cumulative_added_gift_amount'])
const searchForm = reactive({ customerName: '', customerId: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const loading = ref(false)

async function loadData() {
  loading.value = true
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
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    } else {
      res = await getGiftSummaryList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    }
    tableData.value = res.data.customers
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleRowClick(row: { customer_id: string }) {
  router.push(`/customer/finance/gift/${row.customer_id}`)
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { customerName: '', customerId: '' }); handleSearch() }
function handleAdd() { router.push('/customer/finance/gift/add') }

const exportColumns = [
  { key: 'customer_id', label: '客户ID' }, { key: 'customer_name', label: '客户名称' },
  { key: 'gift_amount', label: '赠送余额' }, { key: 'cumulative_used_gift_amount', label: '累计已使用' },
  { key: 'remaining_gift_amount', label: '可用余额' },
  { key: 'cumulative_added_gift_amount', label: '累计新增' },
]

onMounted(() => { loadData() })
</script>

<style scoped>
.amount-warning { color: var(--el-color-danger); }
:deep(.el-table__footer-wrapper tbody td) {
  background: color-mix(in srgb, var(--el-color-primary-light-9) 45%, transparent);
  font-weight: 600;
}

:deep(.el-table__footer-wrapper tbody td .cell) {
  color: var(--el-text-color-primary);
}

:deep(.el-table__footer-wrapper tbody td:last-child) {
  background: color-mix(in srgb, var(--el-color-warning-light-8) 70%, transparent);
}

:deep(.el-table__footer-wrapper tbody td:last-child .cell) {
  color: var(--el-color-warning-dark-2);
  font-size: 16px;
  font-weight: 700;
}
</style>
