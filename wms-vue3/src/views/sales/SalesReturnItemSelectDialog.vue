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

      <!-- 同单约束提醒 + 目标订单展示：让用户明确只能从哪张销售单里挑 -->
      <div v-if="lockedOrderNo" class="order-lock-hint">
        <el-icon class="hint-icon"><InfoFilled /></el-icon>
        <span class="hint-text">
          本退货单的明细归属销售单号
          <b class="hint-order-no">{{ lockedOrderNo }}</b>
          ，只能选择该单号下的产品退货 —— 下方已用
          <span class="inline-swatch swatch-ok" />绿色
          标出可选范围，其余销售单
          <span class="inline-swatch swatch-off" />置灰不可选。
        </span>
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
              <el-tag v-if="isTargetOrder(row)" size="small" type="success" effect="dark" class="group-tag">本退货单关联</el-tag>
              <el-tag v-else-if="selectedSalesOrderId" size="small" type="info" effect="plain" class="group-tag">非本单·不可选</el-tag>
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
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, InfoFilled } from '@element-plus/icons-vue'
import {
  getAvailableSalesOrderItems, searchAvailableSalesOrderItems,
  type AvailableSalesOrderItem, type AvailableSalesOrderGroup
} from '@/api'

const props = defineProps<{
  modelValue: boolean
  customerId: string
  /** 主表单退货明细中已添加明细所属的销售订单ID；非空时强制锁定为该订单，跨弹窗会话也生效 */
  lockedSalesOrderId?: string
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

// 当前已锁定的销售订单ID（后端要求同一退货单只能对应一个销售订单）
// 优先使用主表单已添加明细的订单（跨弹窗会话持续生效），其次取本次会话内首次勾选的订单
const selectedSalesOrderId = computed(() => {
  if (props.lockedSalesOrderId) return props.lockedSalesOrderId
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
  if (row._isGroup) return 'group-row'
  if (selectedSalesOrderId.value) {
    return row.sales_order_id === selectedSalesOrderId.value ? 'same-order-row' : 'other-order-row'
  }
  return ''
}

/** 该行是否属于本退货单绑定的销售订单（可退范围） */
function isTargetOrder(row: any): boolean {
  return !!selectedSalesOrderId.value && row.sales_order_id === selectedSalesOrderId.value
}

/** 目标销售订单的单号，用于顶部提示条文案 */
const lockedOrderNo = computed<string>(() => {
  const targetId = selectedSalesOrderId.value
  if (!targetId) return ''
  const allGroups = flatItems.value.length
    ? []
    : groups.value
  const hit = allGroups.find(g => g.sales_order_id === targetId)
  if (hit) return hit.order_no || ''
  // 搜索态为扁平明细列表，单号字段名为 sales_order_no
  const row = flatItems.value.find(i => i.sales_order_id === targetId)
  return row?.sales_order_no || ''
})

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

watch(() => props.customerId, (customerId, prevCustomerId) => {
  if (!props.modelValue || !customerId || customerId === prevCustomerId) return
  Object.keys(selectedIds).forEach(k => { selectedIds[k] = false })
  flatItems.value = []
  loadData()
})

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

/* ── 同单 / 跨单视觉区分 ────────────────────────────────────────────
 * 本退货单绑定的销售订单明细高亮为可退区；其余订单置灰弱化，
 * 让用户一眼看出「只能选这张单」，而不是勾了才被禁用提示。
 */
:deep(.same-order-row td.el-table__cell) {
  background-color: var(--el-color-success-light-9) !important;
}
/* stripe 行的斑马底色优先级更高，需针对性覆盖 */
:deep(.el-table__row--striped.same-order-row td.el-table__cell) {
  background-color: var(--el-color-success-light-8) !important;
}
:deep(.same-order-row:hover td.el-table__cell) {
  background-color: var(--el-color-success-light-7) !important;
}
:deep(.other-order-row td.el-table__cell) {
  opacity: 0.45;
}
:deep(.other-order-row .product-name) {
  color: var(--el-text-color-regular);
}

.order-lock-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 14px;
  border: 1px solid var(--el-color-success-light-5);
  border-left: 3px solid var(--el-color-success);
  border-radius: 6px;
  background-color: var(--el-color-success-light-9);
}
.order-lock-hint .hint-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--el-color-success);
  font-size: 15px;
}
.order-lock-hint .hint-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}
.order-lock-hint .hint-order-no {
  margin: 0 2px;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: var(--el-color-success);
  color: #fff;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.inline-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin: 0 4px 0 6px;
  border-radius: 2px;
  vertical-align: -1px;
}
.inline-swatch.swatch-ok { background-color: var(--el-color-success-light-5); }
.inline-swatch.swatch-off { background-color: var(--el-fill-color-dark); }

.group-tag { margin-left: 8px; transform: scale(0.9); transform-origin: left center; }

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
