<template>
  <el-dialog
    title="供应商选择"
    :model-value="modelValue"
    width="960px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-alert v-if="fields.hiddenPaths.value.length" title="部分信息受角色权限限制，已隐藏" type="info" :closable="false" />
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
          border
          class="select-dialog-table"
          ref="tableRef"
          :data="list"
          size="small"
          row-key="supplier_id"
          style="width:100%"
          height="100%"
          highlight-current-row
          v-loading="loading"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column type="index" :index="indexMethod" label="" width="55" align="center" />
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
          </li>
          <li v-if="selected.length === 0" class="empty-tip">暂未选择</li>
        </ul>
      </div>
    </div>
    <template #footer>
      <el-button type="primary" :loading="confirming" :disabled="loading" @click="handleConfirm">确定</el-button>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useSensitiveFields } from '@/composables/useSensitiveFields'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { getSupplierList, searchSupplier, type SupplierItem } from '@/api'
import { buildSearchParams } from '@/utils/data'
import { useDialogOpenReload, useRemoteDialogPagination } from '@/composables/useRemoteDialogPagination'
import { effectivePageSize } from '@/api/utils/fetchAllPages'

const props = withDefaults(defineProps<{
  modelValue: boolean
  multiple?: boolean
  monthlyOnly?: boolean
  excludeIds?: string[]
}>(), { multiple: false, monthlyOnly: false, excludeIds: () => [] })

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [supplier: SupplierItem]
  /** 多选确认：返回完整供应商行（含编码/地址/电话/状态），供调用方写入表格展示字段 */
  'confirmMultiple': [suppliers: SupplierItem[]]
}>()

const tableRef = ref()
const list = ref<SupplierItem[]>([])
const selected = ref<SupplierItem[]>([])
const filter = reactive({ name: '', code: '' })
const { loading, pagination, resetPage, indexMethod } = useRemoteDialogPagination()

const pageSession = localStorage.getItem('token')
let sequence = 0
const confirming = ref(false)
const interfacePath = computed(() => props.monthlyOnly || filter.name || filter.code ? '/tenant-suppliers/search' : '/tenant-suppliers/list')
const fields = useSensitiveFields({ interfacePath: () => interfacePath.value, enabled: () => props.modelValue })
const identityKeys = new Set(['supplier_id', 'supplier_name', 'supplier_code', 'short_name', 'external_code', 'supplier_type_id', 'supplier_type_name', 'detail_address', 'phone1', 'phone2', 'status', 'supplier_model', 'is_monthly_settlement', 'monthly_days', 'settlement_day'])
function safeSuppliers(rows: SupplierItem[]): SupplierItem[] {
  return fields.confirmed.value ? fields.sanitizeOutput({ supplier: rows }).supplier : rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => identityKeys.has(key))) as unknown as SupplierItem)
}
watch(() => props.modelValue, visible => { if (!visible) { sequence++; loading.value = false; selected.value = []; list.value = [] } })
watch(() => props.monthlyOnly, () => { if (props.modelValue) { selected.value = []; list.value = []; tableRef.value?.clearSelection(); resetPage(); void loadData() } })

useDialogOpenReload({
  visible: () => props.modelValue,
  immediate: true,
  reset: () => {
    selected.value = []
    filter.name = ''
    filter.code = ''
    resetPage()
  },
  load: loadData,
})

async function loadData() {
  const current = ++sequence
  loading.value = true
  try {
    await fields.refresh()
    if (current !== sequence || !props.modelValue || pageSession !== localStorage.getItem('token')) return
    const res = await (async () => {
      const { search_field, search_value } = buildSearchParams({
        is_monthly_settlement: props.monthlyOnly ? 1 : undefined,
        supplier_name: filter.name || undefined,
        supplier_code: filter.code || undefined,
      })
      if (search_field === '[]') {
        return getSupplierList({ page: pagination.page, page_size: pagination.pageSize })
      }
      return searchSupplier({
        search_field,
        search_value,
        page: pagination.page,
        page_size: pagination.pageSize,
      })
    })()
    if (current !== sequence || !props.modelValue || pageSession !== localStorage.getItem('token')) return
    fields.setResponse(res.data)
    const raw = safeSuppliers(res.data.supplier ?? [])
    list.value = props.excludeIds?.length ? raw.filter((s: SupplierItem) => !props.excludeIds!.includes(s.supplier_id)) : raw
    pagination.total = res.data.total ?? 0
    pagination.pageSize = effectivePageSize(res.data.page_size, pagination.pageSize)
  } catch {
    if (current !== sequence) return
    list.value = []
    pagination.total = 0
  } finally { if (current === sequence) loading.value = false }
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
}

async function handleConfirm() {
  if (confirming.value || loading.value) return
  const current = sequence
  confirming.value = true
  try {
    await fields.refresh()
    if (current !== sequence || !props.modelValue || pageSession !== localStorage.getItem('token')) return
    selected.value = selected.value.filter(row => !props.excludeIds.includes(row.supplier_id))
    if (selected.value.length === 0) {
      ElMessage.warning('请至少选择一个供应商')
      return
    }
    if (props.multiple) {
      // 返回完整供应商行（编码/地址/电话/状态），供表格类调用方（如产品资料关联供应商）填充展示列
      emit('confirmMultiple', safeSuppliers(selected.value))
    } else {
      if (selected.value.length > 1) {
        ElMessage.warning('只能选择一个供应商')
        return
      }
      emit('confirm', safeSuppliers(selected.value)[0])
    }
    handleClose()
  } finally { confirming.value = false }
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
.empty-tip { font-size: 12px; color: var(--el-text-color-placeholder); text-align: center; padding: 20px 0; }
</style>
