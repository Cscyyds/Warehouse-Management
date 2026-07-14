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
      <el-table-column prop="return_no" label="退货单号" min-width="150" />
      <el-table-column prop="customer_name" label="客户" min-width="120" />
      <el-table-column prop="return_amount" label="退货金额" width="120" align="right" />
    </el-table>

    <div class="picker-footer-bar">
      <span class="hint">已选 {{ selected.length }} 条</span>
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
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!selected.length" @click="handleConfirm">
        确认选择（{{ selected.length }}）
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getSalesReturnListV2, type SalesReturnListItem } from '@/api'

const props = defineProps<{
  modelValue: boolean
  customerId: string
  excludedIds: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', returns: SalesReturnListItem[]): void
}>()

const loading = ref(false)
const tableData = ref<SalesReturnListItem[]>([])
const selected = ref<SalesReturnListItem[]>([])
const page = ref(1)
const total = ref(0)

function isSelectable(row: SalesReturnListItem) {
  return !props.excludedIds.includes(row.sales_return_id)
}

function handleSelectionChange(rows: SalesReturnListItem[]) {
  selected.value = rows
}

async function loadData() {
  loading.value = true
  const minDelay = new Promise(resolve => setTimeout(resolve, 200))
  try {
    const res = await getSalesReturnListV2({ page: page.value })
    const all = (res.data.sales_returns || []) as SalesReturnListItem[]
    tableData.value = props.customerId
      ? all.filter(r => r.customer_id === props.customerId)
      : all
    total.value = res.data.total || 0
  } catch {
    tableData.value = []
    total.value = 0
  } finally {
    await minDelay
    loading.value = false
  }
}

function handleConfirm() {
  emit('select', selected.value)
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (v) => {
  if (v) { page.value = 1; loadData() }
})
</script>

<style scoped>
.picker-footer-bar { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
.hint { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
