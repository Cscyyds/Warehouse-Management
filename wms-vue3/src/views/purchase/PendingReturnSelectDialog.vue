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
      <el-form-item label="采购单号">
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
      row-key="purchase_order_item_id"
      reserve-selection
      style="width:100%"
      height="380"
      v-loading="loading"
      @selection-change="handleSelectionChange"
      @row-click="handleRowClick"
    >
      <el-table-column type="selection" width="40" />
      <el-table-column type="index" label="" width="50" align="center" />
      <el-table-column prop="purchase_order_no" label="采购单号" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.purchase_order_no || '-' }}</template>
      </el-table-column>
      <el-table-column prop="product_code" label="产品编码" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.product_code || '-' }}</template>
      </el-table-column>
      <el-table-column prop="product_name" label="产品名称" min-width="130" show-overflow-tooltip />
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
      <el-table-column prop="purchase_price" label="采购单价" width="100" align="right" />
      <el-table-column prop="qty" label="采购数量" width="90" align="right" />
      <el-table-column label="退货单价" width="130" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="returnPriceMap[row.purchase_order_item_id]"
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
            v-model="returnQtyMap[row.purchase_order_item_id]"
            :min="1"
            :max="Number(row.qty)"
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
        @change="handlePageChange"
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
import {
  getPurchaseOrderDetail,
  getPurchaseOrderList,
  getPurchaseReturnDetail,
  getPurchaseReturnList,
  type PurchaseOrderLineItem
} from '@/api'

interface PendingReturnRow extends Omit<PurchaseOrderLineItem, 'purchase_order_item_id' | 'qty'> {
  purchase_order_item_id: string
  purchase_order_no: string
  qty: number
}

const props = defineProps<{
  modelValue: boolean
  supplierId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [items: Array<{
    purchase_order_item_id: string
    purchase_order_no: string
    return_price: number
    return_qty: number
    product_name: string
    product_code: string
    category_name: string
    specification: string
    color: string
    unit_name: string
    purchase_price: string
  }>]
}>()

const tableRef = ref()
const loading = ref(false)
const list = ref<PendingReturnRow[]>([])
const allRows = ref<PendingReturnRow[]>([])
const selected = ref<PendingReturnRow[]>([])
// 每行的退货单价和退货数量，key 为 purchase_order_item_id
const returnPriceMap = reactive<Record<string, number>>({})
const returnQtyMap = reactive<Record<string, number>>({})
const filter = reactive({ productName: '', orderNo: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

function onOpen() {
  selected.value = []
  filter.productName = ''
  filter.orderNo = ''
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
    allRows.value = await loadSupplierPurchaseOrderItems()
    await minDelay
    pagination.total = allRows.value.length
    syncPageData()
    list.value.forEach(row => {
      const key = row.purchase_order_item_id
      if (key && returnQtyMap[key] === undefined) {
        returnQtyMap[key] = 1
      }
      if (key && returnPriceMap[key] === undefined) {
        returnPriceMap[key] = Number(row.purchase_price) || 0
      }
    })
  } catch {
    await minDelay
    allRows.value = []
    list.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { filter.productName = ''; filter.orderNo = ''; handleSearch() }

function handlePageChange() {
  syncPageData()
}

function handleSelectionChange(val: PendingReturnRow[]) {
  selected.value = val
}

function handleRowClick(row: PendingReturnRow) {
  tableRef.value?.toggleRowSelection(row)
}

function handleConfirm() {
  if (selected.value.length === 0) {
    ElMessage.warning('请至少选择一条明细')
    return
  }
  // 校验每行必须填写退货单价
  const missingPrice = selected.value.find(row => {
    const key = row.purchase_order_item_id
    return !returnPriceMap[key] || returnPriceMap[key] <= 0
  })
  if (missingPrice) {
    ElMessage.warning(`产品「${missingPrice.product_name}」的退货单价不能为空`)
    return
  }
  const result = selected.value.map(row => {
    const key = row.purchase_order_item_id
    return {
      purchase_order_item_id: row.purchase_order_item_id || '',
      purchase_order_no: row.purchase_order_no || '',
      return_price: returnPriceMap[key],
      return_qty: returnQtyMap[key] || 1,
      product_name: row.product_name || '',
      product_code: row.product_code || '',
      category_name: row.category_name || '',
      specification: row.specification || '',
      color: row.color || '',
      unit_name: row.unit_name || '',
      purchase_price: row.purchase_price || ''
    }
  })
  emit('confirm', result)
  handleClose()
}

function handleClose() { emit('update:modelValue', false) }

async function loadSupplierPurchaseOrderItems(): Promise<PendingReturnRow[]> {
  const blockingItemIds = await loadBlockingPurchaseOrderItemIds()
  const firstPage = await getPurchaseOrderList({ page: 1 })
  const pageSize = Math.max(1, Number(firstPage.data.page_size || 20))
  const total = Math.max(0, Number(firstPage.data.total || 0))
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const orderList = [...(firstPage.data.purchase_order ?? [])]

  if (totalPages > 1) {
    const restPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => getPurchaseOrderList({ page: index + 2 }))
    )
    restPages.forEach(res => {
      orderList.push(...(res.data.purchase_order ?? []))
    })
  }

  const filteredOrders = orderList.filter(order => {
    if (order.supplier_id !== props.supplierId) return false
    if (filter.orderNo && !(order.order_no || '').includes(filter.orderNo)) return false
    return true
  })

  const detailResponses = await Promise.all(
    filteredOrders.map(order => getPurchaseOrderDetail(order.purchase_order_id))
  )

  return detailResponses.flatMap(res => {
    const detail = res.data
    return (detail.items ?? [])
      .filter(item => !!item.purchase_order_item_id)
      .filter(item => !blockingItemIds.has(String(item.purchase_order_item_id || '')))
      .filter(item => {
        if (!filter.productName) return true
        return (item.product_name || '').includes(filter.productName)
      })
      .map(item => ({
        ...item,
        purchase_order_item_id: item.purchase_order_item_id || '',
        purchase_order_no: detail.order_no || '',
        qty: Number(item.qty || 0)
      }))
  })
}

async function loadBlockingPurchaseOrderItemIds(): Promise<Set<string>> {
  const firstPage = await getPurchaseReturnList({ page: 1 })
  const pageSize = Math.max(1, Number(firstPage.data.page_size || 20))
  const total = Math.max(0, Number(firstPage.data.total || 0))
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const returnList = [...(firstPage.data.purchase_returns ?? [])]

  if (totalPages > 1) {
    const restPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => getPurchaseReturnList({ page: index + 2 }))
    )
    restPages.forEach(res => {
      returnList.push(...(res.data.purchase_returns ?? []))
    })
  }

  const supplierReturns = returnList.filter(item => item.supplier_id === props.supplierId)
  if (supplierReturns.length === 0) {
    return new Set()
  }

  const detailResponses = await Promise.all(
    supplierReturns.map(item => getPurchaseReturnDetail(item.purchase_return_id))
  )

  const blockingIds = new Set<string>()
  detailResponses.forEach(res => {
    const detail = res.data as any
    ;(detail.items ?? []).forEach((item: any) => {
      if (Number(item.item_warehouse_return_status || 0) !== 0 && item.purchase_order_item_id) {
        blockingIds.add(String(item.purchase_order_item_id))
      }
    })
  })

  return blockingIds
}

function syncPageData() {
  const start = (pagination.page - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  list.value = allRows.value.slice(start, end)
}
</script>

<style scoped>
.filter-form { padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { padding-top: 8px; display: flex; justify-content: flex-end; }
</style>
