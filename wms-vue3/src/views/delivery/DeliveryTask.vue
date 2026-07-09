<template>
  <ListTemplate
    title="配送任务"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    :columns="columns"
    :table-data="tableData"
    :show-index="true"
    @page-change="loadData"
    @add="handleAdd"
    @sort-change="handleSortChange"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="关键词"><el-input v-model="searchForm.keyword" placeholder="任务编号/车牌号/司机" clearable style="width:200px" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:110px">
            <el-option label="待装车" value="WAIT_LOAD" />
            <el-option label="装车中" value="LOADING" />
            <el-option label="待发车" value="WAIT_DEPARTURE" />
            <el-option label="配送中" value="DELIVERING" />
            <el-option label="已完成" value="FINISHED" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
    </template>
    <template #col-status="{ row }">
      <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
    </template>
    <template #col-actions="{ row }">
      <el-button link type="primary" size="small" @click="handleDetail(row)">详情</el-button>
      <el-button v-if="canCancel(row.status)" link type="danger" size="small" @click="handleCancel(row)">取消</el-button>
    </template>
  </ListTemplate>

  <!-- 新增配送任务弹窗 -->
  <el-dialog v-model="createDialogVisible" title="新增配送任务" width="520px" destroy-on-close>
    <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px" label-position="top">
      <el-form-item label="指派车辆" prop="vehicle_id">
        <el-input v-model="createForm.vehicle_name_display" placeholder="请选择车辆" readonly>
          <template #append>
            <el-button @click="vehicleDialogVisible = true">选择</el-button>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item label="起始地址" prop="origin_address">
        <el-input v-model="createForm.origin_address" placeholder="请输入起始地址" maxlength="255" />
      </el-form-item>
      <el-form-item label="指派司机" prop="driver_id">
        <el-input v-model="createForm.driver_name_display" placeholder="请选择司机（选填）" readonly>
          <template #append>
            <el-button @click="driverDialogVisible = true">选择</el-button>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item label="计划发车时间" prop="plan_departure_time">
        <el-date-picker v-model="createForm.plan_departure_time" type="datetime" placeholder="请选择" format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="createForm.remark" type="textarea" :rows="2" placeholder="请输入备注" maxlength="255" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="createDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="createLoading" @click="submitCreate">确认创建</el-button>
    </template>
  </el-dialog>

  <!-- 车辆选择弹窗 -->
  <el-dialog v-model="vehicleDialogVisible" title="选择车辆" width="600px" destroy-on-close>
    <el-form inline size="default" style="margin-bottom:12px">
      <el-form-item><el-input v-model="vehicleSearch" placeholder="搜索车牌号/名称" clearable style="width:200px" /></el-form-item>
      <el-form-item><el-button type="primary" @click="loadVehicleOptions">查询</el-button></el-form-item>
    </el-form>
    <el-table :data="vehicleOptions" highlight-current-row @current-change="handleVehicleSelect" max-height="300">
      <el-table-column prop="license_plate" label="车牌号" width="140" />
      <el-table-column prop="vehicle_name" label="车辆名称" min-width="140" />
      <el-table-column prop="status" label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 'IDLE' ? 'success' : 'warning'" size="small">{{ row.status === 'IDLE' ? '空闲' : '使用中' }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="vehicleDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmVehicleSelect">确认</el-button>
    </template>
  </el-dialog>

  <!-- 司机选择弹窗 -->
  <el-dialog v-model="driverDialogVisible" title="选择司机" width="500px" destroy-on-close>
    <el-form inline size="default" style="margin-bottom:12px">
      <el-form-item><el-input v-model="driverSearch" placeholder="搜索姓名/手机号" clearable style="width:200px" /></el-form-item>
      <el-form-item><el-button type="primary" @click="loadDriverOptions">查询</el-button></el-form-item>
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
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { getDeliveryTaskList, createDeliveryTask, cancelDeliveryTask, type DeliveryTaskItem } from '@/api'
import { getVehicleList, type VehicleItem } from '@/api'
import { get } from '@/utils/request'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<DeliveryTaskItem[]>([])
const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const loading = ref(false)

const columns: Column[] = [
  { prop: 'delivery_task_no', label: '任务编号', minWidth: 160, sortable: true },
  { prop: 'license_plate', label: '车牌号', width: 130 },
  { prop: 'vehicle_name', label: '车辆名称', width: 130 },
  { prop: 'driver_name', label: '司机', width: 100 },
  { prop: 'origin_address', label: '起始地址', minWidth: 160 },
  { prop: 'status', label: '状态', width: 100, align: 'center' },
  { prop: 'plan_departure_time', label: '计划发车时间', width: 170, sortable: true },
  { prop: 'created_at', label: '创建时间', width: 170, sortable: true },
]

const STATUS_MAP: Record<string, { label: string; type: string }> = {
  WAIT_LOAD: { label: '待装车', type: '' },
  LOADING: { label: '装车中', type: 'primary' },
  WAIT_DEPARTURE: { label: '待发车', type: 'warning' },
  DELIVERING: { label: '配送中', type: 'success' },
  FINISHED: { label: '已完成', type: 'info' },
  CANCELLED: { label: '已取消', type: 'danger' },
}

function statusLabel(s: string) { return STATUS_MAP[s]?.label || s }
function statusTagType(s: string) { return (STATUS_MAP[s]?.type || '') as '' | 'success' | 'warning' | 'info' | 'danger' | 'primary' }
function canCancel(s: string) { return ['WAIT_LOAD', 'LOADING', 'WAIT_DEPARTURE'].includes(s) }

async function loadData() {
  loading.value = true
  try {
    const res = await getDeliveryTaskList({
      page: pagination.page,
      page_size: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status || undefined,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
    })
    tableData.value = res.data.tasks
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { keyword: '', status: '' }); handleSearch() }
function handleDetail(row: DeliveryTaskItem) {
  router.push({ path: '/delivery/task/detail', query: { id: row.delivery_task_id } })
}

async function handleCancel(row: DeliveryTaskItem) {
  try {
    await ElMessageBox.confirm(`确认取消配送任务「${row.delivery_task_no}」？`, '提示', { confirmButtonText: '确认取消', type: 'warning' })
    await cancelDeliveryTask(row.delivery_task_id)
    ElMessage.success('取消成功')
    loadData()
  } catch (e: any) {
    if (e?.response?.data?.detail) {
      ElMessage.error(e.response.data.detail)
    }
  }
}

// ═══════════ 新增配送任务 ═══════════
const createDialogVisible = ref(false)
const createLoading = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = reactive({
  vehicle_id: '',
  vehicle_name_display: '',
  origin_address: '',
  driver_id: '',
  driver_name_display: '',
  plan_departure_time: '',
  remark: '',
})
const createRules: FormRules = {
  vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }],
}

function handleAdd() {
  Object.assign(createForm, { vehicle_id: '', vehicle_name_display: '', origin_address: '', driver_id: '', driver_name_display: '', plan_departure_time: '', remark: '' })
  createDialogVisible.value = true
}

async function submitCreate() {
  if (!createFormRef.value) return
  await createFormRef.value.validate()
  createLoading.value = true
  try {
    await createDeliveryTask({
      vehicle_id: createForm.vehicle_id,
      origin_address: createForm.origin_address || undefined,
      driver_id: createForm.driver_id || undefined,
      plan_departure_time: createForm.plan_departure_time || undefined,
      remark: createForm.remark || undefined,
    })
    ElMessage.success('创建成功')
    createDialogVisible.value = false
    loadData()
  } catch (e: any) {
    if (e?.response?.data?.detail) {
      ElMessage.error(e.response.data.detail)
    }
  } finally {
    createLoading.value = false
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
    vehicleOptions.value = res.data.vehicles
  } catch {
    vehicleOptions.value = []
  }
}

function handleVehicleSelect(row: VehicleItem | null) { selectedVehicle = row }
function confirmVehicleSelect() {
  if (selectedVehicle) {
    createForm.vehicle_id = selectedVehicle.vehicle_id
    createForm.vehicle_name_display = `${selectedVehicle.vehicle_name}（${selectedVehicle.license_plate}）`
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
    const res = await get<{ users: { user_id: string; user_name: string; phone: string }[] }>('/api/v1/tenant-users/query', { keyword: driverSearch.value || undefined, page: 1 })
    driverOptions.value = (res.data as any).users || []
  } catch {
    driverOptions.value = []
  }
}

function handleDriverSelect(row: { user_id: string; user_name: string; phone: string } | null) { selectedDriver = row }
function confirmDriverSelect() {
  if (selectedDriver) {
    createForm.driver_id = selectedDriver.user_id
    createForm.driver_name_display = selectedDriver.user_name
  }
  driverDialogVisible.value = false
}

onMounted(() => { loadData() })
</script>
