<template>
  <el-dialog
    title="选择待收货采购明细"
    :model-value="modelValue"
    width="1000px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <el-form :model="filter" inline size="small" class="filter-form">
      <el-form-item label="产品名称">
        <el-input v-model="filter.productName" placeholder="请输入" clearable style="width:150px" @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="订单编号">
        <el-input v-model="filter.orderNo" placeholder="请输入" clearable style="width:150px" @keyup.enter="handleSearch" />
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
      row-key="item_id"
      style="width:100%"
      height="380"
      v-loading="loading"
      @selection-change="handleSelectionChange"
      @row-click="handleRowClick"
    >
      <el-table-column type="selection" width="40" />
      <el-table-column type="index" label="" width="50" align="center" />
      <el-table-column prop="order_no" label="订单编号" width="150" show-overflow-tooltip />
      <el-table-column prop="product_code" label="产品编码" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.product_code || '-' }}</template>
      </el-table-column>
      <el-table-column prop="product_name" label="产品名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="category_name" label="产品类型" width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ row.category_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="specification" label="规格" width="90" show-overflow-tooltip>
        <template #default="{ row }">{{ row.specification || '-' }}</template>
      </el-table-column>
      <el-table-column prop="color" label="颜色" width="80" show-overflow-tooltip>
        <template #default="{ row }">{{ row.color || '-' }}</template>
      </el-table-column>
      <el-table-column prop="unit_name" label="单位" width="70" show-overflow-tooltip>
        <template #default="{ row }">{{ row.unit_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="ordered_qty" label="订单数量" width="90" align="right" />
      <el-table-column prop="received_qty" label="已入库" width="80" align="right" />
      <el-table-column prop="pending_qty" label="待收货" width="80" align="right">
        <template #default="{ row }">
          <span style="color: var(--el-color-primary); font-weight: 500;">{{ row.pending_qty }}</span>
        </template>
      </el-table-column>
      <el-table-column label="本次入库数量" width="130" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="inStockQtyMap[row.item_id]"
            :min="1"
            :max="Number(row.pending_qty)"
            :precision="0"
            size="small"
            controls-position="right"
            style="width:100%"
            @click.stop
          />
        </template>
      </el-table-column>
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

    <template #footer>
      <span style="font-size:12px; color:var(--el-text-color-secondary); margin-right:auto;">
        已选 {{ selected.length }} 条明细
      </span>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { getPendingReceiptItemList, searchPendingReceiptItems, type PendingReceiptItem } from '@/api'

const props = defineProps<{
  modelValue: boolean
  supplierId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [items: Array<{ purchase_order_item_id: string; in_stock_qty: number; product_name: string; product_code: string; unit_name: string }>]
}>()

const tableRef = ref()
const loading = ref(false)
const list = ref<PendingReceiptItem[]>([])
const selected = ref<PendingReceiptItem[]>([])
// 每行的本次入库数量，key 为 item_id
const inStockQtyMap = reactive<Record<string, number>>({})
const filter = reactive({ productName: '', orderNo: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

function onOpen() {
  selected.value = []
  filter.productName = ''
  filter.orderNo = ''
  pagination.page = 1
  Object.keys(inStockQtyMap).forEach(k => delete inStockQtyMap[k])
  loadData()
}

async function loadData() {
  if (!props.supplierId) {
    ElMessage.warning('请先选择供应商')
    return
  }
  loading.value = true
  try {
    let res
    if (filter.productName || filter.orderNo) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (filter.productName) { searchField.push('product_name'); searchValue.product_name = filter.productName }
      if (filter.orderNo) { searchField.push('order_no'); searchValue.order_no = filter.orderNo }
      res = await searchPendingReceiptItems({
        supplier_id: props.supplierId,
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      res = await getPendingReceiptItemList({
        supplier_id: props.supplierId,
        page: pagination.page
      })
    }
    list.value = res.data.items ?? []
    pagination.total = res.data.total ?? 0
    // 初始化新加载行的入库数量为待收货数量
    list.value.forEach(row => {
      if (inStockQtyMap[row.item_id] === undefined) {
        inStockQtyMap[row.item_id] = Number(row.pending_qty) || 1
      }
    })
  } catch {
    list.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { filter.productName = ''; filter.orderNo = ''; handleSearch() }

function handleSelectionChange(val: PendingReceiptItem[]) {
  selected.value = val
}

function handleRowClick(row: PendingReceiptItem) {
  tableRef.value?.toggleRowSelection(row)
}

function handleConfirm() {
  if (selected.value.length === 0) {
    ElMessage.warning('请至少选择一条明细')
    return
  }
  const result = selected.value.map(row => ({
    purchase_order_item_id: row.item_id,
    in_stock_qty: inStockQtyMap[row.item_id] || Number(row.pending_qty) || 1,
    product_name: row.product_name,
    product_code: row.product_code || '',
    unit_name: row.unit_name || ''
  }))
  emit('confirm', result)
  handleClose()
}

function handleClose() { emit('update:modelValue', false) }
</script>

<style scoped>
.filter-form { padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { padding-top: 8px; display: flex; justify-content: flex-end; }
</style>
