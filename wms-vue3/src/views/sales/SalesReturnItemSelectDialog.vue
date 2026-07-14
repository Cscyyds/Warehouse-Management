<template>
  <el-dialog
    title="选择可退销售明细"
    :model-value="modelValue"
    width="1100px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="dialog-body">
      <div class="search-bar">
        <el-form inline size="default">
          <el-form-item label="产品名称/编码">
            <el-input v-model="filterKeyword" placeholder="请输入产品名称或编码" clearable style="width:200px" @input="onSearch" />
          </el-form-item>
          <el-form-item label="销售单号">
            <el-input v-model="filterOrderNo" placeholder="请输入销售单号" clearable style="width:200px" @input="onSearch" />
          </el-form-item>
        </el-form>
        <div class="selected-hint">
          <el-tag type="primary" size="large" effect="plain">已选 {{ selectedCount }} 条</el-tag>
        </div>
      </div>

      <el-table
        ref="tableRef"
        :data="displayRows"
        size="default"
        border
        stripe
        row-key="sales_order_item_id"
        v-loading="loading"
        style="width:100%"
        max-height="500"
        :row-class-name="rowClassName"
      >
        <el-table-column label="销售单号 / 产品" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <template v-if="row._isGroup">
              <el-icon style="vertical-align:-2px;margin-right:6px"><Document /></el-icon>
              <span class="group-label">{{ row.order_no }}</span>
            </template>
            <template v-else>
              <span class="product-name">{{ row.product_name }}</span>
              <span v-if="row.product_code" class="product-code">({{ row.product_code }})</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column prop="specification" label="规格" width="110" show-overflow-tooltip>
          <template #default="{ row }"><span v-if="!row._isGroup">{{ row.specification || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="unit_name" label="单位" width="80" align="center">
          <template #default="{ row }"><span v-if="!row._isGroup">{{ row.unit_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="discount_price" label="销售单价" width="110" align="right">
          <template #default="{ row }"><span v-if="!row._isGroup">{{ row.discount_price }}</span></template>
        </el-table-column>
        <el-table-column prop="remaining" label="可退余量" width="90" align="center">
          <template #default="{ row }">
            <el-tag
              v-if="!row._isGroup"
              :type="Number(row.remaining) > 0 ? 'success' : 'danger'"
              size="small"
            >{{ row.remaining }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="退货数量" width="140" align="center">
          <template #default="{ row }">
            <el-input-number
              v-if="!row._isGroup && Number(row.remaining) > 0"
              v-model="qtyMap[row.sales_order_item_id]"
              :min="1"
              :max="Number(row.remaining)"
              :precision="0"
              controls-position="right"
              size="small"
              style="width:120px"
            />
          </template>
        </el-table-column>
        <el-table-column label="退货单价" width="150" align="center">
          <template #default="{ row }">
            <el-input-number
              v-if="!row._isGroup && Number(row.remaining) > 0"
              v-model="priceMap[row.sales_order_item_id]"
              :min="0.01"
              :precision="4"
              controls-position="right"
              size="small"
              style="width:130px"
            />
          </template>
        </el-table-column>
        <el-table-column label="选择" width="70" align="center" fixed="right">
          <template #header>
            <el-checkbox
              :model-value="allSelectableSelected"
              :indeterminate="someSelected"
              @change="toggleAll"
            />
          </template>
          <template #default="{ row }">
            <el-tooltip v-if="isLockedByOrder(row)" content="只能选同一销售订单的明细" placement="top">
              <el-checkbox :model-value="false" disabled />
            </el-tooltip>
            <el-checkbox
              v-else-if="!row._isGroup && Number(row.remaining) > 0"
              v-model="selectedIds[row.sales_order_item_id]"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <span class="footer-hint">确认后将添加到退货明细，可在明细中继续编辑</span>
        <div>
          <el-button size="large" @click="$emit('update:modelValue', false)">取消</el-button>
          <el-button type="primary" size="large" :disabled="selectedCount === 0" @click="handleConfirm">
            确认添加（{{ selectedCount }}）
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import {
  getAvailableSalesOrderItems, searchAvailableSalesOrderItems,
  type AvailableSalesOrderItem, type AvailableSalesOrderGroup
} from '@/api'

const props = defineProps<{
  modelValue: boolean
  customerId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [items: Array<AvailableSalesOrderItem & { return_qty: number; return_price: number }>]
}>()

const loading = ref(false)
const groups = ref<AvailableSalesOrderGroup[]>([])
const flatItems = ref<AvailableSalesOrderItem[]>([])
const filterKeyword = ref('')
const filterOrderNo = ref('')
const qtyMap = reactive<Record<string, number>>({})
const priceMap = reactive<Record<string, number>>({})
const selectedIds = reactive<Record<string, boolean>>({})
let searchTimer: ReturnType<typeof setTimeout> | null = null

// 展示为平铺行：先组标题行再明细行
const displayRows = computed(() => {
  if (flatItems.value.length) return flatItems.value
  const rows: any[] = []
  groups.value.forEach(g => {
    rows.push({ _isGroup: true, order_no: g.order_no, sales_order_id: g.sales_order_id })
    g.children.forEach(item => rows.push(item))
  })
  return rows
})

const selectedCount = computed(() => Object.values(selectedIds).filter(Boolean).length)

// 当前已选中的销售订单ID（后端要求同一退货单只能对应一个销售订单）
const selectedSalesOrderId = computed(() => {
  const allItems: AvailableSalesOrderItem[] = flatItems.value.length
    ? flatItems.value
    : groups.value.flatMap(g => g.children)
  const firstSelected = allItems.find(i => selectedIds[i.sales_order_item_id])
  return firstSelected?.sales_order_id || null
})

// 某行是否因跨订单而被锁定
function isLockedByOrder(row: any): boolean {
  if (row._isGroup || !selectedSalesOrderId.value) return false
  return row.sales_order_id !== selectedSalesOrderId.value
}

const selectableItems = computed(() => {
  const items: AvailableSalesOrderItem[] = flatItems.value.length
    ? flatItems.value
    : groups.value.flatMap(g => g.children)
  // 全选范围：若已有选中订单，只操作同订单行；否则全部可退行
  const filtered = selectedSalesOrderId.value
    ? items.filter(i => i.sales_order_id === selectedSalesOrderId.value)
    : items
  return filtered.filter(i => Number(i.remaining) > 0)
})

const allSelectableSelected = computed(() =>
  selectableItems.value.length > 0 && selectableItems.value.every(i => selectedIds[i.sales_order_item_id])
)

const someSelected = computed(() =>
  selectableItems.value.some(i => selectedIds[i.sales_order_item_id]) && !allSelectableSelected.value
)

function toggleAll(val: boolean) {
  selectableItems.value.forEach(i => { selectedIds[i.sales_order_item_id] = val })
}

function rowClassName({ row }: { row: any }) {
  return row._isGroup ? 'group-row' : ''
}

async function loadData() {
  if (!props.customerId) return
  loading.value = true
  const minDelay = new Promise(resolve => setTimeout(resolve, 200))
  try {
    const res = await getAvailableSalesOrderItems({ customer_id: props.customerId, page: 1, page_size: 100 })
    groups.value = res.data.items || []
    flatItems.value = []
    // 初始化 qty/price map
    groups.value.forEach(g => {
      g.children.forEach(item => {
        if (!qtyMap[item.sales_order_item_id]) qtyMap[item.sales_order_item_id] = 1
        if (!priceMap[item.sales_order_item_id]) priceMap[item.sales_order_item_id] = Number(item.discount_price) || 0
      })
    })
  } catch {
    groups.value = []
  } finally {
    await minDelay
    loading.value = false
  }
}

function onOpen() {
  Object.keys(selectedIds).forEach(k => { selectedIds[k] = false })
  filterKeyword.value = ''
  filterOrderNo.value = ''
  flatItems.value = []
  loadData()
}

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(doSearch, 300)
}

async function doSearch() {
  if (!props.customerId) return
  const kw = filterKeyword.value.trim()
  const orderNo = filterOrderNo.value.trim()
  if (!kw && !orderNo) {
    flatItems.value = []
    return
  }
  loading.value = true
  try {
    const fields: string[] = []
    const values: Record<string, string> = {}
    if (kw) { fields.push('product_name'); values['product_name'] = kw }
    if (orderNo) { fields.push('sales_order_no'); values['sales_order_no'] = orderNo }
    const res = await searchAvailableSalesOrderItems({
      customer_id: props.customerId,
      search_field: JSON.stringify(fields),
      search_value: JSON.stringify(values),
      page: 1,
      page_size: 100
    })
    flatItems.value = (res.data.items as any) || []
    flatItems.value.forEach(item => {
      if (!qtyMap[item.sales_order_item_id]) qtyMap[item.sales_order_item_id] = 1
      if (!priceMap[item.sales_order_item_id]) priceMap[item.sales_order_item_id] = Number(item.discount_price) || 0
    })
  } catch {
    flatItems.value = []
  } finally {
    loading.value = false
  }
}

function handleConfirm() {
  const allItems: AvailableSalesOrderItem[] = flatItems.value.length
    ? flatItems.value
    : groups.value.flatMap(g => g.children)

  const result = allItems
    .filter(item => selectedIds[item.sales_order_item_id])
    .map(item => {
      const qty = qtyMap[item.sales_order_item_id] || 1
      const price = priceMap[item.sales_order_item_id] || 0
      if (qty <= 0 || price <= 0) return null
      return { ...item, return_qty: qty, return_price: price }
    })
    .filter(Boolean) as Array<AvailableSalesOrderItem & { return_qty: number; return_price: number }>

  if (!result.length) { ElMessage.warning('请至少选择一条明细并填写退货数量和单价'); return }
  emit('confirm', result)
  emit('update:modelValue', false)
}
</script>

<style scoped>
.dialog-body { padding: 4px 0; }

.search-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.search-bar .el-form { margin-bottom: 0; }
.search-bar :deep(.el-form-item) { margin-bottom: 0; margin-right: 16px; }

.group-label {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-color-primary);
}
.product-name { font-size: 13px; padding-left: 20px; }
.product-code { color: var(--el-text-color-secondary); margin-left: 5px; font-size: 12px; }

:deep(.group-row) {
  background-color: var(--el-fill-color-light) !important;
}
:deep(.group-row td) {
  background-color: var(--el-fill-color-light) !important;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.footer-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
