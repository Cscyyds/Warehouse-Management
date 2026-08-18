<template>
  <el-dialog
    title="选择销售订单"
    :model-value="modelValue"
    width="960px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="picker-search">
      <el-input v-model="keyword" placeholder="销售单号" clearable style="width:180px" @keyup.enter="doSearch" />
      <el-input v-model="customerKeyword" placeholder="客户名" clearable style="width:160px" @keyup.enter="doSearch" />
      <el-tag :type="props.settlementMethod === 'MONTHLY' ? 'primary' : 'info'" size="small">
        {{ props.settlementMethod === 'MONTHLY' ? '结算方式：月结' : '结算方式：其他（现金/挂账/预存款/售后服务）' }}
      </el-tag>
      <el-button type="primary" @click="doSearch">查询</el-button>
      <el-button @click="handleResetSearch">重置</el-button>
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
      <el-table-column label="结算方式" show-overflow-tooltip width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="settleTagType(row.settlement_method)" size="small">
            {{ row.settlement_method_display || row.settlement_method || '-' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="receivable_amount" label="应收金额" show-overflow-tooltip width="120" align="right" />
      <el-table-column prop="pending_receivable_amount" label="待收金额" show-overflow-tooltip width="120" align="right" />
      <el-table-column prop="outbound_date" label="出货日期" show-overflow-tooltip width="110" align="center">
        <template #default="{ row }">{{ row.outbound_date || '-' }}</template>
      </el-table-column>
      <el-table-column prop="created_at" label="日期" show-overflow-tooltip width="170" align="center">
        <template #default="{ row }">{{ row.created_at ? formatTableDate(row.created_at) : '-' }}</template>
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
import {
  getUnpaidSalesOrdersForCustomer,
  searchUnpaidSalesOrdersForCustomer,
  type UnpaidSalesOrderItem,
} from '@/api'
import { buildSearchParams } from '@/utils/data'
import { formatTableDate } from '@/utils/date'
import {
  useDialogDependencyReload,
  useDialogOpenReload,
  useRemoteDialogPagination,
} from '@/composables/useRemoteDialogPagination'

const props = defineProps<{
  modelValue: boolean
  customerId: string
  excludedIds: string[]
  /** 对账类型：MONTHLY=月结；OTHER=其他结算方式（现金/挂账/预存款/售后服务） */
  settlementMethod?: 'MONTHLY' | 'OTHER'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', orders: UnpaidSalesOrderItem[]): void
}>()

const tableData = ref<UnpaidSalesOrderItem[]>([])
const selected = ref<UnpaidSalesOrderItem[]>([])
const keyword = ref('')
const customerKeyword = ref('')
const PAGE_SIZE = 20
const { loading, pagination, clearPaginationTotal, resetPage, withMinLoading } = useRemoteDialogPagination(PAGE_SIZE)

function isSelectable(row: UnpaidSalesOrderItem) {
  return !props.excludedIds.includes(row.sales_order_id)
}

function settleTagType(v?: string): 'primary' | 'success' | 'warning' | 'info' {
  if (v === 'MONTHLY') return 'primary'
  if (v === 'CREDIT') return 'warning'
  if (v === 'CASH') return 'success'
  return 'info'
}

function handleSelectionChange(rows: UnpaidSalesOrderItem[]) {
  selected.value = rows
}

function doSearch() {
  resetPage()
  loadData()
}

function handleResetSearch() {
  keyword.value = ''
  customerKeyword.value = ''
  doSearch()
}

async function loadData() {
  // F2/F4 接口要求 customer_id 必填；未选客户时不请求
  if (!props.customerId) {
    tableData.value = []
    clearPaginationTotal()
    return
  }
  const customerId = props.customerId
  // 结算分组：月结对账取 MONTHLY，其他结算方式对账取 OTHER（后端按非月结集合过滤）
  const settlementType = props.settlementMethod === 'OTHER' ? 'OTHER' : 'MONTHLY'
  try {
    const res = await withMinLoading(() => {
      const { search_field, search_value } = buildSearchParams({
        sales_order_no: keyword.value.trim() || undefined,
        customer_name: customerKeyword.value.trim() || undefined,
      })
      if (!search_field || search_field === '[]') {
        return getUnpaidSalesOrdersForCustomer({
          customer_id: customerId,
          settlement_type: settlementType,
          page: pagination.page,
          page_size: PAGE_SIZE,
        })
      }
      return searchUnpaidSalesOrdersForCustomer({
        customer_id: customerId,
        settlement_type: settlementType,
        search_field,
        search_value,
        page: pagination.page,
        page_size: PAGE_SIZE,
      })
    })
    tableData.value = res.data.items || []
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
    customerKeyword.value = ''
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
    customerKeyword.value = ''
    selected.value = []
    resetPage()
  },
  load: loadData,
})
</script>

<style scoped>
.picker-search { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.picker-footer-bar { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
.hint { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
