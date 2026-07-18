<template>
  <el-dialog
    title="选择销售订单"
    :model-value="modelValue"
    width="860px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="picker-search">
      <el-input v-model="keyword" placeholder="单号/客户名" clearable style="width:200px" @keyup.enter="loadData" />
      <el-button type="primary" @click="loadData">查询</el-button>
    </div>

    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="tableData"
      size="small"
      stripe
      style="width:100%;margin-top:12px"
      max-height="360"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="46" :selectable="isSelectable" />
      <el-table-column prop="sales_order_no" label="销售单号" show-overflow-tooltip min-width="150" />
      <el-table-column prop="customer_name" label="客户" show-overflow-tooltip min-width="120" />
      <el-table-column prop="receivable_amount" label="应收金额" show-overflow-tooltip width="120" align="right" />
      <el-table-column prop="audit_status" label="审核状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.audit_status === 1 ? 'success' : 'warning'" size="small">
            {{ row.audit_status === 1 ? '已审核' : '未审核' }}
          </el-tag>
        </template>
      </el-table-column>
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
import { searchSalesOrdersV2 } from '@/api'
import type { SalesOrderListItemV2 } from '@/api'
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
  (e: 'select', orders: SalesOrderListItemV2[]): void
}>()

const tableData = ref<SalesOrderListItemV2[]>([])
const selected = ref<SalesOrderListItemV2[]>([])
const keyword = ref('')
const PAGE_SIZE = 20
const { loading, pagination, clearPaginationTotal, resetPage, withMinLoading } = useRemoteDialogPagination(PAGE_SIZE)

function isSelectable(row: SalesOrderListItemV2) {
  return !props.excludedIds.includes(row.sales_order_id)
}

function handleSelectionChange(rows: SalesOrderListItemV2[]) {
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
      const { search_field, search_value } = buildSearchParams({
        customer_id: props.customerId,
        sales_order_no: keyword.value.trim() || undefined,
      })
      return searchSalesOrdersV2({
        search_field,
        search_value,
        page: pagination.page,
        page_size: PAGE_SIZE,
      })
    })
    tableData.value = res.data.sales_orders || []
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
    keyword.value = ''
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
    keyword.value = ''
    selected.value = []
    resetPage()
  },
  load: loadData,
})
</script>

<style scoped>
.picker-search { display: flex; gap: 8px; align-items: center; }
.picker-footer-bar { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
.hint { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
