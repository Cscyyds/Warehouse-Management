<template>
  <div class="delivery-task-detail">
    <div class="detail-header">
      <el-button @click="router.back()">返回</el-button>
      <span class="detail-title">配送任务详情</span>
      <el-tag :type="statusTagType(task.status)" size="default" style="margin-left:12px">{{ statusLabel(task.status) }}</el-tag>
    </div>

    <el-card shadow="never" style="margin-bottom:16px">
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
        <el-descriptions-item label="创建人">{{ task.created_by_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ task.created_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ task.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never" style="margin-bottom:16px">
      <template #header><span>装货明细</span></template>
      <el-table :data="loadDetails" border stripe size="small" empty-text="暂无装货明细（等待PDA扫码装货）">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="barcode_code" label="条码" min-width="140" />
        <el-table-column prop="product_name" label="产品名称" min-width="140" />
        <el-table-column prop="specification" label="规格" width="100" />
        <el-table-column prop="customer_name" label="客户" min-width="120" />
        <el-table-column prop="delivery_address" label="送货地址" min-width="180" />
        <el-table-column prop="delivery_quantity" label="数量" width="80" align="center" />
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'LOADED' ? 'success' : 'info'">{{ row.status === 'LOADED' ? '已装车' : row.status === 'PENDING' ? '待分配' : row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>导航路线</span>
          <el-button type="primary" size="small" :loading="routeLoading" @click="handleViewRoute">查看路线</el-button>
        </div>
      </template>
      <div v-if="routeError" class="route-placeholder">
        <el-alert :title="routeError" type="warning" :closable="false" show-icon />
      </div>
      <div v-else-if="routeData">
        <div class="route-info">
          <span>总距离：{{ formatDistance(routeData.distance) }}</span>
          <span style="margin-left:24px">预计耗时：{{ formatDuration(routeData.duration) }}</span>
          <span v-if="routeData.taxi_cost" style="margin-left:24px">预估打车费：¥{{ routeData.taxi_cost }}</span>
        </div>
        <div v-if="routeData.static_map_url" class="route-map">
          <img :src="routeData.static_map_url" alt="路线地图" style="max-width:100%;border-radius:4px" />
        </div>
        <div v-if="routeData.stop_sequence.length" style="margin-top:12px">
          <div class="route-stops-title">停靠顺序（最优路线）</div>
          <el-table :data="routeData.stop_sequence" border stripe size="small">
            <el-table-column type="index" label="顺序" width="60" />
            <el-table-column prop="customer_name" label="客户" width="120" />
            <el-table-column prop="delivery_address" label="送货地址" min-width="200" />
          </el-table>
        </div>
        <div v-if="routeData.not_in_route.length" style="margin-top:12px">
          <el-alert title="以下客户未纳入路线规划" type="info" :closable="false" show-icon style="margin-bottom:8px" />
          <el-table :data="routeData.not_in_route" border stripe size="small">
            <el-table-column prop="customer_name" label="客户" width="120" />
            <el-table-column prop="delivery_address" label="送货地址" min-width="200" />
            <el-table-column prop="reason" label="原因" width="140" />
          </el-table>
        </div>
      </div>
      <div v-else class="route-placeholder">
        <span style="color:#999">点击"查看路线"按钮获取导航路线</span>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getDeliveryTaskDetail, getDrivingRoute, type DeliveryTaskItem, type DeliveryLoadDetailItem, type DrivingRouteResponse } from '@/api'

const route = useRoute()
const router = useRouter()

const task = ref<DeliveryTaskItem>({} as DeliveryTaskItem)
const loadDetails = ref<DeliveryLoadDetailItem[]>([])
const routeData = ref<DrivingRouteResponse | null>(null)
const routeLoading = ref(false)
const routeError = ref('')

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

function formatDistance(d: string | null) {
  if (!d) return '-'
  const m = parseInt(d)
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`
}

function formatDuration(d: string | null) {
  if (!d) return '-'
  const s = parseInt(d)
  if (s >= 3600) return `${Math.floor(s / 3600)}时${Math.floor((s % 3600) / 60)}分`
  return `${Math.floor(s / 60)}分钟`
}

async function loadDetail() {
  const id = route.query.id as string
  if (!id) { ElMessage.error('缺少任务ID'); return }
  try {
    const res = await getDeliveryTaskDetail(id)
    task.value = res.data.task
    loadDetails.value = res.data.load_details || []
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
  } catch (e: any) {
    routeError.value = e?.response?.data?.detail || '路线规划失败'
  } finally {
    routeLoading.value = false
  }
}

onMounted(() => { loadDetail() })
</script>

<style scoped>
.delivery-task-detail {
  padding: 16px;
}
.detail-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.detail-title {
  font-size: 18px;
  font-weight: 600;
  margin-left: 12px;
}
.route-info {
  padding: 12px 0;
  font-size: 14px;
  color: #333;
}
.route-map {
  margin-top: 8px;
}
.route-placeholder {
  padding: 40px 0;
  text-align: center;
}
.route-stops-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #333;
}
</style>
