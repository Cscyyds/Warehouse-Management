<template>
  <div class="delivery-task-detail">
    <div class="detail-header">
      <div class="detail-header-left">
        <el-button @click="router.back()">返回</el-button>
        <span class="detail-title">配送任务详情</span>
        <el-tag :type="statusTagType(task.status)" size="default">{{ statusLabel(task.status) }}</el-tag>
      </div>
      <div>
        <el-button v-if="task.status === 'WAIT_LOAD'" type="primary" size="small" @click="openEditDialog">编辑</el-button>
      </div>
    </div>

    <el-card shadow="never" class="detail-card">
      <template #header><span>基本信息</span></template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="任务编号">{{ task.delivery_task_no }}</el-descriptions-item>
        <el-descriptions-item label="车牌号">{{ task.license_plate || '-' }}</el-descriptions-item>
        <el-descriptions-item label="车辆名称">{{ task.vehicle_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="司机">{{ task.driver_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="司机电话">{{ task.driver_phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="起始地址">{{ task.origin_address || '-' }}</el-descriptions-item>
        <el-descriptions-item label="计划发车时间">{{ task.plan_departure_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="实际发车时间">{{ task.actual_departure_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="实际收车时间">{{ task.actual_return_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ task.created_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ task.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never" class="detail-card">
      <template #header><span>装货明细</span></template>
      <el-table :data="loadDetails" border stripe size="small" empty-text="暂无装货明细（等待PDA扫码装货）">
        <el-table-column type="index" label="" width="50" />
        <el-table-column prop="sales_order_no" label="销售单号" min-width="160" />
        <el-table-column prop="logistics_no" label="物流单号" min-width="160" />
        <el-table-column prop="customer_name" label="客户" min-width="120" />
        <el-table-column prop="delivery_address" label="送货地址" min-width="180" />
        <el-table-column prop="delivery_quantity" label="数量" width="80" align="center" />
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'LOADED' ? 'success' : 'info'">
              {{ row.status === 'LOADED' ? '已装车' : row.status === 'PENDING' ? '待分配' : row.status }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never" class="detail-card route-card">
      <template #header>
        <div class="route-card-header">
          <div>
            <span class="section-title">导航路线</span>
            <el-tag v-if="routeData" class="route-status-tag" type="success" size="small">已规划</el-tag>
            <el-tag v-else class="route-status-tag" type="info" size="small">待规划</el-tag>
          </div>
          <div class="route-actions">
            <el-button size="small" :disabled="!routeData?.static_map_url" @click="mapFullscreenVisible = true">
              全屏查看
            </el-button>
            <el-button type="primary" size="small" :loading="routeLoading" @click="handleViewRoute">
              {{ routeData ? '重新规划路线' : '生成路线' }}
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="routeError" class="route-placeholder">
        <el-alert :title="routeError" type="warning" :closable="false" show-icon />
      </div>

      <div v-else-if="routeData" class="route-result">
        <div class="route-summary-grid">
          <div class="route-summary-item">
            <div class="summary-label">总距离</div>
            <div class="summary-value">{{ formatDistance(routeData.distance) }}</div>
          </div>
          <div class="route-summary-item">
            <div class="summary-label">预计耗时</div>
            <div class="summary-value">{{ formatDuration(routeData.duration) }}</div>
          </div>
          <div class="route-summary-item">
            <div class="summary-label">停靠客户</div>
            <div class="summary-value">{{ stopSequence.length }} 个</div>
          </div>
        </div>

        <el-alert
          v-if="notInRoute.length"
          class="route-warning"
          type="warning"
          :closable="false"
          show-icon
          :title="`${notInRoute.length} 个客户未纳入路线规划，请核对地址定位信息`"
        />

        <div class="route-main-layout">
          <div class="route-map-panel">
            <div v-if="routeData.static_map_url" class="route-map-wrapper">
              <img :src="routeData.static_map_url" alt="路线地图" class="route-map-img" />
            </div>
            <div v-else class="route-map-empty">
              <el-empty description="暂无地图图片" />
            </div>
          </div>

          <aside class="route-stop-panel">
            <div class="route-panel-header">
              <div>
                <div class="route-panel-title">路线停靠顺序</div>
                <div class="route-panel-subtitle">按当前规划顺序依次配送</div>
              </div>
              <el-tag size="small" type="primary">最优路线</el-tag>
            </div>

            <div class="route-origin-box">
              <div class="origin-dot">起</div>
              <div class="origin-content">
                <div class="origin-title">起点</div>
                <div class="origin-address">{{ task.origin_address || '未填写起始地址' }}</div>
              </div>
            </div>

            <div v-if="stopSequence.length" class="stop-timeline">
              <div v-for="(stop, index) in stopSequence" :key="`${stop.customer_name || 'customer'}-${index}`" class="stop-item">
                <div class="stop-index">{{ String(index + 1).padStart(2, '0') }}</div>
                <div class="stop-content">
                  <div class="stop-title-row">
                    <span class="stop-customer">{{ stop.customer_name || '-' }}</span>
                    <el-tag v-if="index === stopSequence.length - 1" size="small" type="success">终点</el-tag>
                    <el-tag v-else size="small" type="info">途经点</el-tag>
                  </div>
                  <div class="stop-address">{{ stop.delivery_address || '-' }}</div>
                  <div v-if="navigationUris[index]" class="stop-nav-action">
                    <el-button size="small" link type="primary" @click="handleCopyNavUri(index)">
                      导航到此
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <el-empty v-else description="暂无有效停靠点" :image-size="72" />
          </aside>
        </div>

        <div class="route-table-section">
          <div class="route-stops-title">停靠明细</div>
          <el-table :data="stopSequence" border stripe size="small" empty-text="暂无停靠明细">
            <el-table-column type="index" label="顺序" width="70" />
            <el-table-column prop="customer_name" label="客户" width="140" />
            <el-table-column prop="delivery_address" label="送货地址" min-width="240" />
            <el-table-column label="定位状态" width="110" align="center">
              <template #default>
                <el-tag size="small" type="success">已纳入</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="notInRoute.length" class="route-table-section">
          <div class="route-stops-title warning-title">未纳入路线规划客户</div>
          <el-table :data="notInRoute" border stripe size="small">
            <el-table-column prop="customer_name" label="客户" width="140" />
            <el-table-column prop="delivery_address" label="送货地址" min-width="240" />
            <el-table-column prop="reason" label="原因" width="160" />
            <el-table-column label="定位状态" width="110" align="center">
              <template #default>
                <el-tag size="small" type="warning">未纳入</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <div v-else class="route-empty-state">
        <el-empty description="当前任务暂未生成导航路线">
          <template #description>
            <div class="empty-desc">
              <div>当前任务暂未生成导航路线</div>
              <div class="empty-tip">点击“生成路线”后，将展示路线地图、总距离、预计耗时与停靠顺序。</div>
            </div>
          </template>
          <el-button type="primary" :loading="routeLoading" @click="handleViewRoute">生成路线</el-button>
        </el-empty>
      </div>
    </el-card>

    <el-dialog v-model="mapFullscreenVisible" title="导航路线地图" width="92vw" top="4vh" destroy-on-close>
      <div class="fullscreen-map-wrapper">
        <img v-if="routeData?.static_map_url" :src="routeData.static_map_url" alt="路线地图" class="fullscreen-map-img" />
        <el-empty v-else description="暂无地图图片" />
      </div>
    </el-dialog>
  </div>

  <!-- 编辑配送任务弹窗 -->
  <el-dialog v-model="editDialogVisible" title="编辑配送任务" width="520px" :close-on-click-modal="false" destroy-on-close>
    <el-form ref="editFormRef" :model="editForm" label-width="110px" size="default">
      <el-form-item label="承运方式">
        <el-select v-model="editForm.carrier_type" clearable placeholder="请选择" style="width:100%" @change="onEditCarrierTypeChange">
          <el-option label="个人司机" value="PERSONAL_DRIVER" />
          <el-option label="物流公司" value="LOGISTICS_COMPANY" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="editForm.carrier_type === 'PERSONAL_DRIVER'" label="承运司机">
        <div class="input-suffix-wrapper">
          <el-input v-model="editForm.driver_display" placeholder="点击选择司机" readonly style="width:100%" @click="editDriverPickerVisible = true">
            <template #suffix>
              <el-icon v-if="editForm.driver_id" class="input-suffix-icon" @click.stop="editForm.driver_id='';editForm.driver_display=''"><CircleClose /></el-icon>
              <el-icon v-else class="input-suffix-icon" @click.stop="editDriverPickerVisible = true"><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </el-form-item>
      <el-form-item v-if="editForm.carrier_type === 'LOGISTICS_COMPANY'" label="承运公司">
        <div class="input-suffix-wrapper">
          <el-input v-model="editForm.logistics_display" placeholder="点击选择物流公司" readonly style="width:100%" @click="editLogisticsPickerVisible = true">
            <template #suffix>
              <el-icon v-if="editForm.logistics_company_id" class="input-suffix-icon" @click.stop="editForm.logistics_company_id='';editForm.logistics_display=''"><CircleClose /></el-icon>
              <el-icon v-else class="input-suffix-icon" @click.stop="editLogisticsPickerVisible = true"><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </el-form-item>
      <el-form-item label="计划发车时间">
        <el-date-picker v-model="editForm.plan_departure_time" type="datetime" placeholder="选填" format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="editForm.remark" type="textarea" :rows="2" maxlength="255" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="editSubmitting" @click="handleEditSubmit">保存</el-button>
    </template>
  </el-dialog>

  <!-- 编辑弹窗内的司机选择器 -->
  <el-dialog v-model="editDriverPickerVisible" title="选择司机" width="560px" :close-on-click-modal="false" destroy-on-close>
    <el-form inline size="default" style="margin-bottom:12px">
      <el-form-item><el-input v-model="editDriverSearch" placeholder="姓名/电话" clearable style="width:200px" /></el-form-item>
      <el-form-item><el-button type="primary" @click="loadEditDriverOptions">查询</el-button></el-form-item>
    </el-form>
    <el-table
      border
      :data="editDriverOptions"
      highlight-current-row
      style="width:100%"
      @current-change="handleEditDriverCurrentChange"
      max-height="300"
    >
      <el-table-column prop="driver_name" label="姓名" min-width="140" />
      <el-table-column prop="driver_phone" label="电话" min-width="170" />
      <el-table-column prop="driver_type" label="类型" min-width="140" align="center">
        <template #default="{ row }">{{ driverTypeLabel(row.driver_type) }}</template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="editDriverPickerVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmEditDriver">确认</el-button>
    </template>
  </el-dialog>

  <!-- 编辑弹窗内的物流公司选择器 -->
  <el-dialog v-model="editLogisticsPickerVisible" title="选择物流公司" width="760px" :close-on-click-modal="false" destroy-on-close>
    <el-form inline size="default" style="margin-bottom:12px">
      <el-form-item><el-input v-model="editLogisticsSearch" placeholder="公司名称" clearable style="width:200px" /></el-form-item>
      <el-form-item><el-button type="primary" @click="loadEditLogisticsOptions">查询</el-button></el-form-item>
    </el-form>
    <el-table
      border
      :data="editLogisticsOptions"
      highlight-current-row
      style="width:100%"
      @current-change="handleEditLogisticsCurrentChange"
      max-height="300"
    >
      <el-table-column prop="company_name" label="公司名称" min-width="220" show-overflow-tooltip />
      <el-table-column prop="sort_no" label="排序号" width="100" align="center" />
      <el-table-column prop="status" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
            {{ logisticsStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">{{ row.remark || '-' }}</template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="editLogisticsPickerVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmEditLogistics">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, CircleClose } from '@element-plus/icons-vue'
import type { FormInstance } from 'element-plus'
import {
  getDeliveryTaskDetail, getDrivingRoute, updateDeliveryTask,
  getDriverOptions, getLogisticsCompanyList,
  type DeliveryTaskItem, type DeliveryLoadDetailItem, type DrivingRouteResponse,
  type DriverOptionItem,
} from '@/api'
import type { LogisticsCompanyItem } from '@/api'

const route = useRoute()
const router = useRouter()

const task = ref<DeliveryTaskItem>({} as DeliveryTaskItem)
const loadDetails = ref<DeliveryLoadDetailItem[]>([])
const routeData = ref<DrivingRouteResponse | null>(null)
const routeLoading = ref(false)
const routeError = ref('')
const mapFullscreenVisible = ref(false)

const stopSequence = computed(() => routeData.value?.stop_sequence || [])
const notInRoute = computed(() => routeData.value?.not_in_route || [])
const navigationUris = computed(() => routeData.value?.navigation_uris || [])

const STATUS_MAP: Record<string, { label: string; type: string }> = {
  WAIT_LOAD: { label: '待装车', type: '' },
  LOADING: { label: '装车中', type: 'primary' },
  WAIT_DEPARTURE: { label: '待发车', type: 'warning' },
  DELIVERING: { label: '配送中', type: 'success' },
  FINISHED: { label: '已完成', type: 'info' },
  CANCELLED: { label: '已取消', type: 'danger' },
}

function statusLabel(s: string) { return STATUS_MAP[s]?.label || s || '-' }
function statusTagType(s: string) { return (STATUS_MAP[s]?.type || '') as '' | 'success' | 'warning' | 'info' | 'danger' | 'primary' }
function driverTypeLabel(v: string) { return v === 'INTERNAL_EMPLOYEE' ? '内部员工' : v === 'EXTERNAL_INDIVIDUAL' ? '外部个体' : (v || '-') }
function logisticsStatusLabel(v: number | null | undefined) { return v === 1 ? '启用' : '停用' }

function formatDistance(d: string | number | null | undefined) {
  if (d === null || d === undefined || d === '') return '-'
  const m = Number(d)
  if (Number.isNaN(m)) return '-'
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function formatDuration(d: string | number | null | undefined) {
  if (d === null || d === undefined || d === '') return '-'
  const s = Number(d)
  if (Number.isNaN(s)) return '-'
  if (s >= 3600) {
    const hour = Math.floor(s / 3600)
    const minute = Math.floor((s % 3600) / 60)
    return `${hour}小时${minute}分钟`
  }
  return `${Math.max(1, Math.floor(s / 60))}分钟`
}

async function loadDetail() {
  const id = route.query.id as string
  if (!id) { ElMessage.error('缺少任务ID'); return }
  try {
    const res = await getDeliveryTaskDetail(id)
    task.value = res.data.task
    loadDetails.value = res.data.load_details || []
    // 如果有缓存的路线数据，直接展示
    if (res.data.route_cache) {
      routeData.value = res.data.route_cache
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || '加载失败')
  }
}

async function handleViewRoute() {
  const id = route.query.id as string
  if (!id) return
  routeLoading.value = true
  routeError.value = ''
  routeData.value = null
  try {
    const res = await getDrivingRoute(id)
    routeData.value = res.data
    ElMessage.success('路线规划成功')
  } catch (e: any) {
    routeError.value = e?.response?.data?.detail || '路线规划失败'
  } finally {
    routeLoading.value = false
  }
}

function handleCopyNavUri(index: number) {
  const seg = navigationUris.value[index]
  if (!seg) return
  navigator.clipboard.writeText(seg.uri).catch(() => {})
  window.open(seg.uri, '_blank')
}

onMounted(() => { loadDetail() })

// ═══════════ 编辑弹窗 ═══════════
const editDialogVisible = ref(false)
const editSubmitting = ref(false)
const editFormRef = ref<FormInstance>()
const editForm = reactive({
  carrier_type: '',
  driver_id: '',
  driver_display: '',
  logistics_company_id: '',
  logistics_display: '',
  plan_departure_time: '',
  remark: '',
})

function openEditDialog() {
  Object.assign(editForm, {
    carrier_type: task.value.carrier_type === 'UNASSIGNED' ? '' : (task.value.carrier_type || ''),
    driver_id: task.value.driver_id || '',
    driver_display: task.value.driver_name ? `${task.value.driver_name}（${task.value.driver_phone || ''}）` : '',
    logistics_company_id: task.value.logistics_company_id || '',
    logistics_display: task.value.logistics_company_name || '',
    plan_departure_time: task.value.plan_departure_time ? task.value.plan_departure_time.replace('T', ' ') : '',
    remark: task.value.remark || '',
  })
  editDialogVisible.value = true
}

function onEditCarrierTypeChange() {
  editForm.driver_id = ''
  editForm.driver_display = ''
  editForm.logistics_company_id = ''
  editForm.logistics_display = ''
}

async function handleEditSubmit() {
  editSubmitting.value = true
  try {
    const id = route.query.id as string
    await updateDeliveryTask({
      delivery_task_id: id,
      carrier_type: editForm.carrier_type || 'UNASSIGNED',
      driver_id: editForm.driver_id || undefined,
      logistics_company_id: editForm.logistics_company_id || undefined,
      plan_departure_time: editForm.plan_departure_time || undefined,
      remark: editForm.remark || undefined,
    })
    ElMessage.success('修改成功')
    editDialogVisible.value = false
    loadDetail()
  } catch (e: any) {
    if (e?.response?.data?.detail) ElMessage.error(e.response.data.detail)
  } finally {
    editSubmitting.value = false
  }
}

// ── 编辑弹窗内司机选择 ──
const editDriverPickerVisible = ref(false)
const editDriverSearch = ref('')
const editDriverOptions = ref<DriverOptionItem[]>([])
let selectedEditDriver: DriverOptionItem | null = null

function handleEditDriverCurrentChange(row: DriverOptionItem | null) {
  selectedEditDriver = row
}

async function loadEditDriverOptions() {
  try {
    const res = await getDriverOptions({ keyword: editDriverSearch.value || undefined, status: 'ACTIVE', limit: 50 })
    editDriverOptions.value = res.data.options
  } catch { editDriverOptions.value = [] }
}
function confirmEditDriver() {
  if (selectedEditDriver) {
    editForm.driver_id = selectedEditDriver.driver_id
    editForm.driver_display = `${selectedEditDriver.driver_name}（${selectedEditDriver.driver_phone}）`
  }
  editDriverPickerVisible.value = false
}

// ── 编辑弹窗内物流公司选择 ──
const editLogisticsPickerVisible = ref(false)
const editLogisticsSearch = ref('')
const editLogisticsOptions = ref<LogisticsCompanyItem[]>([])
let selectedEditLogistics: LogisticsCompanyItem | null = null

function handleEditLogisticsCurrentChange(row: LogisticsCompanyItem | null) {
  selectedEditLogistics = row
}

async function loadEditLogisticsOptions() {
  try {
    const res = await getLogisticsCompanyList({ page: 1, page_size: 50, keyword: editLogisticsSearch.value || undefined })
    editLogisticsOptions.value = res.data.logistics_company.filter((c: LogisticsCompanyItem) => c.status === 1)
  } catch { editLogisticsOptions.value = [] }
}
function confirmEditLogistics() {
  if (selectedEditLogistics) {
    editForm.logistics_company_id = selectedEditLogistics.logistics_company_id
    editForm.logistics_display = selectedEditLogistics.company_name
  }
  editLogisticsPickerVisible.value = false
}
</script>

<style scoped>
.delivery-task-detail {
  padding: 16px;
  background: var(--bg-page);
  min-height: 100%;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.detail-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.detail-card {
  margin-bottom: 16px;
  border-radius: 12px;
}

.route-card :deep(.el-card__body) {
  padding: 18px 24px 24px;
}

.route-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.route-status-tag {
  margin-left: 10px;
}

.route-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.route-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.route-summary-item {
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: linear-gradient(180deg, var(--bg-white) 0%, var(--bg-page) 100%);
}

.summary-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.summary-value {
  font-size: 20px;
  line-height: 1.2;
  font-weight: 700;
  color: var(--text-primary);
}

.route-warning {
  margin-bottom: 16px;
}

.route-main-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: stretch;
}

.route-map-panel,
.route-stop-panel {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-white);
  overflow: hidden;
}

.route-map-wrapper {
  width: 100%;
  height: 520px;
  background: var(--bg-page);
  overflow: hidden;
}

.route-map-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.route-map-empty {
  height: 520px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-page);
}

.route-stop-panel {
  padding: 16px;
  max-height: 520px;
  overflow-y: auto;
}

.route-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-light);
}

.route-panel-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.route-panel-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.route-origin-box {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-light);
}

.origin-dot,
.stop-index {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.origin-dot {
  color: #fff;
  background: var(--primary);
}

.origin-content,
.stop-content {
  min-width: 0;
  flex: 1;
}

.origin-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.origin-address,
.stop-address {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  word-break: break-all;
}

.stop-nav-action {
  margin-top: 4px;
}

.stop-timeline {
  padding-top: 12px;
}

.stop-item {
  position: relative;
  display: flex;
  gap: 12px;
  padding-bottom: 16px;
}

.stop-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 13px;
  top: 32px;
  bottom: 4px;
  width: 2px;
  background: var(--primary-border);
}

.stop-index {
  color: var(--primary);
  background: var(--primary-bg);
  border: 1px solid var(--primary-border);
}

.stop-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stop-customer {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-table-section {
  margin-top: 16px;
}

.route-stops-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.warning-title {
  color: var(--warning);
}

.route-placeholder {
  padding: 40px 0;
  text-align: center;
}

.route-empty-state {
  padding: 36px 0;
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  background: var(--bg-white);
}

.empty-desc {
  color: var(--text-secondary);
}

.empty-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.fullscreen-map-wrapper {
  height: 76vh;
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-page);
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-map-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@media (max-width: 1280px) {
  .route-main-layout {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
}

@media (max-width: 960px) {
  .route-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .route-main-layout {
    grid-template-columns: 1fr;
  }

  .route-stop-panel {
    max-height: none;
  }
}

@media (max-width: 640px) {
  .route-card-header,
  .detail-header,
  .detail-header-left {
    align-items: flex-start;
    flex-direction: column;
  }

  .route-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .route-summary-grid {
    grid-template-columns: 1fr;
  }

  .route-map-wrapper,
  .route-map-empty {
    height: 360px;
  }
}
</style>
