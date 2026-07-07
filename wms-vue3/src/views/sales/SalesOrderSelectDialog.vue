<template>
  <el-dialog
    title="选择销售订单"
    :model-value="modelValue"
    width="900px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="select-layout">
      <div class="left-panel">
        <el-form :model="filter" inline size="small" class="filter-form">
          <el-form-item label="订单编号">
            <el-input v-model="filter.order_no" placeholder="请输入" clearable style="width:150px" />
          </el-form-item>
          <el-form-item label="客户">
            <el-input v-model="filter.customer_name" placeholder="请输入" clearable style="width:140px" />
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
          row-key="sales_order_id"
          style="width:100%"
          height="360"
          highlight-current-row
          v-loading="loading"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column type="index" label="" width="50" align="center" />
          <el-table-column prop="order_no" label="订单编号" width="180" show-overflow-tooltip />
          <el-table-column prop="customer_name" label="客户" min-width="140" show-overflow-tooltip />
          <el-table-column prop="order_amount" label="订单金额" width="110" align="right" />
          <el-table-column prop="pending_receivable_amount" label="待收金额" width="110" align="right" />
          <el-table-column prop="order_date" label="订单日期" width="110" />
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
        <div class="right-title">已选择 {{ selected.length }} 项：</div>
        <ul class="selected-list">
          <li v-for="(item, idx) in selected" :key="item.sales_order_id" class="selected-item">
            <div class="selected-row">
              <span class="selected-name">{{ item.order_no }}</span>
              <el-icon class="remove-btn" @click="removeSelected(idx)"><Close /></el-icon>
            </div>
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
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { getSalesOrderListV2, searchSalesOrdersV2, type SalesOrderListItemV2 } from '@/api'

const props = defineProps<{ modelValue: boolean }>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [order: SalesOrderListItemV2]
}>()

const tableRef = ref()
const loading = ref(false)
const list = ref<SalesOrderListItemV2[]>([])
const selected = ref<SalesOrderListItemV2[]>([])
const filter = reactive({ order_no: '', customer_name: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

watch(() => props.modelValue, (val) => {
  if (val) {
    selected.value = []
    filter.order_no = ''
    filter.customer_name = ''
    pagination.page = 1
    loadData()
  }
}, { immediate: true })

async function loadData() {
  loading.value = true
  const minDelay = new Promise(resolve => setTimeout(resolve, 300))
  try {
    const searchField: string[] = ['audit_status', 'settlement_method']
    const searchValue: Record<string, unknown> = { audit_status: 1, settlement_method_not: 'MONTHLY' }

    if (filter.order_no) { searchField.push('order_no'); searchValue.order_no = filter.order_no }
    if (filter.customer_name) { searchField.push('customer_name'); searchValue.customer_name = filter.customer_name }

    let res
    if (filter.order_no || filter.customer_name) {
      res = await searchSalesOrdersV2({
        search_field: JSON.stringify(['order_no', 'customer_name'].filter(f => searchValue[f])),
        search_value: JSON.stringify(Object.fromEntries(
          Object.entries({ order_no: filter.order_no, customer_name: filter.customer_name }).filter(([, v]) => v)
        )),
        page: pagination.page
      })
    } else {
      res = await getSalesOrderListV2({ page: pagination.page, audit_status: 1 })
    }
    await minDelay
    // 前端过滤：仅展示已审核且非月结
    const all: SalesOrderListItemV2[] = res.data.sales_order ?? []
    list.value = all.filter(o => o.audit_status === 1 && o.settlement_method !== 'MONTHLY')
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
function handleReset() { filter.order_no = ''; filter.customer_name = ''; handleSearch() }

function handleSelectionChange(val: SalesOrderListItemV2[]) { selected.value = val }

function handleRowClick(row: SalesOrderListItemV2) {
  tableRef.value?.clearSelection()
  tableRef.value?.toggleRowSelection(row, true)
}

function removeSelected(idx: number) {
  const item = selected.value[idx]
  tableRef.value?.toggleRowSelection(item, false)
}

function handleConfirm() {
  if (selected.value.length === 0) { ElMessage.warning('请选择一个销售订单'); return }
  if (selected.value.length > 1) { ElMessage.warning('只能选择一个销售订单'); return }
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
.right-panel { flex-shrink: 0; width: 180px; border-left: 1px solid var(--el-border-color-light); padding: 0 10px; display: flex; flex-direction: column; overflow: hidden; }
.right-title { font-size: 13px; font-weight: 500; color: var(--el-text-color-primary); margin-bottom: 8px; flex-shrink: 0; }
.selected-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.selected-item { padding: 5px 0; font-size: 12px; color: var(--el-text-color-regular); border-bottom: 1px solid var(--el-border-color-extra-light); }
.selected-row { display: flex; align-items: center; justify-content: space-between; }
.selected-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.remove-btn { flex-shrink: 0; cursor: pointer; color: var(--el-text-color-placeholder); margin-left: 4px; }
.remove-btn:hover { color: var(--el-color-danger); }
.empty-tip { font-size: 12px; color: var(--el-text-color-placeholder); text-align: center; padding: 20px 0; }
</style>
