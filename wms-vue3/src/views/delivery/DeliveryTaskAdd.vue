<template>
  <div class="add-template-page delivery-add">
    <div class="page-header"><div class="page-header-left"><el-button @click="router.back()">返回</el-button><h3>新增配送任务</h3></div><div class="header-actions"><el-button @click="reset">重置</el-button><el-button v-perm="'POST /api/v1/tenant-delivery-tasks/create'" type="primary" :loading="submitting" @click="submit">保存任务</el-button></div></div>
    <div class="page-body">
      <el-form label-width="130px"><div class="form-section-title">任务信息</div><DeliveryTaskFields v-model="form" /></el-form>
      <div class="form-section-title order-title"><span>配送销售订单</span><el-button v-perm="'GET /api/v1/tenant-delivery-tasks/eligible-orders'" type="primary" plain size="small" @click="pickerVisible = true"><el-icon><Plus /></el-icon>选择销售订单</el-button></div>
      <el-alert title="选入任务后仍需现场确认装车。也可以先保存空任务，再在任务详情中追加订单。" type="info" :closable="false" show-icon />
      <el-table :data="selected" border size="small" class="orders-table" empty-text="尚未选择销售订单">
        <el-table-column type="index" width="50" />
        <el-table-column prop="sales_order_no" label="销售订单号" min-width="170" />
        <el-table-column prop="customer_name" label="客户" min-width="140" show-overflow-tooltip />
        <el-table-column prop="delivery_address" label="收货地址" min-width="220" show-overflow-tooltip />
        <el-table-column prop="delivery_quantity" label="出库数量合计" width="120" align="right" />
        <el-table-column label="操作" width="80"><template #default="{ row }"><el-button link type="danger" @click="selected = selected.filter(item => item.sales_order_id !== row.sales_order_id)">移除</el-button></template></el-table-column>
      </el-table>
      <div class="selection-summary">已选择 {{ selected.length }} 张销售订单 · 各产品数量和单位在任务明细中查看</div>
    </div>
    <DeliveryOrderPicker v-model="pickerVisible" :excluded-ids="selected.map(row => row.sales_order_id)" @confirm="addOrders" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { createDeliveryTask, type DeliveryEligibleOrder } from '@/api/modules/delivery'
import { showErrorDialog } from '@/utils/errorFeedback'
import DeliveryTaskFields, { type DeliveryForm } from './DeliveryTaskFields.vue'
import DeliveryOrderPicker from './DeliveryOrderPicker.vue'
const router = useRouter(), submitting = ref(false), pickerVisible = ref(false)
function emptyForm(): DeliveryForm { return { carrier_type: '', driver_id: '', driver_display: '', logistics_company_id: '', logistics_display: '', vehicle_id: '', vehicle_display: '', origin_address: '', plan_departure_time: '', remark: '' } }
const form = ref<DeliveryForm>(emptyForm()), selected = ref<DeliveryEligibleOrder[]>([])
function reset() { form.value = emptyForm(); selected.value = [] }
function addOrders(rows: DeliveryEligibleOrder[]) {
  const ids = new Set(selected.value.map(row => row.sales_order_id))
  selected.value.push(...rows.filter(row => !ids.has(row.sales_order_id)))
}
async function submit() {
  if (submitting.value) return
  if (selected.value.length > 100) { ElMessage.warning('单次最多选择 100 张销售订单'); return }
  const data = form.value
  if (data.carrier_type === 'PERSONAL_DRIVER' && !data.driver_id) { ElMessage.warning('请选择承运司机'); return }
  if (data.carrier_type === 'LOGISTICS_COMPANY' && !data.logistics_company_id) { ElMessage.warning('请选择物流公司'); return }
  submitting.value = true
  try {
    const result = await createDeliveryTask({ sales_order_ids: selected.value.length ? JSON.stringify(selected.value.map(row => row.sales_order_id)) : undefined,
      carrier_type: data.carrier_type || undefined, driver_id: data.driver_id || undefined,
      logistics_company_id: data.logistics_company_id || undefined,
      vehicle_id: data.carrier_type === 'LOGISTICS_COMPANY' ? undefined : data.vehicle_id || undefined,
      origin_address: data.origin_address || undefined, plan_departure_time: data.plan_departure_time || undefined, remark: data.remark || undefined })
    ElMessage.success('配送任务已创建')
    router.replace({ path: '/delivery/task/detail', query: { id: result.data.delivery_task_id } })
  } catch (error: any) { if (error?.response?.data?.detail) showErrorDialog(error.response.data.detail) }
  finally { submitting.value = false }
}
</script>
<style scoped>
.delivery-add { padding:20px; }.page-header,.page-header-left,.header-actions { display:flex; align-items:center; gap:12px; }.page-header { justify-content:space-between; margin-bottom:20px; }.page-header h3 { margin:0; font-size:18px; font-weight:500; }.page-body { background:var(--el-bg-color); padding:24px; border:1px solid var(--el-border-color-lighter); border-radius:4px; }.form-section-title { font-size:15px; font-weight:500; padding-bottom:12px; margin-bottom:20px; border-bottom:1px solid var(--el-border-color-lighter); }.order-title { display:flex; align-items:center; justify-content:space-between; margin-top:16px; }.orders-table { margin-top:16px; }.selection-summary { color:var(--el-text-color-secondary); font-size:13px; padding-top:12px; }
@media(max-width:700px) { .delivery-add { padding:12px; }.page-body { padding:12px; } }
</style>
