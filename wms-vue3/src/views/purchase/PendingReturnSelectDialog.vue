<template>
  <el-dialog
    title="选择退货明细"
    :model-value="modelValue"
    width="1100px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <el-form :model="filter" inline size="small" class="filter-form">
      <el-form-item label="产品名称">
        <el-input v-model="filter.productName" placeholder="请输入" clearable style="width:150px" @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="入库单号">
        <el-input v-model="filter.receiptNo" placeholder="请输入" clearable style="width:150px" @keyup.enter="handleSearch" />
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
      row-key="purchase_receipt_item_id"
      style="width:100%"
      height="380"
      v-loading="loading"
      @selection-change="handleSelectionChange"
      @row-click="handleRowClick"
    >
      <el-table-column type="selection" width="40" />
      <el-table-column type="index" label="" width="50" align="center" />
      <el-table-column prop="product_code" label="产品编码" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.product_code || '-' }}</template>
      </el-table-column>
      <el-table-column prop="product_name" label="产品名称" min-width="130" show-overflow-tooltip />
      <el-table-column prop="category_name" label="产品类型" width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ row.category_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="unit_name" label="单位" width="70" show-overflow-tooltip>
        <template #default="{ row }">{{ row.unit_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="in_stock_qty" label="入库数量" width="90" align="right" />
      <el-table-column label="退货单价" width="130" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="returnPriceMap[row.purchase_receipt_item_id]"
            :min="0.01"
            :precision="2"
            size="small"
            controls-position="right"
            style="width:100%"
            @click.stop
          />
        </template>
      </el-table-column>
      <el-table-column label="退货数量" width="130" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="returnQtyMap[row.purchase_receipt_item_id]"
            :min="1"
            :max="Number(row.in_stock_qty)"
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
import { getPurchaseInboundItemList, searchPurchaseInboundItems, type PurchaseReceiptLineItem } from '@/api'

const props = defineProps<{
  modelValue: boolean
  supplierId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [items: Array<{
    purchase_order_item_id: string
    return_price: number
    return_qty: number
    product_name: string
    product_code: string
    unit_name: string
  }>]
}>()

const tableRef = ref()
const loading = ref(false)
const list = ref<PurchaseReceiptLineItem[]>([])
const selected = ref<PurchaseReceiptLineItem[]>([])
// 每行的退货单价和退货数量，key 为 purchase_receipt_item_id
const returnPriceMap = reactive<Record<string, number>>({})
const returnQtyMap = reactive<Record<string, number>>({})
const filter = reactive({ productName: '', receiptNo: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

function onOpen() {
  selected.value = []
  filter.productName = ''
  filter.receiptNo = ''
  pagination.page = 1
  Object.keys(returnPriceMap).forEach(k => delete returnPriceMap[k])
  Object.keys(returnQtyMap).forEach(k => delete returnQtyMap[k])
  loadData()
}

async function loadData() {
  if (!props.supplierId) {
    ElMessage.warning('请先选择供应商')
    return
  }
  loading.value = true
  // 保证加载动画至少展示 0.3s，避免数据返回过快导致闪烁
  const minDelay = new Promise(resolve => setTimeout(resolve, 300))
  try {
    let res
    if (filter.productName || filter.receiptNo) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (filter.productName) { searchField.push('product_name'); searchValue.product_name = filter.productName }
      if (filter.receiptNo) { searchField.push('receipt_no'); searchValue.receipt_no = filter.receiptNo }
      res = await searchPurchaseInboundItems({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      res = await getPurchaseInboundItemList({
        page: pagination.page
      })
    }
    await minDelay
    list.value = res.data.items ?? []
    pagination.total = res.data.total ?? 0
    // 初始化新加载行的退货数量默认为1，退货单价默认为0（需用户填写）
    list.value.forEach(row => {
      const key = row.purchase_receipt_item_id!
      if (key && returnQtyMap[key] === undefined) {
        returnQtyMap[key] = 1
      }
      if (key && returnPriceMap[key] === undefined) {
        returnPriceMap[key] = 0
      }
    })
  } catch {
    await minDelay
    list.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { filter.productName = ''; filter.receiptNo = ''; handleSearch() }

function handleSelectionChange(val: PurchaseReceiptLineItem[]) {
  selected.value = val
}

function handleRowClick(row: PurchaseReceiptLineItem) {
  tableRef.value?.toggleRowSelection(row)
}

function handleConfirm() {
  if (selected.value.length === 0) {
    ElMessage.warning('请至少选择一条明细')
    return
  }
  // 校验每行必须填写退货单价
  const missingPrice = selected.value.find(row => {
    const key = row.purchase_receipt_item_id!
    return !returnPriceMap[key] || returnPriceMap[key] <= 0
  })
  if (missingPrice) {
    ElMessage.warning(`产品「${missingPrice.product_name}」的退货单价不能为空`)
    return
  }
  const result = selected.value.map(row => {
    const key = row.purchase_receipt_item_id!
    return {
      purchase_order_item_id: row.purchase_order_item_id,
      return_price: returnPriceMap[key],
      return_qty: returnQtyMap[key] || 1,
      product_name: row.product_name || '',
      product_code: row.product_code || '',
      unit_name: row.unit_name || ''
    }
  })
  emit('confirm', result)
  handleClose()
}

function handleClose() { emit('update:modelValue', false) }
</script>

<style scoped>
.filter-form { padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { padding-top: 8px; display: flex; justify-content: flex-end; }
</style>
