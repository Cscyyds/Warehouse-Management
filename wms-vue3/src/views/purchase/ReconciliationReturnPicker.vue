<template>
  <el-dialog
    title="选择退货单"
    :model-value="modelValue"
    width="800px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="picker-toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索退货单号"
        clearable
        style="width: 240px"
        @keyup.enter="doSearch"
      />
      <el-button type="primary" @click="doSearch">搜索</el-button>
      <el-button @click="keyword = ''; doSearch()">重置</el-button>
    </div>

    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="tableData"
      stripe
      size="small"
      style="width: 100%; margin-top: 12px"
      max-height="400"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="45" :selectable="isSelectable" />
      <el-table-column prop="return_no" label="退货单号" min-width="150" show-overflow-tooltip />
      <el-table-column prop="supplier_name" label="供应商" min-width="120" />
      <el-table-column prop="return_amount" label="退货金额" width="120" align="right" />
      <el-table-column prop="warehouse_status_name" label="仓库状态" width="100" align="center" />
      <el-table-column prop="created_at" label="创建时间" width="160">
        <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
      </el-table-column>
    </el-table>

    <div class="picker-pagination">
      <el-pagination
        small
        layout="total, prev, pager, next"
        :total="total"
        :page-size="20"
        v-model:current-page="page"
        @current-change="loadData"
      />
    </div>

    <template #footer>
      <span class="picker-footer-hint">已选 {{ selected.length }} 条</span>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="selected.length === 0" @click="handleConfirm">确认添加</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { searchPurchaseReturn } from '@/api'
import type { PurchaseReturnListItem } from '@/api'
import { formatTableDate } from '@/utils/date'

const props = defineProps<{
  modelValue: boolean
  supplierId: string
  excludedIds?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', returns: Array<{ purchase_return_id: string; return_no: string; return_amount: string }>): void
}>()

const loading = ref(false)
const tableData = ref<PurchaseReturnListItem[]>([])
const total = ref(0)
const page = ref(1)
const keyword = ref('')
const selected = ref<PurchaseReturnListItem[]>([])
const tableRef = ref()

function isSelectable(row: PurchaseReturnListItem) {
  return !(props.excludedIds || []).includes(row.purchase_return_id)
}

function handleSelectionChange(rows: PurchaseReturnListItem[]) {
  selected.value = rows
}

async function loadData() {
  loading.value = true
  const minDelay = new Promise(resolve => setTimeout(resolve, 200))
  try {
    const searchField = ['supplier_id']
    const searchValue: Record<string, unknown> = { supplier_id: props.supplierId }

    if (keyword.value.trim()) {
      searchField.push('return_no')
      searchValue.return_no = keyword.value.trim()
    }

    const response = await searchPurchaseReturn({
      search_field: JSON.stringify(searchField),
      search_value: JSON.stringify(searchValue),
      page: page.value,
      sort_by: 'created_at',
      sort_order: 'DESC'
    })

    tableData.value = response.data.purchase_returns || []
    total.value = response.data.total || 0
  } catch {
    tableData.value = []
    total.value = 0
  } finally {
    await minDelay
    loading.value = false
  }
}

function doSearch() {
  page.value = 1
  loadData()
}

function handleConfirm() {
  const returns = selected.value.map(r => ({
    purchase_return_id: r.purchase_return_id,
    return_no: r.return_no,
    return_amount: r.return_amount
  }))
  emit('select', returns)
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (val) => {
  if (val) {
    keyword.value = ''
    selected.value = []
    page.value = 1
    loadData()
  }
})
</script>

<style scoped>
.picker-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}
.picker-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.picker-footer-hint {
  float: left;
  line-height: 32px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
