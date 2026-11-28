<template>
  <el-row :gutter="20">
    <el-col :xs="24" :sm="12"><el-form-item label="承运方式"><el-select v-model="form.carrier_type" clearable placeholder="可稍后指派" style="width:100%" @change="changeCarrier"><el-option label="个人司机" value="PERSONAL_DRIVER" /><el-option label="物流公司" value="LOGISTICS_COMPANY" /></el-select></el-form-item></el-col>
    <el-col v-if="form.carrier_type === 'PERSONAL_DRIVER'" :xs="24" :sm="12"><el-form-item label="承运司机" required><el-input :model-value="form.driver_display" placeholder="选择司机" readonly @click="open('driver')"><template #suffix><el-icon><Search /></el-icon></template></el-input></el-form-item></el-col>
    <el-col v-if="form.carrier_type === 'LOGISTICS_COMPANY'" :xs="24" :sm="12"><el-form-item label="物流公司" required><el-input :model-value="form.logistics_display" placeholder="选择物流公司" readonly @click="open('company')"><template #suffix><el-icon><Search /></el-icon></template></el-input></el-form-item></el-col>
    <el-col v-if="form.carrier_type !== 'LOGISTICS_COMPANY'" :xs="24" :sm="12"><el-form-item label="指派车辆"><el-input v-model="form.vehicle_display" placeholder="选择车辆，可稍后指派" readonly @click="open('vehicle')"><template #suffix><el-icon v-if="form.vehicle_id" @click.stop="form.vehicle_id = ''; form.vehicle_display = ''"><CircleClose /></el-icon><el-icon v-else><Search /></el-icon></template></el-input></el-form-item></el-col>
    <el-col :xs="24" :sm="12"><el-form-item label="计划发车时间"><el-date-picker v-model="form.plan_departure_time" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM-DD HH:mm:ss" clearable placeholder="选择时间" style="width:100%" /></el-form-item></el-col>
    <el-col :span="24"><el-form-item label="起始地址"><el-input v-model="form.origin_address" maxlength="255" placeholder="填写仓库发车地址，用于路线规划" /></el-form-item></el-col>
    <el-col :span="24"><el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="255" show-word-limit /></el-form-item></el-col>
  </el-row>
  <DeliveryResourcePicker v-model="pickerVisible" :kind="pickerKind" @select="select" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Search, CircleClose } from '@element-plus/icons-vue'
import DeliveryResourcePicker, { type DeliveryChoice } from './DeliveryResourcePicker.vue'
export interface DeliveryForm {
  carrier_type: string; driver_id: string; driver_display: string
  logistics_company_id: string; logistics_display: string
  vehicle_id: string; vehicle_display: string
  plan_departure_time: string; origin_address: string; remark: string
}
const form = defineModel<DeliveryForm>({ required: true })
const pickerVisible = ref(false), pickerKind = ref<'driver' | 'vehicle' | 'company'>('driver')
function open(kind: typeof pickerKind.value) { pickerKind.value = kind; pickerVisible.value = true }
function changeCarrier() {
  form.value.driver_id = ''; form.value.driver_display = ''
  form.value.logistics_company_id = ''; form.value.logistics_display = ''
  if (form.value.carrier_type === 'LOGISTICS_COMPANY') { form.value.vehicle_id = ''; form.value.vehicle_display = '' }
}
function select(value: DeliveryChoice) {
  if (pickerKind.value === 'driver') { form.value.driver_id = value.id; form.value.driver_display = `${value.name}（${value.phone || ''}）` }
  else if (pickerKind.value === 'vehicle') { form.value.vehicle_id = value.id; form.value.vehicle_display = `${value.name} ${value.description || ''}` }
  else { form.value.logistics_company_id = value.id; form.value.logistics_display = value.name }
}
</script>
