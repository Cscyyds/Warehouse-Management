<template>
  <el-dialog
    title="选择退货单"
    :model-value="modelValue"
    width="720px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-table
      v-loading="loading"
      :data="tableData"
      size="small"
      stripe
      style="width:100%"
      max-height="360"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="46" :selectable="isSelectable" />
      <el-table-column prop="return_no" label="退货单号" min-width="150" show-overflow-tooltip />
      <el-table-column prop="customer_name" label="客户" min-width="120" show-overflow-tooltip />
      <el-table-column prop="return_amount" label="退货金额" width="120" align="right" show-overflow-tooltip />
    </el-table>

    <div class="picker-footer-bar">
      <span class="hint">已选 {{ selected.length }} 条</span>
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
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!selected.length" @click="handleConfirm">
        确认选择（{{ selected.length }}）
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { searchSalesReturnsV2, type SalesReturnListItem } from '@/api'
import { buildSearchParams } from '@/utils/data'
import {
  useDialogDependencyReload,
  useDialogOpenReload,
  useRemoteDialogPagination,
} from '@/composables/useRemoteDialogPagination'

const props = defineProps<{
  modelValue: boolean
  customerId: string
  excludedIds: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', returns: SalesReturnListItem[]): void
}>()

const tableData = ref<SalesReturnListItem[]>([])
const selected = ref<SalesReturnListItem[]>([])
const PAGE_SIZE = 20
const { loading, pagination, clearPaginationTotal, resetPage, withMinLoading } = useRemoteDialogPagination(PAGE_SIZE)

function isSelectable(row: SalesReturnListItem) {
  return !props.excludedIds.includes(row.sales_return_id)
}

function handleSelectionChange(rows: SalesReturnListItem[]) {
  selected.value = rows
}

async function loadData() {
  if (!props.customerId) {
    tableData.value = []
    clearPaginationTotal()
    return
  }
  try {
    const res = await withMinLoading(() => {
      const { search_field, search_value } = buildSearchParams({ customer_id: props.customerId })
      return searchSalesReturnsV2({
        search_field,
        search_value,
        page: pagination.page,
        page_size: PAGE_SIZE,
      })
    })
    tableData.value = (res.data.sales_returns || []) as SalesReturnListItem[]
    pagination.total = res.data.total || 0
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleConfirm() {
  emit('select', selected.value)
  emit('update:modelValue', false)
}

useDialogOpenReload({
  visible: () => props.modelValue,
  reset: () => {
    selected.value = []
    resetPage()
  },
  load: loadData,
})

useDialogDependencyReload({
  visible: () => props.modelValue,
  dependency: () => props.customerId,
  isReady: (customerId) => !!customerId,
  reset: () => {
    selected.value = []
    resetPage()
  },
  load: loadData,
})
</script>

<style scoped>
.picker-footer-bar { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
.hint { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
