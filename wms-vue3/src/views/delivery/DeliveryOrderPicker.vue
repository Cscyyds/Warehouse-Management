<template>
  <el-dialog :model-value="modelValue" title="选择待配送销售订单" width="1080px" :close-on-click-modal="false" @update:model-value="emit('update:modelValue', $event)">
    <div class="select-layout">
      <div class="left-panel">
        <el-form inline size="small" class="filter-form" @submit.prevent="search">
          <el-form-item label="订单 / 客户"><el-input v-model="keyword" placeholder="销售订单号 / 客户名称" clearable style="width:220px" @keydown.enter="onSearchEnter($event, search)" /></el-form-item>
          <el-form-item><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
        </el-form>
        <el-table ref="table" v-loading="loading" :data="rows" border size="small" height="370" row-key="sales_order_id" @selection-change="selectionChanged" @row-click="toggle">
          <el-table-column type="selection" width="40" :selectable="selectable" />
          <el-table-column type="index" width="45" :index="indexMethod" />
          <el-table-column prop="sales_order_no" label="销售订单号" min-width="170" show-overflow-tooltip />
          <el-table-column prop="customer_name" label="客户" min-width="120" show-overflow-tooltip />
          <el-table-column prop="delivery_address" label="收货地址" min-width="180" show-overflow-tooltip />
          <el-table-column prop="delivery_quantity" label="出库数量合计" width="115" align="right" />
        </el-table>
        <div class="pagination-bar"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" small @change="load" /></div>
      </div>
      <aside class="right-panel">
        <div class="right-title">已选择 {{ selected.length }} 张</div>
        <div class="selected-list"><div v-for="row in selected" :key="row.sales_order_id" class="selected-item"><div><strong>{{ row.sales_order_no }}</strong><small>{{ row.customer_name }}</small></div><el-button link type="danger" aria-label="移除所选订单" @click="remove(row)">移除</el-button></div><el-empty v-if="!selected.length" description="暂未选择" :image-size="52" /></div>
      </aside>
    </div>
    <el-alert title="仅显示已完成出库且未被任务占用的销售订单。物流合单会整体加入任务，加入后逐单确认装车。" type="info" :closable="false" class="picker-hint" />
    <template #footer><el-button type="primary" :disabled="!selected.length || loading" @click="confirm">确定选择</el-button><el-button @click="emit('update:modelValue', false)">关闭</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getDeliveryEligibleOrders, type DeliveryEligibleOrder } from '@/api/modules/delivery'
import { onSearchEnter } from '@/utils/searchEnter'
const props = defineProps<{ modelValue: boolean; excludedIds?: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; confirm: [rows: DeliveryEligibleOrder[]] }>()
const keyword = ref(''), page = ref(1), pageSize = ref(20), total = ref(0), loading = ref(false)
const rows = ref<DeliveryEligibleOrder[]>([]), selected = ref<DeliveryEligibleOrder[]>([]), table = ref()
let sequence = 0, syncing = false
function selectable(row: DeliveryEligibleOrder) { return !props.excludedIds?.includes(row.sales_order_id) }
function indexMethod(index: number) { return (page.value - 1) * pageSize.value + index + 1 }
async function load() {
  const current = ++sequence; loading.value = true; syncing = true
  try {
    const res = await getDeliveryEligibleOrders({ page: page.value, page_size: pageSize.value, keyword: keyword.value || undefined })
    if (current !== sequence) return
    rows.value = res.data.items; total.value = res.data.total; pageSize.value = res.data.page_size
    await nextTick()
    table.value?.clearSelection()
    for (const row of rows.value) if (selected.value.some(item => item.sales_order_id === row.sales_order_id)) table.value?.toggleRowSelection(row, true)
  } catch { if (current === sequence) { rows.value = []; total.value = 0 } }
  finally { if (current === sequence) { loading.value = false; syncing = false } }
}
function search() { page.value = 1; void load() }
function reset() { keyword.value = ''; search() }
function selectionChanged(selection: DeliveryEligibleOrder[]) {
  if (syncing) return
  const onPage = new Set(rows.value.map(row => row.sales_order_id))
  selected.value = [...selected.value.filter(row => !onPage.has(row.sales_order_id)), ...selection]
}
function toggle(row: DeliveryEligibleOrder) { if (!props.excludedIds?.includes(row.sales_order_id)) table.value?.toggleRowSelection(row) }
function remove(row: DeliveryEligibleOrder) { selected.value = selected.value.filter(item => item.sales_order_id !== row.sales_order_id); syncing = true; table.value?.toggleRowSelection(row, false); syncing = false }
function confirm() {
  if (selected.value.length > 100) { ElMessage.warning('单次最多选择 100 张销售订单'); return }
  emit('confirm', selected.value); emit('update:modelValue', false)
}
watch(() => props.modelValue, visible => { if (visible) { selected.value = []; rows.value = []; page.value = 1; keyword.value = ''; void load() } else { sequence++; loading.value = false; syncing = false } })
</script>

<style scoped>
.select-layout { display:flex; gap:12px; min-width:0; }
.left-panel { flex:1; min-width:0; overflow:hidden; }
.filter-form { padding-bottom:8px; border-bottom:1px solid var(--el-border-color-lighter); margin-bottom:8px; }
.pagination-bar { padding-top:12px; display:flex; justify-content:flex-end; overflow:auto; }
.right-panel { width:200px; flex-shrink:0; border-left:1px solid var(--el-border-color-light); padding-left:12px; }
.right-title { font-size:13px; font-weight:500; margin-bottom:8px; }
.selected-list { max-height:390px; overflow:auto; }
.selected-item { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 0; border-bottom:1px solid var(--el-border-color-extra-light); font-size:12px; }
.selected-item strong { font-weight:500; overflow-wrap:anywhere; }.selected-item small { display:block; color:var(--el-text-color-secondary); margin-top:4px; }
.picker-hint { margin-top:16px; }
@media (max-width:800px) { .right-panel { width:150px; } }
</style>
