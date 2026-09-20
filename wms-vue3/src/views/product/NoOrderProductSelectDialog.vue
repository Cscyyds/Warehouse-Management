<template>
  <el-dialog
    :title="dialogTitle"
    :model-value="modelValue"
    width="1080px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <el-alert
      v-if="supplierMode"
      type="info"
      :closable="false"
      show-icon
      class="mode-hint"
      :title="`已按所选供应商「${supplierName || '当前供应商'}」筛选产品`"
      description="仅显示与该供应商已建立绑定的产品；如需退其他产品请先在上方修改供应商。"
    />
    <el-alert
      v-else
      type="warning"
      :closable="false"
      show-icon
      class="mode-hint"
      title="无来源单据退货"
      description="所选产品不关联任何销售订单，退货数量与单价需手工填写，单据保存后不可再改为关联订单。"
    />

    <el-form :model="filter" inline size="small" class="filter-form">
      <el-form-item label="产品名称">
        <el-input v-model="filter.name" placeholder="请输入" clearable style="width:150px" @keyup.enter="handleSearch" @clear="handleSearch" />
      </el-form-item>
      <el-form-item label="产品编码">
        <el-input v-model="filter.code" placeholder="请输入" clearable style="width:140px" @keyup.enter="handleSearch" @clear="handleSearch" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
        <el-button size="small" @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table
      ref="tableRef"
      :data="pageRows"
      border
      size="small"
      row-key="product_id"
      style="width:100%"
      height="380"
      v-loading="loading"
      :row-class-name="rowClassName"
      @selection-change="onSelectionChange"
      @row-click="handleRowClick"
    >
      <el-table-column type="selection" width="46" align="center" reserve-selection :selectable="isRowSelectable" />
      <el-table-column type="index" :index="indexMethod" label="#" width="50" align="center" />
      <el-table-column prop="product_code" label="产品编码" min-width="150" show-overflow-tooltip />
      <el-table-column prop="product_name" label="产品名称" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ row.product_name }}</span>
          <el-tag v-if="!isRowSelectable(row)" size="small" type="info" class="excluded-tag">已添加</el-tag>
        </template>
      </el-table-column>
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
      <el-table-column v-if="scene === 'purchase'" label="可用库存" width="90" align="right">
        <template #default="{ row }">{{ row.available_stock ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="退货数量" width="130" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="qtyMap[row.product_id]"
            :min="1"
            :precision="0"
            size="small"
            controls-position="right"
            style="width:100%"
            @click.stop
          />
        </template>
      </el-table-column>
      <el-table-column label="退货单价" width="140" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="priceMap[row.product_id]"
            :min="0.01"
            :precision="4"
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
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        small
        @change="onPageChange"
      />
    </div>

    <template #footer>
      <span class="selected-count">已选 {{ selected.length }} 个产品</span>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :disabled="!selected.length" @click="handleConfirm">确认添加（{{ selected.length }}）</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { searchProduct, queryProductSuppliers, type ProductItem } from '@/api'
import { buildSearchParams } from '@/utils/data'
import type { NoOrderProductRow } from './noOrderProduct'

const props = defineProps<{
  modelValue: boolean
  /** 销售退货=不过滤供应商；采购退货=按供应商绑定过滤且展示可用库存 */
  scene: 'sales' | 'purchase'
  supplierId?: string
  supplierName?: string
  /** 明细中已存在的产品ID，不可重复添加 */
  excludeIds?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [rows: NoOrderProductRow[]]
}>()

const tableRef = ref()
const loading = ref(false)
const allRows = ref<ProductItem[]>([])
const page = ref(1)
const pageSize = ref(20)
const filter = reactive({ name: '', code: '' })
const qtyMap = reactive<Record<string, number>>({})
const priceMap = reactive<Record<string, number>>({})
const selected = ref<ProductItem[]>([])
/** 供应商绑定维度价格：preset_purchase_price 优先，其次 avg_cost_price */
const supplierPriceMap = reactive<Record<string, number>>({})

const supplierMode = computed(() => props.scene === 'purchase' && !!props.supplierId)
const dialogTitle = computed(() => (props.scene === 'purchase' ? '选择退货产品（无采购订单）' : '选择退货产品（无销售订单）'))
/** 服务端分页总条数（非供应商模式）；供应商模式为客户端分页，直接用 allRows.length */
const serverTotal = ref(0)
const total = computed(() => (supplierMode.value ? allRows.value.length : serverTotal.value))
const indexMethod = (idx: number) => (page.value - 1) * pageSize.value + idx + 1

// 供应商模式：一次拉全量后客户端分页（product_ids 单次上限 100，需分批）
const pageRows = computed<ProductItem[]>(() => {
  if (!supplierMode.value) return allRows.value
  const start = (page.value - 1) * pageSize.value
  return allRows.value.slice(start, start + pageSize.value)
})

const excludedIdSet = computed<Set<string>>(() => new Set((props.excludeIds || []).map(String)))
function isRowSelectable(row: ProductItem): boolean {
  return !excludedIdSet.value.has(String(row.product_id))
}
function rowClassName({ row }: { row: ProductItem }): string {
  return isRowSelectable(row) ? '' : 'row-excluded'
}

function defaultPrice(row: ProductItem): number {
  if (props.scene === 'purchase') {
    const bound = supplierPriceMap[String(row.product_id)]
    if (bound) return bound
  }
  return Number(row.min_sale_price) || 0
}

/** 供应商模式：先取绑定产品ID，再按 100 一批回查完整产品档案（可拿到 available_stock） */
async function loadSupplierProducts() {
  const pageSizeBind = 100
  const boundIds: string[] = []
  supplierPriceMapClear()
  for (let p = 1; p <= 50; p++) {
    const res = await queryProductSuppliers(props.supplierId as string, { page: p, page_size: pageSizeBind })
    const batch = (res.data?.products ?? []) as unknown as Array<ProductItem & { preset_purchase_price?: string | null; avg_cost_price?: string | null }>
    batch.forEach((b) => {
      boundIds.push(String(b.product_id))
      const price = Number(b.preset_purchase_price ?? 0) || Number(b.avg_cost_price ?? 0) || 0
      if (price > 0) supplierPriceMap[String(b.product_id)] = price
    })
    const totalBind = Number(res.data?.total ?? 0)
    if (!batch.length || boundIds.length >= totalBind) break
  }
  if (!boundIds.length) {
    allRows.value = []
    return
  }
  const { search_field, search_value } = buildSearchParams({
    product_name: filter.name || undefined,
    product_code: filter.code || undefined,
  })
  const merged: ProductItem[] = []
  for (let i = 0; i < boundIds.length; i += 100) {
    const chunk = boundIds.slice(i, i + 100)
    const res = await searchProduct({
      search_field: search_field || '[]',
      search_value: search_value || '{}',
      product_ids: chunk.join(','),
    })
    merged.push(...((res.data?.products ?? []) as ProductItem[]))
  }
  allRows.value = merged
}

function supplierPriceMapClear() {
  Object.keys(supplierPriceMap).forEach((k) => delete supplierPriceMap[k])
}

async function loadAllProducts() {
  const { search_field, search_value } = buildSearchParams({
    product_name: filter.name || undefined,
    product_code: filter.code || undefined,
  })
  const res = await searchProduct({
    search_field: search_field || '[]',
    search_value: search_value || '{}',
    page: page.value,
    page_size: pageSize.value,
  })
  allRows.value = (res.data?.products ?? []) as ProductItem[]
  serverTotal.value = Number(res.data?.total ?? 0)
}

async function loadData() {
  loading.value = true
  try {
    if (supplierMode.value) await loadSupplierProducts()
    else await loadAllProducts()
    allRows.value.forEach((row) => {
      const key = String(row.product_id)
      if (qtyMap[key] === undefined) qtyMap[key] = 1
      if (priceMap[key] === undefined) priceMap[key] = defaultPrice(row)
    })
  } catch {
    allRows.value = []
  } finally {
    loading.value = false
  }
}

function onOpen() {
  selected.value = []
  filter.name = ''
  filter.code = ''
  page.value = 1
  allRows.value = []
  nextTick(() => tableRef.value?.clearSelection())
  if (props.scene === 'purchase' && !props.supplierId) {
    ElMessage.warning('请先选择供应商')
    return
  }
  loadData()
}

function handleSearch() {
  page.value = 1
  loadData()
}
function handleReset() {
  filter.name = ''
  filter.code = ''
  handleSearch()
}
function onPageChange() {
  if (!supplierMode.value) loadData()
}

function handleRowClick(row: ProductItem) {
  if (!isRowSelectable(row)) return
  const checked = selected.value.some((r) => r.product_id === row.product_id)
  tableRef.value?.toggleRowSelection(row, !checked)
}

function onSelectionChange(rows: ProductItem[]) {
  selected.value = rows
}

function handleConfirm() {
  const picked = selected.value.filter(isRowSelectable)
  if (!picked.length) {
    ElMessage.warning('请至少选择一个产品')
    return
  }
  const invalid = picked.find((row) => {
    const key = String(row.product_id)
    return !(qtyMap[key] > 0) || !(priceMap[key] > 0)
  })
  if (invalid) {
    ElMessage.warning(`产品「${invalid.product_name}」的退货数量与单价均须大于 0`)
    return
  }
  const rows: NoOrderProductRow[] = picked.map((row) => {
    const key = String(row.product_id)
    return {
      product_id: key,
      product_code: row.product_code || '',
      product_name: row.product_name || '',
      category_name: row.category_name || '',
      specification: row.specification ?? null,
      color: row.color ?? null,
      unit_id: row.unit_id || '',
      unit_name: row.unit_name || '',
      available_stock: row.available_stock ?? '',
      return_qty: qtyMap[key] || 1,
      return_price: priceMap[key] || 0,
    }
  })
  emit('confirm', rows)
  emit('update:modelValue', false)
}

function handleClose() { emit('update:modelValue', false) }
</script>

<style scoped>
.mode-hint { margin-bottom: 12px; }
.filter-form { padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.filter-form :deep(.el-form-item) { margin-bottom: 8px; }
.pagination-bar { padding-top: 8px; display: flex; justify-content: flex-end; }
.selected-count { margin-right: auto; color: var(--el-text-color-secondary); font-size: 13px; }
.excluded-tag { margin-left: 6px; }
:deep(.row-excluded) { color: var(--el-text-color-placeholder); }
:deep(.row-excluded .el-tag--info) { opacity: 0.75; }
</style>
