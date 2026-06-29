<template>
  <el-dialog
    title="供应商选择"
    :model-value="modelValue"
    width="960px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="select-layout">
      <div class="left-panel">
        <el-form :model="filter" inline size="small" class="filter-form">
          <el-form-item label="供应商名称">
            <el-input v-model="filter.name" placeholder="请输入" clearable style="width:160px" />
          </el-form-item>
          <el-form-item label="供应商编码">
            <el-input v-model="filter.code" placeholder="请输入" clearable style="width:140px" />
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
          row-key="supplier_id"
          style="width:100%"
          height="360"
          highlight-current-row
          v-loading="loading"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column type="index" label="" width="55" align="center" />
          <el-table-column prop="supplier_code" label="编码" width="110" show-overflow-tooltip />
          <el-table-column prop="supplier_name" label="供应商名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="short_name" label="简称" width="100" show-overflow-tooltip />
          <el-table-column prop="detail_address" label="详细地址" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.detail_address || '-' }}</template>
          </el-table-column>
          <el-table-column prop="phone1" label="电话" width="130" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
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
      </div>
      <div class="right-panel">
        <div class="right-title">当前已选择 {{ selected.length }} 项：</div>
        <ul class="selected-list">
          <li v-for="(item, idx) in selected" :key="item.supplier_id" class="selected-item">
            <div class="selected-row">
              <span class="selected-name">{{ item.supplier_name }}</span>
              <el-icon class="remove-btn" @click="removeSelected(idx)"><Close /></el-icon>
            </div>
            <el-input
              v-if="multiple"
              v-model="supplierModels[item.supplier_id]"
              placeholder="供应商型号"
              size="small"
              clearable
              class="model-input"
            />
          </li>
          <li v-if="selected.length === 0" class="empty-tip">暂未选择</li>
        </ul>
      </div>
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
import { Close } from '@element-plus/icons-vue'
import { getSupplierList, searchSupplier, type SupplierItem } from '@/api'

const props = withDefaults(defineProps<{
  modelValue: boolean
  multiple?: boolean
}>(), { multiple: false })

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [supplier: SupplierItem]
  'confirmMultiple': [suppliers: Array<{ supplier_id: string; supplier_name: string; supplier_model: string }>]
}>()

const tableRef = ref()
const loading = ref(false)
const list = ref<SupplierItem[]>([])
const selected = ref<SupplierItem[]>([])
const supplierModels = reactive<Record<string, string>>({})
const filter = reactive({ name: '', code: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

function onOpen() {
  selected.value = []
  Object.keys(supplierModels).forEach(k => delete supplierModels[k])
  loadData()
}

async function loadData() {
  loading.value = true
  try {
    let res
    if (filter.name || filter.code) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (filter.name) { searchField.push('supplier_name'); searchValue.supplier_name = filter.name }
      if (filter.code) { searchField.push('supplier_code'); searchValue.supplier_code = filter.code }
      res = await searchSupplier({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      res = await getSupplierList({ page: pagination.page })
    }
    list.value = res.data.supplier ?? []
    pagination.total = res.data.total ?? 0
  } catch {
    list.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { filter.name = ''; filter.code = ''; handleSearch() }

function handleSelectionChange(val: SupplierItem[]) {
  selected.value = val
}

function handleRowClick(row: SupplierItem) {
  if (props.multiple) {
    // 多选模式：切换选中状态
    tableRef.value?.toggleRowSelection(row)
  } else {
    // 单选模式：清空后选中当前行
    tableRef.value?.clearSelection()
    tableRef.value?.toggleRowSelection(row, true)
  }
}

function removeSelected(idx: number) {
  const item = selected.value[idx]
  tableRef.value?.toggleRowSelection(item, false)
  delete supplierModels[item.supplier_id]
}

function handleConfirm() {
  if (selected.value.length === 0) {
    ElMessage.warning('请至少选择一个供应商')
    return
  }
  if (props.multiple) {
    const result = selected.value.map(s => ({
      supplier_id: s.supplier_id,
      supplier_name: s.supplier_name,
      supplier_model: supplierModels[s.supplier_id] || ''
    }))
    emit('confirmMultiple', result)
  } else {
    if (selected.value.length > 1) {
      ElMessage.warning('只能选择一个供应商')
      return
    }
    emit('confirm', selected.value[0])
  }
  handleClose()
}

function handleClose() { emit('update:modelValue', false) }
</script>

<style scoped>
.select-layout { display: flex; gap: 12px; height: 480px; overflow: hidden; }
.left-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.filter-form { flex-shrink: 0; padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { flex-shrink: 0; padding-top: 8px; display: flex; justify-content: flex-end; }
.right-panel { flex-shrink: 0; width: 200px; border-left: 1px solid var(--el-border-color-light); padding: 0 10px; display: flex; flex-direction: column; overflow: hidden; }
.right-title { font-size: 13px; font-weight: 500; color: var(--el-text-color-primary); margin-bottom: 8px; flex-shrink: 0; }
.selected-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.selected-item { padding: 5px 0; font-size: 12px; color: var(--el-text-color-regular); border-bottom: 1px solid var(--el-border-color-extra-light); }
.selected-row { display: flex; align-items: center; justify-content: space-between; }
.selected-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.remove-btn { flex-shrink: 0; cursor: pointer; color: var(--el-text-color-placeholder); margin-left: 4px; }
.remove-btn:hover { color: var(--el-color-danger); }
.model-input { margin-top: 4px; }
.empty-tip { font-size: 12px; color: var(--el-text-color-placeholder); text-align: center; padding: 20px 0; }
</style>
