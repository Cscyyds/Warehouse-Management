<template>
  <el-dialog
    title="客户选择"
    :model-value="modelValue"
    width="960px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="select-layout">
      <div class="left-panel">
        <el-form :model="filter" inline size="small" class="filter-form">
          <el-form-item label="客户名称">
            <el-input v-model="filter.name" placeholder="请输入" clearable style="width:140px" />
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
          row-key="customer_id"
          style="width:100%"
          height="360"
          highlight-current-row
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column type="index" label="" width="55" align="center" />
          <el-table-column prop="customer_name" label="客户名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="detail_address" label="公司地址" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.detail_address || '-' }}</template>
          </el-table-column>
          <el-table-column prop="customer_type_name" label="客户类型" width="100" />
          <el-table-column prop="is_monthly_settlement" label="是否月结" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.is_monthly_settlement === 1 ? 'success' : 'info'" size="small">{{ row.is_monthly_settlement === 1 ? '是' : '否' }}</el-tag>
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
          <li v-for="item in selected" :key="item.customer_id" class="selected-item">
            <span class="selected-name">{{ item.customer_name }}</span>
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
import { getCustomerList, searchCustomers, type CustomerItem } from '@/api'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [customer: CustomerItem]
}>()

const tableRef = ref()
const loading = ref(false)
const list = ref<CustomerItem[]>([])
const selected = ref<CustomerItem[]>([])
const filter = reactive({ name: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

function onOpen() { selected.value = []; loadData() }

async function loadData() {
  loading.value = true
  // 保证加载动画至少展示 0.3s，避免数据返回过快导致闪烁
  const minDelay = new Promise(resolve => setTimeout(resolve, 300))
  try {
    let res
    if (filter.name) {
      const searchField: string[] = ['customer_name']
      const searchValue: Record<string, unknown> = { customer_name: filter.name }
      res = await searchCustomers({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      res = await getCustomerList({ page: pagination.page })
    }
    await minDelay
    list.value = res.data.customer ?? res.data.customers ?? []
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
function handleSelectionChange(val: CustomerItem[]) { selected.value = val }

function handleRowClick(row: CustomerItem) {
  tableRef.value?.clearSelection()
  tableRef.value?.toggleRowSelection(row, true)
}

function handleConfirm() {
  if (selected.value.length === 0) { ElMessage.warning('请选择一个客户'); return }
  if (selected.value.length > 1) { ElMessage.warning('只能选择一个客户'); return }
  emit('confirm', selected.value[0])
  handleClose()
}

function handleClose() { emit('update:modelValue', false) }
</script>

<style scoped>
.select-layout { display: flex; gap: 12px; height: 480px; overflow: hidden; }
.left-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.filter-form { flex-shrink: 0; padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { flex-shrink: 0; padding-top: 8px; display: flex; justify-content: flex-end; }
.right-panel { flex-shrink: 0; width: 160px; border-left: 1px solid var(--el-border-color-light); padding: 0 10px; display: flex; flex-direction: column; overflow: hidden; }
.right-title { font-size: 13px; font-weight: 500; color: var(--el-text-color-primary); margin-bottom: 8px; flex-shrink: 0; }
.selected-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.selected-item { padding: 5px 4px; font-size: 12px; color: var(--el-text-color-regular); }
.empty-tip { font-size: 12px; color: var(--el-text-color-placeholder); text-align: center; padding: 20px 0; }
</style>
