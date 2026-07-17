<template>
  <el-dialog
    title="选择采购单"
    :model-value="modelValue"
    width="800px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="picker-toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索采购单号 / 产品名称"
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
      <el-table-column prop="order_no" label="采购单号" min-width="150" show-overflow-tooltip />
      <el-table-column prop="supplier_name" label="供应商" min-width="120" />
      <el-table-column prop="order_date" label="订单日期" width="110" />
      <el-table-column prop="payable_amount" label="应付金额" width="110" align="right" />
      <el-table-column prop="is_audited_name" label="审核状态" width="90" align="center" />
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
import { searchPurchaseOrders } from '@/api'
import type { PurchaseOrderListItem } from '@/api'
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
  (e: 'select', orders: Array<{ purchase_order_id: string; order_no: string; payable_amount: string; paid_amount: string }>): void
}>()

const tableData = ref<PurchaseOrderListItem[]>([])
const keyword = ref('')
const selected = ref<PurchaseOrderListItem[]>([])
const tableRef = ref()
const PAGE_SIZE = 20
const { loading, pagination, clearPaginationTotal, resetPage, withMinLoading } = useRemoteDialogPagination(PAGE_SIZE)

function isSelectable(row: PurchaseOrderListItem) {
  return !(props.excludedIds || []).includes(row.purchase_order_id)
}

function handleSelectionChange(rows: PurchaseOrderListItem[]) {
  selected.value = rows
}

async function loadData() {
  if (!props.supplierId) {
    tableData.value = []
    clearPaginationTotal()
    return
  }
  try {
    const response = await withMinLoading(async () => {
      const { search_field, search_value } = buildSearchParams({
        supplier_id: props.supplierId,
        is_audited: keyword.value.trim() ? undefined : 1,
        order_no: keyword.value.trim() || undefined,
      })
      return searchPurchaseOrders({
        search_field,
        search_value,
        page: pagination.page,
        page_size: PAGE_SIZE,
        sort_by: 'created_at',
        sort_order: 'DESC'
      })
    })
    tableData.value = response.data.purchase_order || []
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
  const orders = selected.value.map(r => ({
    purchase_order_id: r.purchase_order_id,
    order_no: r.order_no,
    payable_amount: r.payable_amount,
    paid_amount: r.paid_amount || '0.00'
  }))
  emit('select', orders)
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
