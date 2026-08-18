<template>
  <el-dialog
    title="选择退货单"
    :model-value="modelValue"
    width="960px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="picker-search">
      <el-input v-model="keyword" placeholder="退货单号" clearable style="width:180px" @keyup.enter="doSearch" />
      <el-input v-model="orderKeyword" placeholder="关联销售单号" clearable style="width:170px" @keyup.enter="doSearch" />
      <el-tag :type="props.settlementMethod === 'MONTHLY' ? 'primary' : 'info'" size="small">
        {{ props.settlementMethod === 'MONTHLY' ? '结算方式：月结' : '结算方式：其他（现金/挂账/预存款/售后服务）' }}
      </el-tag>
      <el-button type="primary" @click="doSearch">查询</el-button>
      <el-button @click="handleResetSearch">重置</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="tableData"
      size="small"
      stripe
      style="width:100%;margin-top:12px"
      max-height="360"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="46" :selectable="isSelectable" />
      <el-table-column prop="return_no" label="退货单号" min-width="150" show-overflow-tooltip />
      <el-table-column prop="sales_order_no" label="关联销售单号" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.sales_order_no || '-' }}</template>
      </el-table-column>
      <el-table-column label="结算方式" width="100" align="center" show-overflow-tooltip>
        <template #default="{ row }">
          <el-tag :type="settleTagType(row.settlement_method)" size="small">
            {{ row.settlement_method_display || row.settlement_method || '-' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="return_method_display" label="退货方式" width="100" align="center" show-overflow-tooltip />
      <el-table-column prop="return_amount" label="退货金额" width="120" align="right" show-overflow-tooltip />
      <el-table-column prop="return_date" label="退货日期" width="110" align="center" show-overflow-tooltip>
        <template #default="{ row }">{{ row.return_date || '-' }}</template>
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
  getPayableSalesReturnsForCustomer,
  searchPayableSalesReturnsForCustomer,
  type PayableSalesReturnItem,
} from '@/api'
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
  /** 对账类型：MONTHLY=月结；OTHER=其他结算方式（现金/挂账/预存款/售后服务） */
  settlementMethod?: 'MONTHLY' | 'OTHER'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', returns: PayableSalesReturnItem[]): void
}>()

const tableData = ref<PayableSalesReturnItem[]>([])
const selected = ref<PayableSalesReturnItem[]>([])
const keyword = ref('')
const orderKeyword = ref('')
const PAGE_SIZE = 20
const { loading, pagination, clearPaginationTotal, resetPage, withMinLoading } = useRemoteDialogPagination(PAGE_SIZE)

function isSelectable(row: PayableSalesReturnItem) {
  return !props.excludedIds.includes(row.sales_return_id)
}

function settleTagType(v?: string): 'primary' | 'success' | 'warning' | 'info' {
  if (v === 'MONTHLY') return 'primary'
  if (v === 'CREDIT') return 'warning'
  if (v === 'CASH') return 'success'
  return 'info'
}

function handleSelectionChange(rows: PayableSalesReturnItem[]) {
  selected.value = rows
}

function doSearch() {
  resetPage()
  loadData()
}

function handleResetSearch() {
  keyword.value = ''
  orderKeyword.value = ''
  doSearch()
}

async function loadData() {
  // F1/F3 接口要求 customer_id 必填；未选客户时不请求
  if (!props.customerId) {
    tableData.value = []
    clearPaginationTotal()
    return
  }
  const customerId = props.customerId
  // 结算分组：与对账类型一致，客户 + 结算分组同时传，避免搜出全部客户的月结退货单
  const settlementType = props.settlementMethod === 'OTHER' ? 'OTHER' : 'MONTHLY'
  try {
    const res = await withMinLoading(() => {
      const { search_field, search_value } = buildSearchParams({
        return_no: keyword.value.trim() || undefined,
        sales_order_no: orderKeyword.value.trim() || undefined,
      })
      if (!search_field || search_field === '[]') {
        return getPayableSalesReturnsForCustomer({
          customer_id: customerId,
          settlement_type: settlementType,
          page: pagination.page,
          page_size: PAGE_SIZE,
        })
      }
      return searchPayableSalesReturnsForCustomer({
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
    orderKeyword.value = ''
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
    orderKeyword.value = ''
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
