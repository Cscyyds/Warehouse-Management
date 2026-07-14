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
      <el-table-column prop="sales_order_no" label="销售单号" min-width="150" />
      <el-table-column prop="customer_name" label="客户" min-width="120" />
      <el-table-column prop="receivable_amount" label="应收金额" width="120" align="right" />
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
import { getSalesOrderListV2, searchSalesOrdersV2 } from '@/api'
import type { SalesOrderListItemV2 } from '@/api'

const props = defineProps<{
  modelValue: boolean
  customerId: string
  excludedIds: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', orders: SalesOrderListItemV2[]): void
}>()

const loading = ref(false)
const tableData = ref<SalesOrderListItemV2[]>([])
const selected = ref<SalesOrderListItemV2[]>([])
const keyword = ref('')
const page = ref(1)
const total = ref(0)

function isSelectable(row: SalesOrderListItemV2) {
  return !props.excludedIds.includes(row.sales_order_id)
}

function handleSelectionChange(rows: SalesOrderListItemV2[]) {
  selected.value = rows
}

async function loadData() {
  loading.value = true
  const minDelay = new Promise(resolve => setTimeout(resolve, 200))
  try {
    if (keyword.value.trim()) {
      const fields: string[] = []
      const values: Record<string, unknown> = {}
      fields.push('customer_id')
      values['customer_id'] = props.customerId
      if (keyword.value.trim()) {
        fields.push('sales_order_no')
        values['sales_order_no'] = keyword.value.trim()
      }
      const res = await searchSalesOrdersV2({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: page.value,
      })
      tableData.value = res.data.sales_orders || []
      total.value = res.data.total || 0
    } else {
      const res = await getSalesOrderListV2({ page: page.value })
      const all = res.data.sales_orders || []
      tableData.value = props.customerId
        ? all.filter((o: SalesOrderListItemV2) => o.customer_id === props.customerId)
        : all
      total.value = res.data.total || 0
    }
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
  if (v) { keyword.value = ''; page.value = 1; loadData() }
})
</script>

<style scoped>
.picker-search { display: flex; gap: 8px; align-items: center; }
.picker-footer-bar { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
.hint { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
