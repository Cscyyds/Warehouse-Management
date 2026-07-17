<template>
  <ListTemplate
    title="供应商授信余额表"
    :loading="loading"
    :show-add="false"
    show-export
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="供应商授信余额表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default" label-width="80px" class="supplier-search-form">
        <el-form-item label="供应商名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:150px" /></el-form-item>
        <el-form-item label="供应商编码"><el-input v-model="searchForm.code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="供应商ID"><el-input v-model="searchForm.id" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-table border :data="tableData" stripe size="default" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries" @sort-change="onSortChange">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="supplier_id" label="供应商ID" min-width="220" show-overflow-tooltip />
        <el-table-column prop="supplier_name" label="供应商名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="supplier_code" label="编码" min-width="160" show-overflow-tooltip />
        <el-table-column prop="contact_phone" label="联系电话" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.contact_phone || '-' }}</template>
        </el-table-column>
        <el-table-column prop="remaining_credit_amount" column-key="credit_amount" label="授信余额" width="140" align="right" sortable="custom">
          <template #default="{ row }">
            <span :class="{ 'amount-warning': Number(row.remaining_credit_amount) < 0 }">{{ formatMoney(row.remaining_credit_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleDetail(row)">详情</el-button>
            <el-button type="primary" link size="small" @click="handleAdd(row)">新增/调减</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getSupplierCreditSummaryList, searchSupplierCreditSummary, type SupplierCreditSummaryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()

const loading = ref(false)

// ---------------- 金额格式化 ----------------
function formatMoney(value: unknown) {
  const amount = Number(value ?? 0)
  return isNaN(amount) ? '-' : amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const tableData = ref<SupplierCreditSummaryItem[]>([])
const searchForm = reactive({ name: '', code: '', id: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const getSummaries = createAmountSummary(['remaining_credit_amount'])
const { sortBy, sortOrder, handleSortChange: onSortChange } = useTableSort(loadData)

async function loadData() {
  loading.value = true
  try {
    let res
    if (searchForm.name || searchForm.code || searchForm.id) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.name) { searchField.push('supplier_name'); searchValue.supplier_name = searchForm.name }
      if (searchForm.code) { searchField.push('supplier_code'); searchValue.supplier_code = searchForm.code }
      if (searchForm.id) { searchField.push('supplier_id'); searchValue.supplier_id = searchForm.id }
      res = await searchSupplierCreditSummary({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    } else {
      res = await getSupplierCreditSummaryList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    }
    tableData.value = res.data.items ?? []
    pagination.total = res.data.total ?? 0
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', code: '', id: '' }); handleSearch() }

/** 新增/调减（行内按钮，带当前行供应商预填） */
function handleAdd(row: SupplierCreditSummaryItem) {
  router.push({
    path: '/purchase/supplier/credit/add',
    query: { supplier_id: row.supplier_id, supplier_name: row.supplier_name },
  })
}

function handleDetail(row: SupplierCreditSummaryItem) {
  router.push({
    path: '/purchase/supplier/credit/detail',
    query: { supplier_id: row.supplier_id, supplier_name: row.supplier_name, supplier_code: row.supplier_code || '' },
  })
}

const exportColumns = [
  { key: 'supplier_id', label: '供应商ID' }, { key: 'supplier_name', label: '供应商名称' },
  { key: 'supplier_code', label: '编码' }, { key: 'contact_phone', label: '联系电话' },
  { key: 'remaining_credit_amount', label: '授信余额' },
]

onMounted(() => { loadData() })
</script>

<style scoped>
.amount-warning { color: var(--el-color-danger); }
:deep(.supplier-search-form .el-form-item__label) {
  width: 96px !important;
  white-space: nowrap;
}

:deep(.el-table__footer-wrapper tbody td) {
  background: color-mix(in srgb, var(--el-color-primary-light-9) 45%, transparent);
  font-weight: 600;
}

:deep(.el-table__footer-wrapper tbody td .cell) {
  color: var(--el-text-color-primary);
}

:deep(.el-table__footer-wrapper tbody td:nth-last-child(2)) {
  background: color-mix(in srgb, var(--el-color-warning-light-8) 70%, transparent);
}

:deep(.el-table__footer-wrapper tbody td:nth-last-child(2) .cell) {
  color: var(--el-color-warning-dark-2);
  font-size: 16px;
  font-weight: 700;
}
</style>
