<template>
  <el-dialog
    title="产品选择"
    :model-value="modelValue"
    width="960px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-alert
      v-if="supplierMode"
      type="info"
      :closable="false"
      show-icon
      class="supplier-hint"
      title="已按所选供应商筛选产品"
      description="仅显示该供应商关联的产品，如需选择其他产品请先返回修改供应商。"
    />
    <el-form :model="filter" inline size="small" class="filter-form">
      <el-form-item label="产品名称">
        <el-input v-model="filter.name" placeholder="请输入" clearable style="width:160px" @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="产品编码">
        <el-input v-model="filter.code" placeholder="请输入" clearable style="width:140px" @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="货号">
        <el-input v-model="filter.itemNo" :disabled="supplierMode" placeholder="供应商模式下不可用" clearable style="width:120px" @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
        <el-button size="small" @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>
    <el-table
      border
      ref="tableRef"
      :data="list"
      size="small"
      row-key="product_id"
      style="width:100%"
      height="360"
      v-loading="loading"
      :row-class-name="rowClassName"
      @row-click="handleRowClick"
      @selection-change="onSelectionChange"
    >
      <!-- 多选模式开启 reserve-selection：配合 row-key，跨页/跨搜索保留已勾选行。
           selectable 用于排除 excludeIds 命中的行（已绑定不可重复选择） -->
      <el-table-column type="selection" width="55" align="center" :reserve-selection="multiple" :selectable="isRowSelectable" />
          <el-table-column type="index" :index="indexMethod" label="" width="55" align="center" />
      <el-table-column prop="product_code" label="产品编码" min-width="180" show-overflow-tooltip />
      <el-table-column prop="product_name" label="产品名称" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ row.product_name }}</span>
          <el-tag v-if="!isRowSelectable(row)" size="small" type="info" class="excluded-tag">已绑定</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="is_combined" label="组合商品" width="90" align="center">
        <template #default="{ row }">
          <!-- 字段缺失时显示「-」而非默认「否」：接口漏返回 is_combined 时不再被静默渲染成错误结论 -->
          <el-tag v-if="row.is_combined === null || row.is_combined === undefined" size="small" type="info">-</el-tag>
          <el-tag v-else size="small" :type="Number(row.is_combined) === 1 ? 'warning' : 'info'">
            {{ Number(row.is_combined) === 1 ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="item_no" label="货号" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ row.item_no || '-' }}</template>
      </el-table-column>
      <el-table-column prop="category_name" label="产品类型" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ row.category_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="specification" label="规格" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ row.specification || '-' }}</template>
      </el-table-column>
      <el-table-column prop="color" label="颜色" min-width="80" show-overflow-tooltip>
        <template #default="{ row }">{{ row.color || '-' }}</template>
      </el-table-column>
      <el-table-column prop="unit_name" label="单位" min-width="80" show-overflow-tooltip>
        <template #default="{ row }">{{ row.unit_name || '-' }}</template>
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
        @change="onPageChange"
      />
    </div>
    <template #footer>
      <span v-if="multiple" class="selected-count">已选 {{ pickedCount }} 个产品</span>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { searchProduct, queryProductSuppliers, type ProductItem } from '@/api'
import { buildSearchParams } from '@/utils/data'
import { useDialogOpenReload, useRemoteDialogPagination } from '@/composables/useRemoteDialogPagination'

const props = defineProps<{
  modelValue: boolean
  supplierId?: string
  multiple?: boolean
  /**
   * 需要排除的产品ID（不可勾选）。
   * 典型用途：组合产品绑定子产品时，已绑定的子产品不应重复选择。
   * 命中时该行勾选框禁用、整行弱化，并在名称后展示「已绑定」标记。
   * 不传时行为与之前完全一致（全部可选）。
   */
  excludeIds?: string[]
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [product: ProductItem]
  'confirm-multiple': [products: ProductItem[]]
}>()

const tableRef = ref()
const rawList = ref<ProductItem[]>([])
const supplierAll = ref<ProductItem[]>([])
const selected = ref<ProductItem | null>(null)
/** 多选模式下已勾选的产品集合（跨页保留），单选模式下不回填 */
const selectedList = ref<ProductItem[]>([])
/** 实际可提交的已选数量（剔除因 excludeIds 不可选但被 reserve-selection 保留的行） */
const pickedCount = computed(() => selectedList.value.filter(isRowSelectable).length)
const filter = reactive({ name: '', code: '', itemNo: '' })
const { loading, pagination, resetPage, indexMethod, withMinLoading } = useRemoteDialogPagination()

/** 传入 supplierId 时进入"供应商模式"：只展示该供应商关联的产品 */
const supplierMode = computed(() => !!props.supplierId)

/** 多选模式：勾选框可多选并跨页保留，确定后一次性回传全部已选产品 */
const multiple = computed(() => !!props.multiple)

/** 需排除（不可勾选）的产品ID集合，见 props.excludeIds */
const excludedIdSet = computed<Set<string>>(() => new Set((props.excludeIds || []).map(String)))

/** 该行是否可勾选：被 excludeIds 命中时禁用勾选框（el-table selection 列的 selectable 回调） */
function isRowSelectable(row: ProductItem): boolean {
  return !excludedIdSet.value.has(String(row.product_id))
}

/** 被排除的行加弱化样式，配合名称后的「已绑定」标记说明原因 */
function rowClassName({ row }: { row: ProductItem }): string {
  return isRowSelectable(row) ? '' : 'row-excluded'
}

/** 供应商模式下：按关键字客户端过滤后再分页（loadData 已拉取全部页，数据集完整） */
const list = computed<ProductItem[]>(() => {
  if (!supplierMode.value) return rawList.value
  const kw = (s: string | null | undefined) => (s || '').trim().toLowerCase()
  const nameKw = kw(filter.name)
  const codeKw = kw(filter.code)
  const filtered = supplierAll.value.filter((p) => {
    if (nameKw && !kw(p.product_name).includes(nameKw)) return false
    if (codeKw && !kw(p.product_code).includes(codeKw)) return false
    return true
  })
  pagination.total = filtered.length
  const start = (pagination.page - 1) * pagination.pageSize
  return filtered.slice(start, start + pagination.pageSize)
})

useDialogOpenReload({
  visible: () => props.modelValue,
  reset: () => {
    selected.value = null
    selectedList.value = []
    filter.name = ''
    filter.code = ''
    filter.itemNo = ''
    rawList.value = []
    supplierAll.value = []
    resetPage()
    tableRef.value?.clearSelection()
  },
  load: loadData,
})

/** 供应商绑定产品接口为分页接口（page/page_size），循环拉取全部页，
 *  保证客户端搜索/分页基于完整数据集（原实现只取第一页，产品多时会缺失）。
 */
async function fetchAllSupplierProducts(supplierId: string) {
  const pageSize = 100
  const all: ProductItem[] = []
  // 上限 50 页（防御异常 total 导致死循环）
  for (let page = 1; page <= 50; page++) {
    const res = await queryProductSuppliers(supplierId, { page, page_size: pageSize })
    const batch = (res.data?.products ?? []) as unknown as ProductItem[]
    all.push(...batch)
    const total = Number(res.data?.total ?? 0)
    if (!batch.length || all.length >= total) break
  }
  return all
}

async function loadData() {
  if (supplierMode.value) {
    try {
      supplierAll.value = await withMinLoading(() => fetchAllSupplierProducts(props.supplierId as string))
    } catch {
      supplierAll.value = []
    }
    return
  }
  try {
    const res = await withMinLoading(async () => {
      const { search_field, search_value } = buildSearchParams({
        product_name: filter.name || undefined,
        product_code: filter.code || undefined,
        item_no: filter.itemNo || undefined,
      })
      return searchProduct({
        search_field: search_field || '[]',
        search_value: search_value || '{}',
        page: pagination.page,
        page_size: pagination.pageSize,
      })
    })
    rawList.value = res.data.products ?? []
    pagination.total = res.data.total ?? 0
  } catch {
    rawList.value = []
    pagination.total = 0
  }
}

function handleSearch() {
  pagination.page = 1
  // 供应商模式为客户端过滤，无需重新请求
  if (supplierMode.value) return
  loadData()
}

function handleReset() {
  filter.name = ''
  filter.code = ''
  filter.itemNo = ''
  pagination.page = 1
  if (supplierMode.value) return
  loadData()
}

function onPageChange() {
  if (supplierMode.value) return
  loadData()
}

function handleRowClick(row: ProductItem) {
  // 被排除的行（已绑定）不可选中，点击不做任何事
  if (!isRowSelectable(row)) return
  if (multiple.value) {
    // 多选：点击行切换该行勾选（勾选框自身已 stopPropagation，不会重复触发）
    const checked = selectedList.value.some((r) => r.product_id === row.product_id)
    tableRef.value?.toggleRowSelection(row, !checked)
    return
  }
  // 单选（radio 式）：清空其余勾选，仅保留当前行
  tableRef.value?.clearSelection()
  tableRef.value?.toggleRowSelection(row, true)
}

function onSelectionChange(rows: ProductItem[]) {
  if (multiple.value) {
    selectedList.value = rows
    return
  }
  if (rows.length <= 1) {
    selected.value = rows[0] ?? null
    return
  }
  // 多勾选时仅保留最后一次勾选的行，实现单选效果
  const last = rows[rows.length - 1]
  rows.slice(0, -1).forEach((r) => tableRef.value?.toggleRowSelection(r, false))
  selected.value = last
}

function handleConfirm() {
  if (multiple.value) {
    // 兜底剔除被排除的行：正常交互下它们选不中，但 reserve-selection 可能保留历史勾选
    const picked = selectedList.value.filter(isRowSelectable)
    if (!picked.length) {
      ElMessage.warning('请至少选择一个产品')
      return
    }
    emit('confirm-multiple', picked.slice())
    handleClose()
    return
  }
  if (!selected.value) {
    ElMessage.warning('请选择一个产品')
    return
  }
  emit('confirm', selected.value)
  handleClose()
}

function handleClose() { emit('update:modelValue', false) }
</script>

<style scoped>
.supplier-hint { margin-bottom: 12px; }
.selected-count { margin-right: auto; color: var(--el-text-color-secondary); font-size: 13px; }
.filter-form { padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { padding-top: 8px; display: flex; justify-content: flex-end; }
.excluded-tag { margin-left: 6px; }
/* 被 excludeIds 排除的行（如已绑定的子产品）：整行弱化，明确"可看见但不可选" */
:deep(.row-excluded) { color: var(--el-text-color-placeholder); }
:deep(.row-excluded .el-tag--info) { opacity: 0.75; }
</style>
