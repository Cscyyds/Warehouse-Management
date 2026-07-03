<template>
  <el-dialog
    title="选择待收货采购明细"
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
      row-key="purchase_order_item_id"
      style="width:100%"
      height="400"
      v-loading="loading"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="40" />
      <el-table-column type="index" label="" width="50" align="center" />
      <!-- 接口46真实字段：purchase_order_no（非 order_no） -->
      <el-table-column prop="purchase_order_no" label="订单编号" width="150" show-overflow-tooltip />
      <el-table-column prop="product_code" label="产品编码" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.product_code || '-' }}</template>
      </el-table-column>
      <el-table-column prop="product_name" label="产品名称" min-width="130" show-overflow-tooltip />
      <el-table-column prop="category_name" label="产品类型" width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ row.category_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="specification" label="规格" width="80" show-overflow-tooltip>
        <template #default="{ row }">{{ row.specification || '-' }}</template>
      </el-table-column>
      <el-table-column prop="color" label="颜色" width="70" show-overflow-tooltip>
        <template #default="{ row }">{{ row.color || '-' }}</template>
      </el-table-column>
      <el-table-column prop="unit_name" label="单位" width="70" show-overflow-tooltip>
        <template #default="{ row }">{{ row.unit_name || '-' }}</template>
      </el-table-column>
      <!-- 接口46真实字段：qty（非 ordered_qty） -->
      <el-table-column prop="qty" label="订单数量" width="90" align="right" />
      <!-- 接口46真实字段：received_qty -->
      <el-table-column prop="received_qty" label="已入库" width="80" align="right" />
      <!-- 接口46真实字段：available_qty（非 pending_qty），= qty - 已入库 - 各种占用 -->
      <el-table-column prop="available_qty" label="可入库" width="80" align="right">
        <template #default="{ row }">
          <span style="color: var(--el-color-primary); font-weight: 500;">{{ row.available_qty }}</span>
        </template>
      </el-table-column>
      <el-table-column label="本次入库数量" width="130" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="inStockQtyMap[row.purchase_order_item_id]"
            :min="1"
            :max="Number(row.available_qty)"
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
  'confirm': [items: Array<{
    purchase_order_item_id: string
    purchase_order_no: string
    in_stock_qty: number
    product_name: string
    product_code: string
    unit_name: string
    category_name: string
    specification: string
    color: string
    purchase_price: string
  }>]
}>()

const tableRef = ref()
const loading = ref(false)
const list = ref<PendingReceiptItem[]>([])
const selected = ref<PendingReceiptItem[]>([])
// key 使用 purchase_order_item_id，避免同商品多行共享同一个数量状态
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
  // 保证加载动画至少展示 0.3s，避免数据返回过快导致闪烁
  const minDelay = new Promise(resolve => setTimeout(resolve, 300))
  try {
    let res
    if (filter.productName || filter.orderNo) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (filter.productName) { searchField.push('product_name'); searchValue.product_name = filter.productName }
      // 接口47搜索字段为 purchase_order_no（非 order_no）
      if (filter.orderNo) { searchField.push('purchase_order_no'); searchValue.purchase_order_no = filter.orderNo }
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
    await minDelay
    list.value = res.data.items ?? []
    pagination.total = res.data.total ?? 0
    // 初始化新加载行的入库数量为可入库数量
    list.value.forEach(row => {
      const rowKey = row.purchase_order_item_id || ''
      if (rowKey && inStockQtyMap[rowKey] === undefined) {
        inStockQtyMap[rowKey] = Number(row.available_qty) || 1
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
function handleReset() { filter.productName = ''; filter.orderNo = ''; handleSearch() }

function handleSelectionChange(val: PendingReceiptItem[]) {
  selected.value = val
}

function handleConfirm() {
  if (selected.value.length === 0) {
    ElMessage.warning('请至少选择一条明细')
    return
  }
  const invalidRow = selected.value.find(row => !row.purchase_order_item_id)
  if (invalidRow) {
    ElMessage.warning(`产品「${invalidRow.product_name || invalidRow.product_code || '-'}」缺少采购明细ID，无法新增入库明细`)
    return
  }
  const result = selected.value.map(row => ({
    purchase_order_item_id: row.purchase_order_item_id || '',
    purchase_order_no: row.purchase_order_no,
    in_stock_qty: inStockQtyMap[row.purchase_order_item_id || ''] || Number(row.available_qty) || 1,
    product_name: row.product_name,
    product_code: row.product_code || '',
    unit_name: row.unit_name || '',
    category_name: row.category_name || '',
    specification: row.specification || '',
    color: row.color || '',
    purchase_price: row.purchase_price || ''
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
