<template>
  <el-dialog :model-value="modelValue" :title="titles[kind]" width="760px" :close-on-click-modal="false" @update:model-value="emit('update:modelValue', $event)">
    <div class="picker-layout">
      <el-form inline size="small" class="filter-form" @submit.prevent="search">
        <el-form-item label="关键词"><el-input v-model="keyword" :placeholder="kind === 'driver' ? '姓名 / 电话' : kind === 'vehicle' ? '车牌号 / 车辆名称' : '公司名称'" clearable @keydown.enter="onSearchEnter($event, search)" /></el-form-item>
        <el-form-item><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
      </el-form>
      <el-table ref="table" v-loading="loading" :data="rows" border size="small" height="340" highlight-current-row row-key="id" @current-change="selected = $event" @row-dblclick="confirm">
        <el-table-column width="45" align="center"><template #default="{ row }"><el-radio :model-value="selected?.id" :value="row.id" :aria-label="row.name" @change="table?.setCurrentRow(row)"><span /></el-radio></template></el-table-column>
        <el-table-column prop="name" :label="kind === 'driver' ? '司机姓名' : kind === 'vehicle' ? '车牌号' : '公司名称'" min-width="160" show-overflow-tooltip />
        <el-table-column v-if="kind === 'driver'" prop="phone" label="联系电话" width="160" />
        <el-table-column v-if="kind === 'driver'" prop="description" label="司机类型" width="140" />
        <el-table-column v-if="kind === 'vehicle'" prop="description" label="车辆名称" min-width="160" />
        <el-table-column v-if="kind === 'vehicle'" label="状态" width="100"><template #default="{ row }"><el-tag :type="row.status === 'IDLE' ? 'success' : 'warning'" size="small">{{ row.status === 'IDLE' ? '空闲' : '使用中' }}</el-tag></template></el-table-column>
      </el-table>
      <div class="pagination-bar"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" small @change="load" /></div>
    </div>
    <template #footer><el-button type="primary" :disabled="!selected || loading" @click="confirm()">确定</el-button><el-button @click="emit('update:modelValue', false)">关闭</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { searchDrivers, getVehicleList, searchLogisticsCompanies } from '@/api'
import { onSearchEnter } from '@/utils/searchEnter'

export interface DeliveryChoice { id: string; name: string; phone?: string; description?: string; status?: string }
const props = defineProps<{ modelValue: boolean; kind: 'driver' | 'vehicle' | 'company' }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; select: [value: DeliveryChoice] }>()
const titles = { driver: '选择司机', vehicle: '选择车辆', company: '选择物流公司' }
const keyword = ref(''), page = ref(1), pageSize = ref(20), total = ref(0), loading = ref(false)
const rows = ref<DeliveryChoice[]>([]), selected = ref<DeliveryChoice | null>(null), table = ref()
let sequence = 0
async function load() {
  const current = ++sequence, kind = props.kind
  loading.value = true
  selected.value = null
  try {
    const params = { page: page.value, page_size: pageSize.value }
    if (kind === 'driver') {
      const res = await searchDrivers({ ...params, keyword: keyword.value || undefined, status: 'ACTIVE' })
      if (current !== sequence) return
      rows.value = res.data.driver.map(row => ({ id: row.driver_id, name: row.driver_name, phone: row.driver_phone, description: row.driver_type === 'INTERNAL_EMPLOYEE' ? '内部员工' : '外部个体' }))
      total.value = res.data.total
    } else if (kind === 'vehicle') {
      const res = await getVehicleList({ ...params, keyword: keyword.value || undefined })
      if (current !== sequence) return
      rows.value = res.data.items.map(row => ({ id: row.vehicle_id, name: row.license_plate, description: row.vehicle_name, status: row.status }))
      total.value = res.data.total
    } else {
      const res = await searchLogisticsCompanies({ ...params, search_field: JSON.stringify(['company_name', 'status']), search_value: JSON.stringify({ company_name: keyword.value, status: 1 }) })
      if (current !== sequence) return
      rows.value = res.data.logistics_company.map(row => ({ id: row.logistics_company_id, name: row.company_name }))
      total.value = res.data.total
    }
  } catch { if (current === sequence) { rows.value = []; total.value = 0 } }
  finally { if (current === sequence) loading.value = false }
}
function search() { page.value = 1; void load() }
function reset() { keyword.value = ''; search() }
function confirm(row?: DeliveryChoice) {
  const choice = row || selected.value
  if (!choice || loading.value) return
  emit('select', choice); emit('update:modelValue', false)
}
watch(() => props.modelValue, visible => { if (visible) { keyword.value = ''; page.value = 1; rows.value = []; void load() } else { sequence++; loading.value = false } })
</script>

<style scoped>
.picker-layout { display:flex; flex-direction:column; min-width:0; }
.filter-form { padding-bottom:8px; border-bottom:1px solid var(--el-border-color-lighter); margin-bottom:8px; }
.pagination-bar { padding-top:12px; display:flex; justify-content:flex-end; overflow:auto; }
</style>
