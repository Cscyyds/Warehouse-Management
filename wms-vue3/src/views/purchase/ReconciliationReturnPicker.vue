<template>
  <el-dialog
    title="选择退货单"
    :model-value="modelValue"
    width="800px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="picker-toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索退货单号"
        clearable
        style="width: 240px"
        @keyup.enter="doSearch"
      />
      <el-button type="primary" @click="doSearch">搜索</el-button>
      <el-button @click="keyword = ''; doSearch()">重置</el-button>
    </div>

    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="tableData"
      stripe
      size="small"
      style="width: 100%; margin-top: 12px"
      max-height="400"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="45" :selectable="isSelectable" />
      <el-table-column prop="return_no" label="退货单号" min-width="150" show-overflow-tooltip />
      <el-table-column prop="supplier_name" label="供应商" min-width="120" show-overflow-tooltip />
      <el-table-column prop="return_amount" label="退货金额" width="120" align="right" show-overflow-tooltip />
      <el-table-column prop="warehouse_status_name" label="仓库状态" width="100" align="center" show-overflow-tooltip />
      <el-table-column prop="created_at" label="创建时间" width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
      </el-table-column>
    </el-table>

    <div class="picker-pagination">
      <el-pagination
        small
        layout="total, prev, pager, next"
        :total="pagination.total"
        :page-size="PAGE_SIZE"
        v-model:current-page="pagination.page"
        @current-change="loadData"
      />
    </div>

    <template #footer>
      <span class="picker-footer-hint">已选 {{ selected.length }} 条</span>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="selected.length === 0" @click="handleConfirm">确认添加</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { searchPurchaseReturn } from '@/api'
import type { PurchaseReturnListItem } from '@/api'
import { formatTableDate } from '@/utils/date'
import { buildSearchParams } from '@/utils/data'
import {
  useDialogDependencyReload,
  useDialogOpenReload,
  useRemoteDialogPagination,
} from '@/composables/useRemoteDialogPagination'

const props = defineProps<{
  modelValue: boolean
  supplierId: string
  excludedIds?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', returns: Array<{ purchase_return_id: string; return_no: string; return_amount: string }>): void
}>()

const tableData = ref<PurchaseReturnListItem[]>([])
const keyword = ref('')
const selected = ref<PurchaseReturnListItem[]>([])
const tableRef = ref()
const PAGE_SIZE = 20
const { loading, pagination, clearPaginationTotal, resetPage, withMinLoading } = useRemoteDialogPagination(PAGE_SIZE)

function isSelectable(row: PurchaseReturnListItem) {
  return !(props.excludedIds || []).includes(row.purchase_return_id)
}

function handleSelectionChange(rows: PurchaseReturnListItem[]) {
  selected.value = rows
}

async function loadData() {
  if (!props.supplierId) {
    tableData.value = []
    clearPaginationTotal()
    return
  }
  try {
    const response = await withMinLoading(() => {
      const { search_field, search_value } = buildSearchParams({
        supplier_id: props.supplierId,
        return_no: keyword.value.trim() || undefined,
      })
      return searchPurchaseReturn({
        search_field,
        search_value,
        page: pagination.page,
        page_size: PAGE_SIZE,
        sort_by: 'created_at',
        sort_order: 'DESC'
      })
    })
    tableData.value = response.data.purchase_returns || []
    pagination.total = response.data.total || 0
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function doSearch() {
  resetPage()
  loadData()
}

function handleConfirm() {
  const returns = selected.value.map(r => ({
    purchase_return_id: r.purchase_return_id,
    return_no: r.return_no,
    return_amount: r.return_amount
  }))
  emit('select', returns)
  emit('update:modelValue', false)
}

useDialogOpenReload({
  visible: () => props.modelValue,
  reset: () => {
    keyword.value = ''
    selected.value = []
    resetPage()
  },
  load: loadData,
})

useDialogDependencyReload({
  visible: () => props.modelValue,
  dependency: () => props.supplierId,
  isReady: (supplierId) => !!supplierId,
  reset: () => {
    keyword.value = ''
    selected.value = []
    resetPage()
  },
  load: loadData,
})
</script>

<style scoped>
.picker-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}
.picker-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.picker-footer-hint {
  float: left;
  line-height: 32px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
