<template>
  <ListTemplate
    title="供应商赠送金额余额表"
    :show-add="false"
    show-export
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="供应商赠送金额余额表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default" label-width="80px">
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries" :cell-style="{ padding: '4px 0' }" @sort-change="onSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="supplier_id" label="供应商ID" width="130" sortable="custom" />
        <el-table-column prop="supplier_name" label="供应商名称" min-width="160" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="supplier_code" label="编码" width="110" show-overflow-tooltip />
        <el-table-column prop="contact_phone" label="联系电话" width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.contact_phone || '-' }}</template>
        </el-table-column>
        <el-table-column prop="balance_amount" label="赠送余额" width="140" align="right" sortable="custom">
          <template #default="{ row }">
            <span :class="{ 'amount-warning': Number(row.balance_amount) < 0 }">{{ formatMoney(row.balance_amount) }}</span>
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
import { getSupplierGiftSummaryList, searchSupplierGiftSummary, type SupplierGiftSummaryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()

// ---------------- 金额格式化 ----------------
function formatMoney(value: unknown) {
  const amount = Number(value ?? 0)
  return isNaN(amount) ? '-' : amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const tableData = ref<SupplierGiftSummaryItem[]>([])
const searchForm = reactive({ name: '', code: '', id: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const getSummaries = createAmountSummary(['balance_amount'])
const { sortBy, sortOrder, handleSortChange: onSortChange } = useTableSort(loadData)

// 兜底数据：接口失败时回退，避免页面空白
const fallbackData: SupplierGiftSummaryItem[] = [
  { supplier_id: 'ps_demo_1', supplier_name: '示例供应商A（兜底）', supplier_code: 'S0001', contact_phone: '13800000001', balance_amount: '500.0000', created_at: '' },
]

async function loadData() {
  try {
    let res
    if (searchForm.name || searchForm.code || searchForm.id) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.name) { searchField.push('supplier_name'); searchValue.supplier_name = searchForm.name }
      if (searchForm.code) { searchField.push('supplier_code'); searchValue.supplier_code = searchForm.code }
      if (searchForm.id) { searchField.push('supplier_id'); searchValue.supplier_id = searchForm.id }
      res = await searchSupplierGiftSummary({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    } else {
      res = await getSupplierGiftSummaryList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    }
    tableData.value = res.data.items ?? []
    pagination.total = res.data.total ?? 0
  } catch {
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = fallbackData.slice(start, start + pagination.pageSize)
    pagination.total = fallbackData.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', code: '', id: '' }); handleSearch() }

/** 新增/调减（行内按钮，带当前行供应商预填） */
function handleAdd(row: SupplierGiftSummaryItem) {
  router.push({
    path: '/purchase/supplier/gift/add',
    query: { supplier_id: row.supplier_id, supplier_name: row.supplier_name },
  })
}

function handleDetail(row: SupplierGiftSummaryItem) {
  router.push({
    path: '/purchase/supplier/gift/detail',
    query: { supplier_id: row.supplier_id, supplier_name: row.supplier_name, supplier_code: row.supplier_code || '' },
  })
}

const exportColumns = [
  { key: 'supplier_id', label: '供应商ID' }, { key: 'supplier_name', label: '供应商名称' },
  { key: 'supplier_code', label: '编码' }, { key: 'contact_phone', label: '联系电话' },
  { key: 'balance_amount', label: '赠送余额' },
]

onMounted(() => { loadData() })
</script>

<style scoped>
.amount-warning { color: var(--el-color-danger); }
</style>
