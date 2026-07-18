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
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="110px" size="default">
        <el-row :gutter="16">
          <el-col :span="24">
            <div class="form-section-title">
              <span class="section-line" />
              任务信息
            </div>
          </el-col>

          <!-- 承运方式 -->
          <el-col :span="12">
            <el-form-item label="承运方式" prop="carrier_type">
              <el-select v-model="formData.carrier_type" placeholder="请选择（选填）" clearable style="width:100%" @change="onCarrierTypeChange">
                <el-option label="个人司机" value="PERSONAL_DRIVER" />
                <el-option label="物流公司" value="LOGISTICS_COMPANY" />
              </el-select>
            </el-form-item>
          </el-col>

          <!-- 承运司机 -->
          <el-col v-if="formData.carrier_type === 'PERSONAL_DRIVER'" :span="12">
            <el-form-item label="承运司机" prop="driver_id">
              <div class="input-suffix-wrapper">
                <el-input v-model="formData.driver_display" placeholder="点击选择司机" readonly style="width:100%" @click="driverPickerVisible = true">
                  <template #suffix>
                    <el-icon v-if="formData.driver_id" class="input-suffix-icon" @click.stop="clearDriver"><CircleClose /></el-icon>
                    <el-icon v-else class="input-suffix-icon" @click.stop="driverPickerVisible = true"><Search /></el-icon>
                  </template>
                </el-input>
              </div>
            </el-form-item>
          </el-col>

          <!-- 承运公司 -->
          <el-col v-if="formData.carrier_type === 'LOGISTICS_COMPANY'" :span="12">
            <el-form-item label="承运公司" prop="logistics_company_id">
              <div class="input-suffix-wrapper">
                <el-input v-model="formData.logistics_company_display" placeholder="点击选择物流公司" readonly style="width:100%" @click="logisticsPickerVisible = true">
                  <template #suffix>
                    <el-icon v-if="formData.logistics_company_id" class="input-suffix-icon" @click.stop="clearLogistics"><CircleClose /></el-icon>
                    <el-icon v-else class="input-suffix-icon" @click.stop="logisticsPickerVisible = true"><Search /></el-icon>
                  </template>
                </el-input>
              </div>
            </el-form-item>
          </el-col>

          <!-- 车辆（选填） -->
          <el-col :span="12">
            <el-form-item label="指派车辆" prop="vehicle_id">
              <div class="input-suffix-wrapper">
                <el-input
                  v-model="formData.vehicle_name_display"
                  placeholder="点击选择车辆（选填）"
                  readonly
                  style="width:100%"
                  @click="vehicleDialogVisible = true"
                >
                  <template #suffix>
                    <el-icon v-if="formData.vehicle_id" class="input-suffix-icon" @click.stop="clearVehicle"><CircleClose /></el-icon>
                    <el-icon v-else class="input-suffix-icon" @click.stop="vehicleDialogVisible = true"><Search /></el-icon>
                  </template>
                </el-input>
              </div>
            </el-form-item>
          </el-col>

          <!-- 计划发车时间 -->
          <el-col :span="12">
            <el-form-item label="计划发车时间" prop="plan_departure_time">
              <el-date-picker
                v-model="formData.plan_departure_time"
                type="datetime"
                placeholder="请选择（选填）"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width:100%"
              />
            </el-form-item>
          </el-col>

          <!-- 起始地址 -->
          <el-col :span="24">
            <el-form-item label="起始地址" prop="origin_address">
              <el-input v-model="formData.origin_address" placeholder="请输入起始地址（选填）" maxlength="255" />
            </el-form-item>
          </el-col>

          <!-- 备注 -->
          <el-col :span="24">
            <el-form-item label="备注" prop="remark">
              <el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="请输入备注（选填）" maxlength="255" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 装货明细（选填，空时预建任务） -->
        <el-row :gutter="16" style="margin-top:8px">
          <el-col :span="24">
            <div class="form-section-title">
              <span class="section-line" />
              装货明细
              <span class="section-hint">不选则预建空任务，PDA 扫码时再绑定</span>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="detail-selector">
              <div class="detail-toolbar">
                <el-button size="small" @click="detailDialogVisible = true">
                  <el-icon><Plus /></el-icon>从待分配明细中选择
                </el-button>
                <span v-if="selectedDetails.length" class="detail-count">
                  已选 {{ selectedDetails.length }} 条，共 {{ totalQty }} 件
                </span>
              </div>
              <el-table
                v-if="selectedDetails.length"
                :data="selectedDetails"
                size="small"
                style="width:100%;margin-top:8px"
              >
                <el-table-column prop="sales_order_no" label="销售订单号" show-overflow-tooltip min-width="160" />
                <el-table-column prop="customer_name" label="客户名称" show-overflow-tooltip min-width="120" />
                <el-table-column prop="delivery_address" label="配送地址" min-width="200" show-overflow-tooltip />
                <el-table-column prop="delivery_quantity" label="数量" show-overflow-tooltip width="80" align="center" />
                <el-table-column prop="carrier_type" label="承运类型" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag :type="carrierTagType(row.carrier_type)" size="small">{{ carrierLabel(row.carrier_type) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" :width="global_opt_width" align="center" fixed="right">
                  <template #default="{ row }">
                    <el-button link type="danger" size="small" @click="removeDetail(row)">移除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-col>
        </el-row>
      </el-form>
    </div>
  </div>

  <!-- 司机选择弹窗 -->
  <el-dialog v-model="driverPickerVisible" title="选择司机" width="560px" :close-on-click-modal="false" destroy-on-close>
    <el-form inline size="default" style="margin-bottom:12px">
      <el-form-item>
        <el-input v-model="driverSearch" placeholder="姓名/电话" clearable style="width:200px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadDriverOptions">查询</el-button>
      </el-form-item>
    </el-form>
    <el-table border :data="driverOptions" highlight-current-row @current-change="handleDriverSelect" max-height="300">
      <el-table-column prop="driver_name" label="姓名" show-overflow-tooltip width="120" />
      <el-table-column prop="driver_phone" label="电话" show-overflow-tooltip width="140" />
      <el-table-column prop="driver_type" label="类型" width="100">
        <template #default="{ row }">{{ row.driver_type === 'INTERNAL_EMPLOYEE' ? '内部员工' : '外部个体' }}</template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="driverPickerVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmDriver">确认</el-button>
    </template>
  </el-dialog>

  <!-- 物流公司选择弹窗 -->
  <el-dialog v-model="logisticsPickerVisible" title="选择物流公司" width="560px" :close-on-click-modal="false" destroy-on-close>
    <el-form inline size="default" style="margin-bottom:12px">
      <el-form-item>
        <el-input v-model="logisticsSearch" placeholder="公司名称" clearable style="width:200px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadLogisticsOptions">查询</el-button>
      </el-form-item>
    </el-form>
    <el-table border :data="logisticsOptions" highlight-current-row @current-change="handleLogisticsSelect" max-height="300">
      <el-table-column prop="company_name" label="公司名称" show-overflow-tooltip min-width="200" />
    </el-table>
    <template #footer>
      <el-button @click="logisticsPickerVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmLogistics">确认</el-button>
    </template>
  </el-dialog>

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
    <el-table border :data="vehicleOptions" highlight-current-row @current-change="handleVehicleSelect" max-height="300">
      <el-table-column prop="license_plate" label="车牌号" show-overflow-tooltip width="140" />
      <el-table-column prop="vehicle_name" label="车辆名称" show-overflow-tooltip min-width="140" />
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

  <!-- 待分配明细选择弹窗 -->
  <el-dialog v-model="detailDialogVisible" title="选择待分配装货明细" width="900px" :close-on-click-modal="false" destroy-on-close>
    <el-form inline size="default" style="margin-bottom:12px">
      <el-form-item>
        <el-input v-model="detailSearch.keyword" placeholder="销售单号/物流单号/客户名" clearable style="width:220px" />
      </el-form-item>
      <el-form-item label="承运类型">
        <el-select v-model="detailSearch.carrier_type" clearable placeholder="全部" style="width:120px">
          <el-option label="未分配" value="UNASSIGNED" />
          <el-option label="个人司机" value="PERSONAL_DRIVER" />
          <el-option label="物流公司" value="LOGISTICS_COMPANY" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadDetailOptions">查询</el-button>
      </el-form-item>
    </el-form>
    <el-table
      :data="detailOptions"
      @selection-change="handleDetailSelectionChange"
      max-height="360"
      ref="detailTableRef"
    >
      <el-table-column type="selection" width="40" />
      <el-table-column prop="sales_order_no" label="销售订单号" show-overflow-tooltip min-width="160" />
      <el-table-column prop="customer_name" label="客户名称" show-overflow-tooltip width="120" />
      <el-table-column prop="delivery_address" label="配送地址" min-width="180" show-overflow-tooltip />
      <el-table-column prop="delivery_quantity" label="数量" show-overflow-tooltip width="70" align="center" />
      <el-table-column prop="carrier_type" label="承运类型" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="carrierTagType(row.carrier_type)" size="small">{{ carrierLabel(row.carrier_type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="driver_name" label="司机/物流" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.driver_name || row.logistics_company_name || '-' }}
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="detailPage"
      v-model:page-size="detailPageSize"
      :total="detailTotal"
      layout="total, prev, pager, next"
      style="margin-top:12px;justify-content:flex-end"
      @current-change="loadDetailOptions"
    />
    <template #footer>
      <el-button @click="detailDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmDetailSelect">确认选择</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { global_opt_width } from '@/utils/data'
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Search, CircleClose, Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { createDeliveryTask, getVehicleList, getScanDetailList, getDriverOptions, getLogisticsCompanyList, type VehicleItem, type ScanDetailItem } from '@/api'
import type { DriverOptionItem } from '@/api'
import type { LogisticsCompanyItem } from '@/api'

const router = useRouter()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const formData = reactive({
  vehicle_id: '',
  vehicle_name_display: '',
  carrier_type: '',
  driver_id: '',
  driver_display: '',
  logistics_company_id: '',
  logistics_company_display: '',
  origin_address: '',
  plan_departure_time: '',
  remark: '',
})

const rules: FormRules = {}

const selectedDetails = ref<ScanDetailItem[]>([])
const totalQty = computed(() => selectedDetails.value.reduce((s, d) => s + (d.delivery_quantity || 0), 0))

function removeDetail(row: ScanDetailItem) {
  selectedDetails.value = selectedDetails.value.filter(d => d.delivery_load_detail_id !== row.delivery_load_detail_id)
}

function handleCancel() { router.back() }

function handleReset() {
  Object.assign(formData, { vehicle_id: '', vehicle_name_display: '', carrier_type: '', driver_id: '', driver_display: '', logistics_company_id: '', logistics_company_display: '', origin_address: '', plan_departure_time: '', remark: '' })
  selectedDetails.value = []
  formRef.value?.clearValidate()
}

function onCarrierTypeChange() {
  formData.driver_id = ''
  formData.driver_display = ''
  formData.logistics_company_id = ''
  formData.logistics_company_display = ''
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    const ids = selectedDetails.value.map(d => d.delivery_load_detail_id)
    await createDeliveryTask({
      scan_detail_ids: ids.length ? JSON.stringify(ids) : undefined,
      vehicle_id: formData.vehicle_id || undefined,
      carrier_type: formData.carrier_type || undefined,
      driver_id: formData.driver_id || undefined,
      logistics_company_id: formData.logistics_company_id || undefined,
      origin_address: formData.origin_address || undefined,
      plan_departure_time: formData.plan_departure_time || undefined,
      remark: formData.remark || undefined,
    })
    ElMessage.success(ids.length ? '配送任务创建成功' : '空任务预建成功，请用 PDA 扫码装货')
    router.push('/delivery/task')
  } catch (e: any) {
    if (e?.response?.data?.detail) ElMessage.error(e.response.data.detail)
  } finally {
    submitting.value = false
  }
}

// ═══════════ 承运类型标签 ═══════════
const CARRIER_MAP: Record<string, { label: string; type: string }> = {
  UNASSIGNED: { label: '未分配', type: 'info' },
  PERSONAL_DRIVER: { label: '个人司机', type: 'success' },
  LOGISTICS_COMPANY: { label: '物流公司', type: 'primary' },
}
function carrierLabel(v: string) { return CARRIER_MAP[v]?.label || v }
function carrierTagType(v: string) { return (CARRIER_MAP[v]?.type || '') as '' | 'success' | 'warning' | 'info' | 'danger' | 'primary' }

// ═══════════ 车辆选择 ═══════════
const vehicleDialogVisible = ref(false)
const vehicleSearch = ref('')
const vehicleOptions = ref<VehicleItem[]>([])
let selectedVehicle: VehicleItem | null = null

async function loadVehicleOptions() {
  try {
    const res = await getVehicleList({ page: 1, page_size: 50, keyword: vehicleSearch.value || undefined })
    vehicleOptions.value = res.data.items
  } catch { vehicleOptions.value = [] }
}

function handleVehicleSelect(row: VehicleItem | null) { selectedVehicle = row }
function clearVehicle() { formData.vehicle_id = ''; formData.vehicle_name_display = '' }
function confirmVehicleSelect() {
  if (selectedVehicle) {
    formData.vehicle_id = selectedVehicle.vehicle_id
    formData.vehicle_name_display = `${selectedVehicle.vehicle_name}（${selectedVehicle.license_plate}）`
  }
  vehicleDialogVisible.value = false
}

// ═══════════ 司机选择 ═══════════
const driverPickerVisible = ref(false)
const driverSearch = ref('')
const driverOptions = ref<DriverOptionItem[]>([])
let selectedDriver: DriverOptionItem | null = null

async function loadDriverOptions() {
  try {
    const res = await getDriverOptions({ keyword: driverSearch.value || undefined, status: 'ACTIVE', limit: 50 })
    driverOptions.value = res.data.options
  } catch { driverOptions.value = [] }
}
function handleDriverSelect(row: DriverOptionItem | null) { selectedDriver = row }
function clearDriver() { formData.driver_id = ''; formData.driver_display = '' }
function confirmDriver() {
  if (selectedDriver) {
    formData.driver_id = selectedDriver.driver_id
    formData.driver_display = `${selectedDriver.driver_name}（${selectedDriver.driver_phone}）`
  }
  driverPickerVisible.value = false
}

// ═══════════ 物流公司选择 ═══════════
const logisticsPickerVisible = ref(false)
const logisticsSearch = ref('')
const logisticsOptions = ref<LogisticsCompanyItem[]>([])
let selectedLogistics: LogisticsCompanyItem | null = null

async function loadLogisticsOptions() {
  try {
    const res = await getLogisticsCompanyList({ page: 1, page_size: 50, keyword: logisticsSearch.value || undefined })
    logisticsOptions.value = res.data.logistics_company.filter((c: LogisticsCompanyItem) => c.status === 1)
  } catch { logisticsOptions.value = [] }
}
function handleLogisticsSelect(row: LogisticsCompanyItem | null) { selectedLogistics = row }
function clearLogistics() { formData.logistics_company_id = ''; formData.logistics_company_display = '' }
function confirmLogistics() {
  if (selectedLogistics) {
    formData.logistics_company_id = selectedLogistics.logistics_company_id
    formData.logistics_company_display = selectedLogistics.company_name
  }
  logisticsPickerVisible.value = false
}

// ═══════════ 待分配明细选择 ═══════════
const detailDialogVisible = ref(false)
const detailTableRef = ref()
const detailOptions = ref<ScanDetailItem[]>([])
const detailPage = ref(1)
const detailPageSize = ref(20)
const detailTotal = ref(0)
const detailSearch = reactive({ keyword: '', carrier_type: '' })
let pendingDetailSelection: ScanDetailItem[] = []

async function loadDetailOptions() {
  try {
    const res = await getScanDetailList({
      page: detailPage.value,
      keyword: detailSearch.keyword || undefined,
      carrier_type: detailSearch.carrier_type || undefined,
    })
    detailOptions.value = res.data.items
    detailTotal.value = res.data.total
  } catch { detailOptions.value = [] }
}

function handleDetailSelectionChange(rows: ScanDetailItem[]) {
  pendingDetailSelection = rows
}

function confirmDetailSelect() {
  const existingIds = new Set(selectedDetails.value.map(d => d.delivery_load_detail_id))
  for (const row of pendingDetailSelection) {
    if (!existingIds.has(row.delivery_load_detail_id)) {
      selectedDetails.value.push(row)
    }
  }
  detailDialogVisible.value = false
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
.section-hint { font-size: 12px; font-weight: 400; color: var(--text-tertiary); margin-left: 4px; }
.input-suffix-wrapper { width: 100%; }
.input-suffix-icon { cursor: pointer; color: var(--text-tertiary); }
.input-suffix-icon:hover { color: var(--primary); }
.detail-selector { border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 12px; background: var(--bg-page); }
.detail-toolbar { display: flex; align-items: center; gap: 16px; }
.detail-count { font-size: 13px; color: var(--text-secondary); }
</style>
