<template>
  <el-dialog
    title="选择销售退货单"
    :model-value="modelValue"
    width="860px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="select-layout">
      <div class="left-panel">
        <el-form :model="filter" inline size="small" class="filter-form">
          <el-form-item v-if="!props.customerId" label="客户">
            <el-select
              v-model="innerCustomerId"
              filterable
              remote
              clearable
              reserve-keyword
              placeholder="全部客户"
              :remote-method="searchCustomerOptions"
              :loading="customerLoading"
              style="width:200px"
              @change="onInnerCustomerChange"
              @visible-change="(v: boolean) => v && !customerOptions.length && searchCustomerOptions('')"
            >
              <el-option v-for="c in customerOptions" :key="c.customer_id" :label="c.customer_name" :value="c.customer_id" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="!props.settlementType" label="结算分组">
            <el-radio-group v-model="effSettlementType" @change="onSettlementChange">
              <el-radio-button label="MONTHLY">月结</el-radio-button>
              <el-radio-button label="OTHER">非月结</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="退货单号">
            <el-input v-model="filter.return_no" placeholder="请输入" clearable style="width:150px" @keyup.enter="handleSearch" />
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
          row-key="sales_return_id"
          style="width:100%"
          height="100%"
          highlight-current-row
          v-loading="loading"
          empty-text="暂无数据"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column type="index" :index="indexMethod" label="" width="50" align="center" />
          <el-table-column prop="return_no" label="退货单号" width="180" show-overflow-tooltip />
          <el-table-column prop="customer_name" label="客户" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.customer_name || '-' }}</template>
          </el-table-column>
          <el-table-column prop="sales_order_no" label="关联订单号" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.sales_order_no || '-' }}</template>
          </el-table-column>
          <el-table-column prop="return_amount" label="退款金额" width="110" align="right" show-overflow-tooltip />
          <el-table-column prop="return_date" label="退货日期" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.return_date || '-' }}</template>
          </el-table-column>
          <el-table-column prop="settlement_method_display" label="结算方式" width="100" show-overflow-tooltip />
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
          <li v-for="(item, idx) in selected" :key="item.sales_return_id" class="selected-item">
            <div class="selected-row">
              <span class="selected-name">{{ item.return_no }}</span>
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
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import {
  getPayableSalesReturnsForCustomer,
  searchPayableSalesReturnsForCustomer,
  getCustomerList,
  searchCustomers,
  type PayableSalesReturnItem,
  type PayableSalesReturnQueryParams,
  type CustomerItem,
} from '@/api'
import { buildSearchParams } from '@/utils/data'
import { useDialogOpenReload, useRemoteDialogPagination } from '@/composables/useRemoteDialogPagination'

const props = defineProps<{
  modelValue: boolean
  /** 父级已确定客户时传入（如月结收款单），弹窗内不再选客户 */
  customerId?: string
  /** 显式指定结算分组；未指定时按所选客户的 is_monthly_settlement 推导，可手动切换 */
  settlementType?: 'MONTHLY' | 'OTHER'
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [order: PayableSalesReturnItem]
}>()

const tableRef = ref()
const list = ref<PayableSalesReturnItem[]>([])
const selected = ref<PayableSalesReturnItem[]>([])
const filter = reactive({ return_no: '' })
const { loading, pagination, resetPage, clearPaginationTotal, indexMethod, withMinLoading } = useRemoteDialogPagination()

// ---- 弹窗内客户选择（父级未传 customerId 时启用）----
const innerCustomerId = ref('')
const innerCustomer = ref<CustomerItem | null>(null)
const customerOptions = ref<CustomerItem[]>([])
const customerLoading = ref(false)

const effCustomerId = computed(() => props.customerId || innerCustomerId.value || '')
/**
 * 结算分组筛选：父级显式指定优先（如月结收款单固定 MONTHLY）；
 * 否则默认非月结，选定客户后自动切到该客户对应分组，可手动切换。
 */
const effSettlementType = ref<'MONTHLY' | 'OTHER'>('OTHER')
const activeSettlement = computed<'MONTHLY' | 'OTHER'>(() => props.settlementType || effSettlementType.value)

async function searchCustomerOptions(query: string) {
  customerLoading.value = true
  try {
    const res = query
      ? await searchCustomers({ ...buildSearchParams({ customer_name: query }), page: 1, page_size: 20 })
      : await getCustomerList({ page: 1, page_size: 20 })
    customerOptions.value = res.data.customer ?? []
  } catch {
    customerOptions.value = []
  } finally {
    customerLoading.value = false
  }
}

function onInnerCustomerChange(customerId: string) {
  innerCustomer.value = customerOptions.value.find(c => c.customer_id === customerId) || null
  // 选定客户后自动切到其对应分组，清空客户则恢复默认非月结
  effSettlementType.value = innerCustomer.value?.is_monthly_settlement === 1 ? 'MONTHLY' : 'OTHER'
  selected.value = []
  resetPage()
  loadData()
}

function onSettlementChange() {
  selected.value = []
  resetPage()
  loadData()
}

useDialogOpenReload({
  visible: () => props.modelValue,
  // AddTemplate 用 v-else-if 条件挂载本弹窗：组件出生时 modelValue 已为 true，
  // 非 immediate 的 watch 捕捉不到 false→true 跳变，首开不会加载，故需 immediate
  immediate: true,
  reset: () => {
    selected.value = []
    filter.return_no = ''
    resetPage()
    if (!props.customerId && !customerOptions.value.length) searchCustomerOptions('')
  },
  load: loadData,
})

async function loadData() {
  // 父级固定结算分组（月结场景）时必须带客户上下文，否则无法定位数据
  const customerId = effCustomerId.value
  const settlementType = activeSettlement.value
  if (props.settlementType && !customerId) {
    list.value = []
    clearPaginationTotal()
    return
  }
  try {
    const res = await withMinLoading(() => {
      const base: PayableSalesReturnQueryParams = { page: pagination.page, page_size: pagination.pageSize, settlement_type: settlementType }
      if (customerId) base.customer_id = customerId
      if (filter.return_no) {
        return searchPayableSalesReturnsForCustomer({
          ...base,
          ...buildSearchParams({ return_no: filter.return_no }),
        })
      }
      return getPayableSalesReturnsForCustomer(base)
    })
    list.value = res.data.items ?? []
    pagination.total = res.data.total ?? 0
  } catch {
    list.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  filter.return_no = ''
  if (!props.customerId) {
    innerCustomerId.value = ''
    innerCustomer.value = null
    effSettlementType.value = 'OTHER'
  }
  handleSearch()
}
function handleSelectionChange(val: PayableSalesReturnItem[]) { selected.value = val }
function handleRowClick(row: PayableSalesReturnItem) {
  tableRef.value?.clearSelection()
  tableRef.value?.toggleRowSelection(row, true)
}
function removeSelected(idx: number) {
  const item = selected.value[idx]
  tableRef.value?.toggleRowSelection(item, false)
}
function handleConfirm() {
  if (selected.value.length === 0) { ElMessage.warning('请选择一个销售退货单'); return }
  if (selected.value.length > 1) { ElMessage.warning('只能选择一个销售退货单'); return }
  emit('confirm', selected.value[0])
  handleClose()
}
function handleClose() { emit('update:modelValue', false) }
</script>

<style scoped>
.select-layout { display: flex; gap: 12px; height: 460px; overflow: hidden; }
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
