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
      ref="tableRef"
      :data="list"
      size="small"
      row-key="product_id"
      style="width:100%"
      height="360"
      v-loading="loading"
      @row-click="handleRowClick"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="55" align="center" />
          <el-table-column type="index" :index="indexMethod" label="" width="55" align="center" />
      <el-table-column prop="product_code" label="产品编码" min-width="180" show-overflow-tooltip />
      <el-table-column prop="product_name" label="产品名称" min-width="150" show-overflow-tooltip />
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

const props = defineProps<{ modelValue: boolean; supplierId?: string }>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [product: ProductItem]
}>()

const tableRef = ref()
const rawList = ref<ProductItem[]>([])
const supplierAll = ref<ProductItem[]>([])
const selected = ref<ProductItem | null>(null)
const filter = reactive({ name: '', code: '', itemNo: '' })
const { loading, pagination, resetPage, indexMethod, withMinLoading } = useRemoteDialogPagination()

/** 传入 supplierId 时进入"供应商模式"：只展示该供应商关联的产品 */
const supplierMode = computed(() => !!props.supplierId)

/** 供应商模式下：按关键字客户端过滤后再分页（接口不接收搜索参数，且为全量返回） */
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

async function loadData() {
  if (supplierMode.value) {
    try {
      const res = await withMinLoading(async () => queryProductSuppliers(props.supplierId as string))
      supplierAll.value = (res.data?.products ?? []) as unknown as ProductItem[]
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
  // 单选（radio 式）：清空其余勾选，仅保留当前行
  tableRef.value?.clearSelection()
  tableRef.value?.toggleRowSelection(row, true)
}

function onSelectionChange(rows: ProductItem[]) {
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
.filter-form { padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { padding-top: 8px; display: flex; justify-content: flex-end; }
</style>
