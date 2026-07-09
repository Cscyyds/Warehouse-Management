<template>
  <div class="add-template-page">
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="handleCancel"><ArrowLeft /></el-icon>
        <span class="back-label" @click="handleCancel">返回</span>
        <span class="header-divider">/</span>
        <h3>新增配送任务</h3>
      </div>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </div>
    </div>
    <div class="page-body">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px" size="default">
        <el-row :gutter="16">
          <el-col :span="24">
            <div class="form-section-title">
              <span class="section-line" />
              任务信息
            </div>
          </el-col>
          <el-col :span="12">
            <el-form-item label="指派车辆" prop="vehicle_id">
              <div class="input-suffix-wrapper">
                <el-input
                  v-model="formData.vehicle_name_display"
                  placeholder="点击选择车辆"
                  readonly
                  style="width:100%"
                  @click="vehicleDialogVisible = true"
                >
                  <template #suffix>
                    <el-icon class="input-suffix-icon" @click.stop="vehicleDialogVisible = true"><Search /></el-icon>
                  </template>
                </el-input>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="指派司机" prop="driver_id">
              <div class="input-suffix-wrapper">
                <el-input
                  v-model="formData.driver_name_display"
                  placeholder="点击选择司机（选填）"
                  readonly
                  style="width:100%"
                  @click="driverDialogVisible = true"
                >
                  <template #suffix>
                    <el-icon class="input-suffix-icon" @click.stop="driverDialogVisible = true"><Search /></el-icon>
                  </template>
                </el-input>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="计划发车时间" prop="plan_departure_time">
              <el-date-picker
                v-model="formData.plan_departure_time"
                type="datetime"
                placeholder="请选择"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width:100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="起始地址" prop="origin_address">
              <el-input v-model="formData.origin_address" placeholder="请输入起始地址" maxlength="255" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注" prop="remark">
              <el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="请输入备注" maxlength="255" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>
  </div>

  <!-- 车辆选择弹窗 -->
  <el-dialog v-model="vehicleDialogVisible" title="选择车辆" width="600px" :close-on-click-modal="false" destroy-on-close>
    <el-form inline size="default" style="margin-bottom:12px">
      <el-form-item>
        <el-input v-model="vehicleSearch" placeholder="搜索车牌号/名称" clearable style="width:200px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadVehicleOptions">查询</el-button>
      </el-form-item>
    </el-form>
    <el-table :data="vehicleOptions" highlight-current-row @current-change="handleVehicleSelect" max-height="300">
      <el-table-column prop="license_plate" label="车牌号" width="140" />
      <el-table-column prop="vehicle_name" label="车辆名称" min-width="140" />
      <el-table-column prop="status" label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 'IDLE' ? 'success' : 'warning'" size="small">
            {{ row.status === 'IDLE' ? '空闲' : '使用中' }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="vehicleDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmVehicleSelect">确认</el-button>
    </template>
  </el-dialog>

  <!-- 司机选择弹窗 -->
  <el-dialog v-model="driverDialogVisible" title="选择司机" width="500px" :close-on-click-modal="false" destroy-on-close>
    <el-form inline size="default" style="margin-bottom:12px">
      <el-form-item>
        <el-input v-model="driverSearch" placeholder="搜索姓名/手机号" clearable style="width:200px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadDriverOptions">查询</el-button>
      </el-form-item>
    </el-form>
    <el-table :data="driverOptions" highlight-current-row @current-change="handleDriverSelect" max-height="300">
      <el-table-column prop="user_name" label="姓名" width="120" />
      <el-table-column prop="phone" label="手机号" min-width="140" />
    </el-table>
    <template #footer>
      <el-button @click="driverDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmDriverSelect">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Search } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { createDeliveryTask } from '@/api'
import { getVehicleList, type VehicleItem } from '@/api'
import { get } from '@/utils/request'

const router = useRouter()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const formData = reactive({
  vehicle_id: '',
  vehicle_name_display: '',
  origin_address: '',
  driver_id: '',
  driver_name_display: '',
  plan_departure_time: '',
  remark: '',
})

const rules: FormRules = {
  vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }],
}

function handleCancel() { router.back() }

function handleReset() {
  Object.assign(formData, {
    vehicle_id: '', vehicle_name_display: '',
    origin_address: '', driver_id: '', driver_name_display: '',
    plan_departure_time: '', remark: '',
  })
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    await createDeliveryTask({
      vehicle_id: formData.vehicle_id,
      origin_address: formData.origin_address || undefined,
      driver_id: formData.driver_id || undefined,
      plan_departure_time: formData.plan_departure_time || undefined,
      remark: formData.remark || undefined,
    })
    ElMessage.success('创建成功')
    router.push('/delivery/task')
  } catch (e: any) {
    if (e?.response?.data?.detail) ElMessage.error(e.response.data.detail)
  } finally {
    submitting.value = false
  }
}

// ═══════════ 车辆选择 ═══════════
const vehicleDialogVisible = ref(false)
const vehicleSearch = ref('')
const vehicleOptions = ref<VehicleItem[]>([])
let selectedVehicle: VehicleItem | null = null

async function loadVehicleOptions() {
  try {
    const res = await getVehicleList({ page: 1, page_size: 50, keyword: vehicleSearch.value || undefined })
    vehicleOptions.value = res.data.items
  } catch {
    vehicleOptions.value = []
  }
}

function handleVehicleSelect(row: VehicleItem | null) { selectedVehicle = row }
function confirmVehicleSelect() {
  if (selectedVehicle) {
    formData.vehicle_id = selectedVehicle.vehicle_id
    formData.vehicle_name_display = `${selectedVehicle.vehicle_name}（${selectedVehicle.license_plate}）`
    formRef.value?.clearValidate('vehicle_id')
  }
  vehicleDialogVisible.value = false
}

// ═══════════ 司机选择 ═══════════
const driverDialogVisible = ref(false)
const driverSearch = ref('')
const driverOptions = ref<{ user_id: string; user_name: string; phone: string }[]>([])
let selectedDriver: { user_id: string; user_name: string; phone: string } | null = null

async function loadDriverOptions() {
  try {
    const res = await get<{ users: { user_id: string; user_name: string; phone: string }[] }>(
      '/api/v1/tenant-users/query',
      { keyword: driverSearch.value || undefined, page: 1 }
    )
    driverOptions.value = (res.data as any).users || []
  } catch {
    driverOptions.value = []
  }
}

function handleDriverSelect(row: { user_id: string; user_name: string; phone: string } | null) { selectedDriver = row }
function confirmDriverSelect() {
  if (selectedDriver) {
    formData.driver_id = selectedDriver.user_id
    formData.driver_name_display = selectedDriver.user_name
  }
  driverDialogVisible.value = false
}
</script>

<style scoped>
.add-template-page { background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-xs); padding: 0; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-bottom: 1px solid var(--border-light); }
.page-header-left { display: flex; align-items: center; gap: 8px; }
.back-icon { cursor: pointer; color: var(--text-secondary); font-size: 16px; transition: color var(--transition-fast); }
.back-icon:hover { color: var(--primary); }
.back-label { cursor: pointer; font-size: 14px; color: var(--text-secondary); transition: color var(--transition-fast); }
.back-label:hover { color: var(--primary); }
.header-divider { color: var(--text-tertiary); font-size: 14px; margin: 0 2px; }
.page-header h3 { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.header-actions { display: flex; gap: 8px; }
.page-body { padding: 20px 24px; }
.add-template-page :deep(.el-form-item) { margin-bottom: 16px; }
.add-template-page :deep(.el-form-item__label) { font-size: 14px; color: var(--text-secondary); }
.form-section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 4px 0 14px; padding-left: 4px; }
.section-line { width: 4px; height: 16px; background: var(--primary-gradient); border-radius: 2px; flex-shrink: 0; }
.input-suffix-wrapper { width: 100%; }
.input-suffix-icon { cursor: pointer; color: var(--text-tertiary); }
.input-suffix-icon:hover { color: var(--primary); }
</style>
