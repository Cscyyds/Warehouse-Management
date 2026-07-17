<template>
  <el-dialog
    title="选择可付款采购订单"
    :model-value="modelValue"
    width="960px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="select-layout">
      <div class="left-panel">
        <el-form :model="filter" inline size="small" class="filter-form">
          <el-form-item label="订单编号">
            <el-input v-model="filter.order_no" placeholder="请输入" clearable style="width:150px" />
          </el-form-item>
          <el-form-item label="结算类型">
            <el-select v-model="filter.settlement_type" style="width:110px" @change="handleSearch">
              <el-option label="非月结" value="OTHER" />
              <el-option label="月结" value="MONTHLY" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
            <el-button size="small" @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>
        <el-table
          ref="tableRef"
          :data="list"
          size="small"
          row-key="purchase_order_id"
          style="width:100%"
          height="360"
          v-loading="loading"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
        >
          <el-table-column type="selection" width="40" :selectable="isSelectable" />
          <el-table-column type="index" label="" width="45" align="center" />
          <el-table-column prop="order_no" label="订单编号" width="180" show-overflow-tooltip />
          <el-table-column prop="payment_method_display" label="结算方式" width="90" />
          <el-table-column prop="payable_amount" label="应付金额" width="110" align="right" />
          <el-table-column prop="pending_payable_amount" label="待付金额" width="110" align="right">
            <template #default="{ row }">
              <span style="color:var(--el-color-danger)">{{ row.pending_payable_amount }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="purchase_status_name" label="采购状态" width="90" />
          <el-table-column prop="order_date" label="订货日期" width="100" />
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
          <li v-for="(item, idx) in selected" :key="item.purchase_order_id" class="selected-item">
            <div class="selected-row">
              <span class="selected-name">{{ item.order_no }}</span>
              <el-icon class="remove-btn" @click="removeSelected(idx)"><Close /></el-icon>
            </div>
            <div class="selected-sub">待付：{{ item.pending_payable_amount }}</div>
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
  getUnpaidOrdersForSupplier, searchUnpaidOrdersForSupplier,
  type UnpaidOrderListItem
} from '@/api'
import { buildSearchParams } from '@/utils/data'
import {
  useDialogDependencyReload,
  useDialogOpenReload,
  useRemoteDialogPagination,
} from '@/composables/useRemoteDialogPagination'

const props = defineProps<{
  modelValue: boolean
  supplierId: string
  excludeOrderIds?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirmMultiple': [orders: UnpaidOrderListItem[]]
}>()

const tableRef = ref()
const list = ref<UnpaidOrderListItem[]>([])
const selected = ref<UnpaidOrderListItem[]>([])
const filter = reactive({ order_no: '', settlement_type: 'OTHER' as 'OTHER' | 'MONTHLY' })
const { loading, pagination, resetPage, clearPaginationTotal, withMinLoading } = useRemoteDialogPagination()

useDialogOpenReload({
  visible: () => props.modelValue,
  reset: () => {
    selected.value = []
    filter.order_no = ''
    filter.settlement_type = 'OTHER'
    resetPage()
  },
  load: loadData,
})

useDialogDependencyReload({
  visible: () => props.modelValue,
  dependency: () => props.supplierId,
  isReady: (supplierId) => !!supplierId,
  reset: () => {
    selected.value = []
    resetPage()
  },
  load: loadData,
})

function isSelectable(row: UnpaidOrderListItem) {
  return !(props.excludeOrderIds ?? []).includes(row.purchase_order_id)
}

async function loadData() {
  if (!props.supplierId) {
    list.value = []
    clearPaginationTotal()
    return
  }
  try {
    const res = await withMinLoading(async () => {
      const { search_field, search_value } = buildSearchParams({ order_no: filter.order_no.trim() || undefined })
      if (!search_field) {
        return getUnpaidOrdersForSupplier({
          supplier_id: props.supplierId,
          settlement_type: filter.settlement_type,
          page: pagination.page,
          page_size: pagination.pageSize,
        })
      }
      return searchUnpaidOrdersForSupplier({
        supplier_id: props.supplierId,
        settlement_type: filter.settlement_type,
        search_field,
        search_value,
        page: pagination.page,
        page_size: pagination.pageSize,
      })
    })
    list.value = res.data.list ?? []
    pagination.total = res.data.total ?? 0
  } catch {
    list.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { filter.order_no = ''; filter.settlement_type = 'OTHER'; handleSearch() }

function handleSelectionChange(val: UnpaidOrderListItem[]) {
  selected.value = val
}

function handleRowClick(row: UnpaidOrderListItem) {
  if (!isSelectable(row)) return
  tableRef.value?.toggleRowSelection(row)
}

function removeSelected(idx: number) {
  const item = selected.value[idx]
  tableRef.value?.toggleRowSelection(item, false)
}

function handleConfirm() {
  if (selected.value.length === 0) {
    ElMessage.warning('请至少选择一条采购订单')
    return
  }
  emit('confirmMultiple', selected.value)
  handleClose()
}

function handleClose() { emit('update:modelValue', false) }
</script>

<style scoped>
.select-layout { display: flex; gap: 12px; height: 480px; overflow: hidden; }
.left-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.filter-form { flex-shrink: 0; padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { flex-shrink: 0; padding-top: 8px; display: flex; justify-content: flex-end; }
.right-panel { flex-shrink: 0; width: 190px; border-left: 1px solid var(--el-border-color-light); padding: 0 10px; display: flex; flex-direction: column; overflow: hidden; }
.right-title { font-size: 13px; font-weight: 500; color: var(--el-text-color-primary); margin-bottom: 8px; flex-shrink: 0; }
.selected-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.selected-item { padding: 5px 0; font-size: 12px; color: var(--el-text-color-regular); border-bottom: 1px solid var(--el-border-color-extra-light); }
.selected-row { display: flex; align-items: center; justify-content: space-between; }
.selected-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.selected-sub { font-size: 11px; color: var(--el-color-danger); margin-top: 2px; }
.remove-btn { flex-shrink: 0; cursor: pointer; color: var(--el-text-color-placeholder); margin-left: 4px; }
.remove-btn:hover { color: var(--el-color-danger); }
.empty-tip { font-size: 12px; color: var(--el-text-color-placeholder); text-align: center; padding: 20px 0; }
</style>
