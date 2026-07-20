<template>
  <el-dialog
    title="选择销售订单"
    :model-value="modelValue"
    width="900px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="select-layout">
      <div class="left-panel">
        <el-form :model="filter" inline size="small" class="filter-form">
          <el-form-item label="订单编号">
            <el-input v-model="filter.order_no" placeholder="请输入" clearable style="width:150px" />
          </el-form-item>
          <el-form-item label="客户">
            <el-input v-model="filter.customer_name" placeholder="请输入" clearable style="width:140px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
            <el-button size="small" @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>
        <el-table
          class="select-dialog-table"
          ref="tableRef"
          :data="list"
          size="small"
          row-key="sales_order_id"
          style="width:100%"
          height="100%"
          highlight-current-row
          v-loading="loading"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column type="index" :index="indexMethod" label="" width="50" align="center" />
          <el-table-column prop="sales_order_no" label="订单编号" width="180" show-overflow-tooltip />
          <el-table-column prop="customer_name" label="客户" min-width="140" show-overflow-tooltip />
          <el-table-column prop="receivable_amount" label="应收金额" width="110" align="right" show-overflow-tooltip />
          <el-table-column prop="pending_receivable_amount" label="待收金额" width="110" align="right" show-overflow-tooltip />
          <el-table-column prop="outbound_date" label="出货日期" width="110" show-overflow-tooltip />
        </el-table>
        <div class="pagination-bar">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            small
            @change="loadData"
          />
        </div>
      </div>
      <div class="right-panel">
        <div class="right-title">已选择 {{ selected.length }} 项：</div>
        <ul class="selected-list">
          <li v-for="(item, idx) in selected" :key="item.sales_order_id" class="selected-item">
            <div class="selected-row">
              <span class="selected-name">{{ item.sales_order_no }}</span>
              <el-icon class="remove-btn" @click="removeSelected(idx)"><Close /></el-icon>
            </div>
          </li>
          <li v-if="selected.length === 0" class="empty-tip">暂未选择</li>
        </ul>
      </div>
    </div>
    <template #footer>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import {
  getUnpaidSalesOrdersForCustomer,
  searchUnpaidSalesOrdersForCustomer,
  type UnpaidSalesOrderItem,
} from '@/api'
import { buildSearchParams } from '@/utils/data'
import {
  useDialogDependencyReload,
  useDialogOpenReload,
  useRemoteDialogPagination,
} from '@/composables/useRemoteDialogPagination'

const props = defineProps<{ modelValue: boolean; customerId?: string }>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [order: UnpaidSalesOrderItem]
}>()

const tableRef = ref()
const list = ref<UnpaidSalesOrderItem[]>([])
const selected = ref<UnpaidSalesOrderItem[]>([])
const filter = reactive({ order_no: '', customer_name: '' })
const { loading, pagination, resetPage, clearPaginationTotal, indexMethod, withMinLoading } = useRemoteDialogPagination()

useDialogOpenReload({
  visible: () => props.modelValue,
  immediate: true,
  reset: () => {
    selected.value = []
    filter.order_no = ''
    filter.customer_name = ''
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

async function loadData() {
  // F2/F4 接口要求 customer_id 必填；未选客户时不请求
  if (!props.customerId) {
    list.value = []
    clearPaginationTotal()
    return
  }
  const customerId = props.customerId
  try {
    const res = await withMinLoading(async () => {
      const { search_field, search_value } = buildSearchParams({
        sales_order_no: filter.order_no || undefined,
        customer_name: filter.customer_name || undefined,
      })
      if (!search_field) {
        return getUnpaidSalesOrdersForCustomer({
          customer_id: customerId,
          settlement_type: 'OTHER',
          page: pagination.page,
          page_size: pagination.pageSize,
        })
      }
      return searchUnpaidSalesOrdersForCustomer({
        customer_id: customerId,
        settlement_type: 'OTHER',
        search_field,
        search_value,
        page: pagination.page,
        page_size: pagination.pageSize,
      })
    })
    list.value = res.data.items ?? []
    pagination.total = res.data.total ?? 0
  } catch {
    list.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { filter.order_no = ''; filter.customer_name = ''; handleSearch() }

function handleSelectionChange(val: UnpaidSalesOrderItem[]) { selected.value = val }

function handleRowClick(row: UnpaidSalesOrderItem) {
  tableRef.value?.clearSelection()
  tableRef.value?.toggleRowSelection(row, true)
}

function removeSelected(idx: number) {
  const item = selected.value[idx]
  tableRef.value?.toggleRowSelection(item, false)
}

function handleConfirm() {
  if (selected.value.length === 0) { ElMessage.warning('请选择一个销售订单'); return }
  if (selected.value.length > 1) { ElMessage.warning('只能选择一个销售订单'); return }
  emit('confirm', selected.value[0])
  handleClose()
}

function handleClose() { emit('update:modelValue', false) }
</script>

<style scoped>
.select-layout { display: flex; gap: 12px; height: 480px; overflow: hidden; }
.left-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.filter-form { flex-shrink: 0; padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { flex-shrink: 0; padding-top: 8px; display: flex; justify-content: flex-end; }
.right-panel { flex-shrink: 0; width: 180px; border-left: 1px solid var(--el-border-color-light); padding: 0 10px; display: flex; flex-direction: column; overflow: hidden; }
.right-title { font-size: 13px; font-weight: 500; color: var(--el-text-color-primary); margin-bottom: 8px; flex-shrink: 0; }
.selected-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.selected-item { padding: 5px 0; font-size: 12px; color: var(--el-text-color-regular); border-bottom: 1px solid var(--el-border-color-extra-light); }
.selected-row { display: flex; align-items: center; justify-content: space-between; }
.selected-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.remove-btn { flex-shrink: 0; cursor: pointer; color: var(--el-text-color-placeholder); margin-left: 4px; }
.remove-btn:hover { color: var(--el-color-danger); }
.empty-tip { font-size: 12px; color: var(--el-text-color-placeholder); text-align: center; padding: 20px 0; }
</style>
