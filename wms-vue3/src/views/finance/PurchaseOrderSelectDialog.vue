<template>
  <el-dialog
    title="选择采购订单"
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
          <el-form-item v-if="!supplierId" label="供应商">
            <el-input v-model="filter.supplier_name" placeholder="请输入" clearable style="width:140px" />
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
          highlight-current-row
          v-loading="loading"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column type="index" label="" width="50" align="center" />
          <el-table-column prop="order_no" label="订单编号" width="180" show-overflow-tooltip />
          <el-table-column prop="supplier_name" label="供应商" min-width="140" show-overflow-tooltip />
          <el-table-column prop="order_amount" label="订单金额" width="110" align="right" />
          <el-table-column prop="payable_amount" label="应付金额" width="110" align="right" />
          <el-table-column prop="order_date" label="订单日期" width="110" />
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
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { getPurchaseOrderList, searchPurchaseOrders, type PurchaseOrderListItem } from '@/api'

const props = withDefaults(defineProps<{
  modelValue: boolean
  multiple?: boolean
  supplierId?: string
  monthlyOnly?: boolean
}>(), { multiple: false, monthlyOnly: false })

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [order: PurchaseOrderListItem]
  'confirmMultiple': [orders: PurchaseOrderListItem[]]
}>()

const tableRef = ref()
const loading = ref(false)
const list = ref<PurchaseOrderListItem[]>([])
const selected = ref<PurchaseOrderListItem[]>([])
const filter = reactive({ order_no: '', supplier_name: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

watch(() => props.modelValue, (val) => {
  if (val) {
    selected.value = []
    filter.order_no = ''
    filter.supplier_name = ''
    pagination.page = 1
    loadData()
  }
}, { immediate: true })

async function loadData() {
  loading.value = true
  const minDelay = new Promise(resolve => setTimeout(resolve, 300))
  try {
    const searchField: string[] = []
    const searchValue: Record<string, unknown> = {}

    if (props.supplierId) { searchField.push('supplier_id'); searchValue.supplier_id = props.supplierId }
    if (props.monthlyOnly) { searchField.push('payment_method'); searchValue.payment_method = 'MONTHLY' }
    if (filter.order_no) { searchField.push('order_no'); searchValue.order_no = filter.order_no }
    if (filter.supplier_name) { searchField.push('supplier_name'); searchValue.supplier_name = filter.supplier_name }

    let res
    if (searchField.length > 0) {
      res = await searchPurchaseOrders({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      res = await getPurchaseOrderList({ page: pagination.page })
    }
    await minDelay
    list.value = res.data.purchase_order ?? []
    pagination.total = res.data.total ?? 0
  } catch {
    await minDelay
    list.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { filter.order_no = ''; filter.supplier_name = ''; handleSearch() }

function handleSelectionChange(val: PurchaseOrderListItem[]) {
  selected.value = val
}

function handleRowClick(row: PurchaseOrderListItem) {
  if (props.multiple) {
    tableRef.value?.toggleRowSelection(row)
  } else {
    tableRef.value?.clearSelection()
    tableRef.value?.toggleRowSelection(row, true)
  }
}

function removeSelected(idx: number) {
  const item = selected.value[idx]
  tableRef.value?.toggleRowSelection(item, false)
}

function handleConfirm() {
  if (selected.value.length === 0) {
    ElMessage.warning('请至少选择一个采购订单')
    return
  }
  if (props.multiple) {
    emit('confirmMultiple', selected.value)
  } else {
    if (selected.value.length > 1) {
      ElMessage.warning('只能选择一个采购订单')
      return
    }
    emit('confirm', selected.value[0])
  }
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
