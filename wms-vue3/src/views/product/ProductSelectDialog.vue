<template>
  <el-dialog
    title="产品选择"
    :model-value="modelValue"
    width="960px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <el-form :model="filter" inline size="small" class="filter-form">
      <el-form-item label="产品名称">
        <el-input v-model="filter.name" placeholder="请输入" clearable style="width:160px" @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="产品编码">
        <el-input v-model="filter.code" placeholder="请输入" clearable style="width:140px" @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="货号">
        <el-input v-model="filter.itemNo" placeholder="请输入" clearable style="width:120px" @keyup.enter="handleSearch" />
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
      highlight-current-row
      v-loading="loading"
      @row-click="handleRowClick"
    >
      <el-table-column type="index" label="" width="55" align="center" />
      <el-table-column prop="product_code" label="产品编码" width="120" show-overflow-tooltip />
      <el-table-column prop="product_name" label="产品名称" min-width="150" show-overflow-tooltip />
      <el-table-column prop="item_no" label="货号" width="100" show-overflow-tooltip />
      <el-table-column prop="category_name" label="产品类型" width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ row.category_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="specification" label="规格" width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ row.specification || '-' }}</template>
      </el-table-column>
      <el-table-column prop="color" label="颜色" width="80" show-overflow-tooltip>
        <template #default="{ row }">{{ row.color || '-' }}</template>
      </el-table-column>
      <el-table-column prop="unit_name" label="单位" width="80" show-overflow-tooltip>
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
        @change="loadData"
      />
    </div>
    <template #footer>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { searchProduct, type ProductItem } from '@/api'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [product: ProductItem]
}>()

const tableRef = ref()
const loading = ref(false)
const list = ref<ProductItem[]>([])
const selected = ref<ProductItem | null>(null)
const filter = reactive({ name: '', code: '', itemNo: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

function onOpen() {
  selected.value = null
  filter.name = ''
  filter.code = ''
  filter.itemNo = ''
  pagination.page = 1
  loadData()
}

async function loadData() {
  loading.value = true
  try {
    const searchField: string[] = []
    const searchValue: Record<string, unknown> = {}
    if (filter.name) { searchField.push('product_name'); searchValue.product_name = filter.name }
    if (filter.code) { searchField.push('product_code'); searchValue.product_code = filter.code }
    if (filter.itemNo) { searchField.push('item_no'); searchValue.item_no = filter.itemNo }

    let res
    if (searchField.length > 0) {
      res = await searchProduct({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      // 无搜索条件时用空搜索获取全部
      res = await searchProduct({
        search_field: '[]',
        search_value: '{}',
        page: pagination.page
      })
    }
    list.value = res.data.products ?? []
    pagination.total = res.data.total ?? 0
  } catch {
    list.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { filter.name = ''; filter.code = ''; filter.itemNo = ''; handleSearch() }

function handleRowClick(row: ProductItem) {
  selected.value = row
  tableRef.value?.setCurrentRow(row)
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
.filter-form { padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { padding-top: 8px; display: flex; justify-content: flex-end; }
</style>
