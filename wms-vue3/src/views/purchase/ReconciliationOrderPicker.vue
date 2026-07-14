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
        :total="total"
        :page-size="20"
        v-model:current-page="page"
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
import { ref, watch } from 'vue'
import { searchPurchaseOrders } from '@/api'
import type { PurchaseOrderListItem } from '@/api'

const props = defineProps<{
  modelValue: boolean
  supplierId: string
  excludedIds?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', orders: Array<{ purchase_order_id: string; order_no: string; payable_amount: string; paid_amount: string }>): void
}>()

const loading = ref(false)
const tableData = ref<PurchaseOrderListItem[]>([])
const total = ref(0)
const page = ref(1)
const keyword = ref('')
const selected = ref<PurchaseOrderListItem[]>([])
const tableRef = ref()

function isSelectable(row: PurchaseOrderListItem) {
  return !(props.excludedIds || []).includes(row.purchase_order_id)
}

function handleSelectionChange(rows: PurchaseOrderListItem[]) {
  selected.value = rows
}

async function loadData() {
  loading.value = true
  const minDelay = new Promise(resolve => setTimeout(resolve, 200))
  try {
    let response
    if (keyword.value.trim()) {
      response = await searchPurchaseOrders({
        search_field: JSON.stringify(['order_no', 'supplier_id']),
        search_value: JSON.stringify({ order_no: keyword.value.trim(), supplier_id: props.supplierId }),
        page: page.value,
        sort_by: 'created_at',
        sort_order: 'DESC'
      })
    } else {
      response = await searchPurchaseOrders({
        search_field: JSON.stringify(['supplier_id', 'is_audited']),
        search_value: JSON.stringify({ supplier_id: props.supplierId, is_audited: 1 }),
        page: page.value,
        sort_by: 'created_at',
        sort_order: 'DESC'
      })
    }
    tableData.value = response.data.purchase_order || []
    total.value = response.data.total || 0
  } catch {
    tableData.value = []
    total.value = 0
  } finally {
    await minDelay
    loading.value = false
  }
}

function doSearch() {
  page.value = 1
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

watch(() => props.modelValue, (val) => {
  if (val) {
    keyword.value = ''
    selected.value = []
    page.value = 1
    loadData()
  }
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
