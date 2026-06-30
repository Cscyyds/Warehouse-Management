<template>
  <el-dialog
    title="计量单位选择"
    :model-value="modelValue"
    width="720px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <el-form :model="filter" inline size="small" class="filter-form">
      <el-form-item label="单位名称">
        <el-input v-model="filter.name" placeholder="请输入" clearable style="width:180px" @keyup.enter="handleSearch" />
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
      row-key="unit_id"
      style="width:100%"
      height="360"
      highlight-current-row
      v-loading="loading"
      @row-click="handleRowClick"
    >
      <el-table-column type="index" label="" width="55" align="center" />
      <el-table-column prop="unit_name" label="单位名称" min-width="150" show-overflow-tooltip />
      <el-table-column prop="unit_id" label="单位ID" width="200" show-overflow-tooltip />
      <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.remark || '-' }}</template>
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
import { searchProductUnit, type ProductUnitItem } from '@/api'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [unit: ProductUnitItem]
}>()

const tableRef = ref()
const loading = ref(false)
const list = ref<ProductUnitItem[]>([])
const selected = ref<ProductUnitItem | null>(null)
const filter = reactive({ name: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

function onOpen() {
  selected.value = null
  filter.name = ''
  pagination.page = 1
  loadData()
}

async function loadData() {
  loading.value = true
  // 保证加载动画至少展示 0.3s，避免数据返回过快导致闪烁
  const minDelay = new Promise(resolve => setTimeout(resolve, 300))
  try {
    const searchField: string[] = []
    const searchValue: Record<string, unknown> = {}
    if (filter.name) { searchField.push('unit_name'); searchValue.unit_name = filter.name }

    const res = await searchProductUnit({
      search_field: JSON.stringify(searchField),
      search_value: JSON.stringify(searchValue),
      page: pagination.page
    })
    await minDelay
    list.value = res.data.unit ?? []
    pagination.total = res.data.total ?? 0
  } catch {
    await minDelay
    list.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { filter.name = ''; handleSearch() }

function handleRowClick(row: ProductUnitItem) {
  selected.value = row
  tableRef.value?.setCurrentRow(row)
}

function handleConfirm() {
  if (!selected.value) {
    ElMessage.warning('请选择一个计量单位')
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
