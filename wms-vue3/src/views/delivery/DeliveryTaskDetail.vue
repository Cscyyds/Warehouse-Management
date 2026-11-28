<template>
  <div v-loading="loading" class="delivery-task-detail">
    <div class="detail-header">
      <div class="detail-header-left"><el-button @click="router.back()">返回</el-button><span class="detail-title">{{ task?.delivery_task_no || '配送任务详情' }}</span><el-tag v-if="task" :type="statusTagType(task.status)">{{ statusLabel(task.status) }}</el-tag></div>
      <div class="task-actions" v-if="task">
        <el-button :disabled="busy" @click="loadDetail">刷新</el-button>
        <el-button v-if="task.status === 'WAIT_LOAD'" v-perm="'POST /api/v1/tenant-delivery-tasks/update'" :disabled="busy" @click="openEditDialog">编辑资料</el-button>
        <template v-for="item in availableActions" :key="item.action"><el-button v-perm="'POST /api/v1/tenant-delivery-tasks/operate'" :type="item.action === 'CANCEL' ? 'danger' : 'primary'" :plain="item.action === 'CANCEL' || item.action === 'REOPEN_LOADING'" :disabled="busy" @click="run(item.action)">{{ item.label }}</el-button></template>
      </div>
    </div>
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" show-icon class="detail-card" />
    <template v-if="task">
    <el-card shadow="never" class="detail-card">
      <template #header>任务信息</template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="承运方式">{{ task.carrier_type === 'PERSONAL_DRIVER' ? '个人司机' : task.carrier_type === 'LOGISTICS_COMPANY' ? '物流公司' : '待指派' }}</el-descriptions-item>
        <el-descriptions-item label="承运方">{{ task.driver_name || task.logistics_company_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="司机电话">{{ task.driver_phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="车辆">{{ task.license_plate || '-' }} {{ task.vehicle_name || '' }}</el-descriptions-item>
        <el-descriptions-item label="起始地址" :span="2">{{ task.origin_address || '-' }}</el-descriptions-item>
        <el-descriptions-item label="计划发车时间">{{ task.plan_departure_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="实际发车时间">{{ task.actual_departure_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="完成时间">{{ task.completed_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="开始装车">{{ task.loading_started_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="装车完成">{{ task.loading_completed_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ task.created_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="3">{{ task.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
    <el-card shadow="never" class="detail-card">
      <template #header><div class="route-card-header"><span>装货明细 <el-tag size="small" type="info">已确认 {{ confirmedCount }} / {{ loadDetails.length }} 张</el-tag></span><el-button v-if="canManageDetails" v-perm="'POST /api/v1/tenant-delivery-tasks/operate'" :disabled="busy" size="small" type="primary" plain @click="pickerVisible = true">追加销售订单</el-button></div></template>
      <el-alert v-if="canManageDetails" title="请核对展开的出库产品和收货资料，再逐单确认装车；物流合单按整组分配和移出。" type="info" :closable="false" class="load-hint" />
      <el-table :data="loadDetails" row-key="delivery_load_detail_id" border size="small" empty-text="暂无销售订单，请追加待配送销售订单">
        <el-table-column type="expand"><template #default="{ row }"><div class="source-products"><el-alert v-if="!row.source_snapshot" title="旧明细尚无出库快照，请先刷新出库信息并核对。" type="warning" :closable="false" /><el-table :data="row.source_snapshot?.items || []" border size="small"><el-table-column prop="product_code" label="产品编码" width="150" /><el-table-column prop="product_name" label="产品名称" min-width="180" show-overflow-tooltip /><el-table-column prop="specification" label="规格" min-width="150" show-overflow-tooltip /><el-table-column prop="length" label="长度" width="100" /><el-table-column prop="unit_name" label="单位" width="80" /><el-table-column prop="actual_out_qty" label="实际出库数量" width="120" align="right" /></el-table></div></template></el-table-column>
        <el-table-column prop="sales_order_no" label="销售订单号" min-width="170" />
        <el-table-column prop="customer_name" label="客户" min-width="120" show-overflow-tooltip />
        <el-table-column prop="logistics_no" label="物流单号" min-width="160" />
        <el-table-column prop="delivery_address" label="收货地址" min-width="190" show-overflow-tooltip />
        <el-table-column prop="customer_phone" label="收货电话" width="130" />
        <el-table-column prop="carrier_waybill_no" label="外部运单号" min-width="150" />
        <el-table-column label="装车确认" width="100"><template #default="{ row }"><el-tag :type="row.load_status === 'CONFIRMED' ? 'success' : 'info'" size="small">{{ row.load_status === 'CONFIRMED' ? '已确认' : '待确认' }}</el-tag></template></el-table-column>
        <el-table-column prop="loaded_by_name" label="确认人" width="90" />
        <el-table-column label="操作" width="240" fixed="right"><template #default="{ row }"><span v-perm="'POST /api/v1/tenant-delivery-tasks/operate'">
          <el-button v-if="task.status === 'LOADING' && row.load_status !== 'CONFIRMED'" link type="primary" :disabled="busy" @click="run('CONFIRM_LOAD', row)">确认装车</el-button>
          <el-button v-if="canManageDetails && row.load_status === 'CONFIRMED'" link type="warning" :disabled="busy" @click="run('UNCONFIRM_LOAD', row)">撤销确认</el-button>
          <el-button v-if="canManageDetails && row.load_status !== 'CONFIRMED'" link type="primary" :disabled="busy" @click="run('REFRESH_SOURCE', row)">刷新出库信息</el-button>
          <el-button v-if="canManageDetails && row.load_status !== 'CONFIRMED'" link type="danger" :disabled="busy" @click="run('DETACH_ORDER', row)">移出</el-button>
          <el-button v-if="['WAIT_LOAD', 'LOADING', 'WAIT_DEPARTURE'].includes(task.status) && task.carrier_type === 'LOGISTICS_COMPANY'" link type="primary" :disabled="busy" @click="run('SET_WAYBILL', row)">填写运单号</el-button>
        </span></template></el-table-column>
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
            <el-table-column prop="customer_name" label="客户" show-overflow-tooltip width="140" />
            <el-table-column prop="delivery_address" label="送货地址" show-overflow-tooltip min-width="240" />
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
            <el-table-column prop="customer_name" label="客户" show-overflow-tooltip width="140" />
            <el-table-column prop="delivery_address" label="送货地址" show-overflow-tooltip min-width="240" />
            <el-table-column prop="reason" label="原因" show-overflow-tooltip width="160" />
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

    <el-card shadow="never" class="detail-card"><template #header>操作记录</template><el-table :data="operations" size="small" border empty-text="暂无操作记录"><el-table-column prop="created_at" label="时间" width="190" /><el-table-column label="操作" width="140"><template #default="{ row }">{{ actionLabel(row.action) }}</template></el-table-column><el-table-column prop="operator_name" label="操作人" width="120" /><el-table-column prop="remark" label="说明" min-width="200" show-overflow-tooltip /></el-table></el-card>
    </template>
    <DeliveryOrderPicker v-model="pickerVisible" :excluded-ids="loadDetails.map(row => row.sales_order_id || '')" @confirm="attachOrders" />
    <el-dialog v-model="editDialogVisible" title="编辑配送任务" width="760px" :close-on-click-modal="false"><el-form label-width="130px"><DeliveryTaskFields v-model="editForm" /></el-form><template #footer><el-button type="primary" :loading="busy" @click="saveEdit">保存</el-button><el-button @click="editDialogVisible = false">关闭</el-button></template></el-dialog>
    <el-dialog v-model="operationDialogVisible" :title="actionLabel(pendingAction)" width="520px" :close-on-click-modal="false">
      <el-alert v-if="pendingAction === 'CANCEL' && confirmedCount" title="存在已确认装车订单，请先核实货物卸下。取消后订单将释放配送任务占用。" type="warning" :closable="false" />
      <el-alert v-if="pendingAction === 'DETACH_ORDER'" title="同一物流合单的所有订单会整体移出。" type="warning" :closable="false" />
      <el-form label-position="top" class="operation-form"><el-form-item v-if="pendingAction === 'SET_WAYBILL'" label="外部运单号" required><el-input v-model="waybill" maxlength="64" /></el-form-item><el-form-item v-else :label="pendingAction === 'FINISH' ? '送达或交接依据' : '操作原因'" required><el-input v-model="reason" type="textarea" :rows="3" maxlength="255" show-word-limit /></el-form-item><el-checkbox v-if="pendingAction === 'CANCEL' && confirmedCount" v-model="unloadConfirmed">已核实卸货，允许释放本任务的全部订单</el-checkbox></el-form>
      <template #footer><el-button type="primary" :loading="busy" @click="submitOperation">确认</el-button><el-button @click="operationDialogVisible = false">关闭</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getDeliveryTaskDetail, updateDeliveryTask, operateDeliveryTask, getDrivingRoute, type DeliveryTaskItem, type DeliveryLoadDetailItem, type DeliveryTaskDetailResponse, type DrivingRouteResponse, type DeliveryAction, type DeliveryOperationPayload, type DeliveryEligibleOrder } from '@/api/modules/delivery'
import { showErrorDialog } from '@/utils/errorFeedback'
import { confirmAction } from '@/utils/actionDialog'
import DeliveryTaskFields, { type DeliveryForm } from './DeliveryTaskFields.vue'
import DeliveryOrderPicker from './DeliveryOrderPicker.vue'
const router = useRouter(), route = useRoute()
const task = ref<DeliveryTaskItem | null>(null), loadDetails = ref<DeliveryLoadDetailItem[]>([])
const operations = ref<DeliveryTaskDetailResponse['operations']>([])
const loading = ref(false), busy = ref(false), loadError = ref(''), pickerVisible = ref(false)
const routeData = ref<DrivingRouteResponse | null>(null), routeLoading = ref(false), routeError = ref(''), mapFullscreenVisible = ref(false)
const stopSequence = computed(() => routeData.value?.stop_sequence || [])
const notInRoute = computed(() => routeData.value?.not_in_route || [])
const navigationUris = computed(() => routeData.value?.navigation_uris || [])
const confirmedCount = computed(() => loadDetails.value.filter(row => row.load_status === 'CONFIRMED').length)
const canManageDetails = computed(() => !!task.value && ['WAIT_LOAD', 'LOADING'].includes(task.value.status))
const statuses: Record<string, { label: string; type: 'info' | 'primary' | 'warning' | 'success' | 'danger' }> = { WAIT_LOAD: { label:'待装车', type:'info' }, LOADING: { label:'装车中', type:'primary' }, WAIT_DEPARTURE: { label:'待发车', type:'warning' }, DELIVERING: { label:'配送中', type:'success' }, FINISHED: { label:'已完成', type:'info' }, CANCELLED: { label:'已取消', type:'danger' } }
function statusLabel(value: string) { return statuses[value]?.label || value }
function statusTagType(value: string) { return statuses[value]?.type || 'info' }
const actionNames: Record<DeliveryAction, string> = { ATTACH_ORDERS:'追加订单', DETACH_ORDER:'移出物流单订单', CONFIRM_LOAD:'确认装车', UNCONFIRM_LOAD:'撤销装车确认', REFRESH_SOURCE:'刷新出库信息', SET_WAYBILL:'填写外部运单号', START_LOADING:'开始装车', COMPLETE_LOADING:'完成装车', REOPEN_LOADING:'重新装车', DEPART:'确认发车', FINISH:'确认完成', CANCEL:'取消任务' }
function actionLabel(action: DeliveryAction) { return actionNames[action] || action }
const availableActions = computed(() => {
  const map: Record<string, DeliveryAction[]> = { WAIT_LOAD:['START_LOADING','CANCEL'], LOADING:['COMPLETE_LOADING','CANCEL'], WAIT_DEPARTURE:['DEPART','REOPEN_LOADING','CANCEL'], DELIVERING:['FINISH'] }
  return (map[task.value?.status || ''] || []).map(action => ({ action, label: actionLabel(action) }))
})
let loadSequence = 0
async function loadDetail() {
  const id = String(route.query.id || ''), sequence = ++loadSequence
  if (!id) { loadError.value = '缺少任务编号，请返回列表重新选择'; return }
  loading.value = true; loadError.value = ''
  try {
    const response = await getDeliveryTaskDetail(id)
    if (sequence !== loadSequence) return
    task.value = response.data.task; loadDetails.value = response.data.load_details || []
    operations.value = response.data.operations || []; routeData.value = response.data.route_cache || null
  } catch (error: any) { if (sequence === loadSequence) loadError.value = String(error?.response?.data?.detail || '加载任务失败，请刷新重试') }
  finally { if (sequence === loadSequence) loading.value = false }
}
const editDialogVisible = ref(false)
const editForm = ref<DeliveryForm>({ carrier_type:'', driver_id:'', driver_display:'', logistics_company_id:'', logistics_display:'', vehicle_id:'', vehicle_display:'', plan_departure_time:'', origin_address:'', remark:'' })
let editVersion = 0
function openEditDialog() {
  const row = task.value; if (!row) return
  editVersion = row.version_no
  editForm.value = { carrier_type:row.carrier_type === 'UNASSIGNED' ? '' : row.carrier_type, driver_id:row.driver_id || '', driver_display:row.driver_name || '', logistics_company_id:row.logistics_company_id || '', logistics_display:row.logistics_company_name || '', vehicle_id:row.vehicle_id || '', vehicle_display:[row.license_plate,row.vehicle_name].filter(Boolean).join(' '), plan_departure_time:row.plan_departure_time?.replace('T',' ') || '', origin_address:row.origin_address || '', remark:row.remark || '' }
  editDialogVisible.value = true
}
async function saveEdit() {
  if (!task.value || busy.value) return
  const value = editForm.value
  if (value.carrier_type === 'PERSONAL_DRIVER' && !value.driver_id) { ElMessage.warning('请选择司机'); return }
  if (value.carrier_type === 'LOGISTICS_COMPANY' && !value.logistics_company_id) { ElMessage.warning('请选择物流公司'); return }
  busy.value = true
  try { await updateDeliveryTask({ delivery_task_id:task.value.delivery_task_id, expected_version:editVersion, carrier_type:value.carrier_type || 'UNASSIGNED', driver_id:value.driver_id || undefined, logistics_company_id:value.logistics_company_id || undefined, vehicle_id:value.carrier_type === 'LOGISTICS_COMPANY' ? undefined : value.vehicle_id, plan_departure_time:value.plan_departure_time || '', origin_address:value.origin_address, remark:value.remark }); editDialogVisible.value = false; ElMessage.success('任务资料已保存'); await loadDetail() }
  catch (error: any) { if (error?.response?.data?.detail) showErrorDialog(error.response.data.detail) }
  finally { busy.value = false }
}
const operationDialogVisible = ref(false), pendingAction = ref<DeliveryAction>('CANCEL')
const pendingDetail = ref<DeliveryLoadDetailItem | undefined>(), reason = ref(''), waybill = ref(''), unloadConfirmed = ref(false)
const reasonActions: DeliveryAction[] = ['CANCEL','REOPEN_LOADING','FINISH','UNCONFIRM_LOAD','DETACH_ORDER','SET_WAYBILL']
let operationVersion = 0
async function run(action: DeliveryAction, detail?: DeliveryLoadDetailItem) {
  if (!task.value || busy.value) return
  const originalTaskId = task.value.delivery_task_id
  operationVersion = task.value.version_no
  if (reasonActions.includes(action)) { pendingAction.value = action; pendingDetail.value = detail; reason.value = ''; waybill.value = detail?.carrier_waybill_no || ''; unloadConfirmed.value = false; operationDialogVisible.value = true; return }
  try {
    await confirmAction(`${actionLabel(action)}${detail ? `：${detail.sales_order_no}` : ''}？`, '配送任务', { confirmButtonText:'确认', type:'warning' })
    if (task.value?.delivery_task_id === originalTaskId) await execute(action, detail, {}, operationVersion)
  } catch {}
}
async function submitOperation() {
  if (pendingAction.value === 'SET_WAYBILL' ? !waybill.value.trim() : !reason.value.trim()) { ElMessage.warning('请填写完整操作信息'); return }
  if (pendingAction.value === 'CANCEL' && confirmedCount.value && !unloadConfirmed.value) { ElMessage.warning('请先核实并确认卸货'); return }
  const success = await execute(pendingAction.value, pendingDetail.value, { reason:reason.value.trim() || undefined, carrier_waybill_no:waybill.value.trim() || undefined, unload_confirmed:unloadConfirmed.value }, operationVersion)
  if (success) operationDialogVisible.value = false
}
// 同一未完成请求保留 request_id；网络超时重试不会重复执行。
let retryPayload: DeliveryOperationPayload | undefined
async function execute(action: DeliveryAction, detail?: DeliveryLoadDetailItem, extra: Partial<DeliveryOperationPayload> = {}, version = task.value?.version_no) {
  if (!task.value || busy.value || version === undefined) return false
  const base = { delivery_task_id:task.value.delivery_task_id, expected_version:version, action, delivery_load_detail_id:detail?.delivery_load_detail_id, ...extra }
  const { request_id: _previousId, ...previous } = retryPayload || {} as DeliveryOperationPayload
  const payload = JSON.stringify(previous) === JSON.stringify(base) ? retryPayload! : { ...base, request_id:crypto.randomUUID() }
  busy.value = true
  try { await operateDeliveryTask(payload); retryPayload = undefined; ElMessage.success(`${actionLabel(action)}成功`); await loadDetail(); return true }
  catch (error: any) {
    retryPayload = error?.response ? undefined : payload
    const message = error?.response?.data?.detail || '请求未确认，请保持当前操作重试；重复提交不会重复执行'
    showErrorDialog(typeof message === 'string' ? message : JSON.stringify(message))
    if (error?.response?.status === 409) await loadDetail()
    return false
  } finally { busy.value = false }
}
async function attachOrders(rows: DeliveryEligibleOrder[]) { await execute('ATTACH_ORDERS', undefined, { sales_order_ids:rows.map(row => row.sales_order_id) }) }
function formatDistance(value: string | number | null | undefined) { const n = Number(value); return value == null || !Number.isFinite(n) ? '-' : n >= 1000 ? `${(n/1000).toFixed(1)} km` : `${Math.round(n)} m` }
function formatDuration(value: string | number | null | undefined) { const n = Number(value); return value == null || !Number.isFinite(n) ? '-' : n >= 3600 ? `${Math.floor(n/3600)}小时${Math.floor(n%3600/60)}分钟` : `${Math.max(1,Math.floor(n/60))}分钟` }
async function handleViewRoute() { if (!task.value) return; const id=task.value.delivery_task_id; routeLoading.value=true; routeError.value=''; try { const response=await getDrivingRoute(id); if (task.value?.delivery_task_id===id) routeData.value=response.data } catch(error:any) { routeError.value=String(error?.response?.data?.detail || '路线规划失败') } finally { routeLoading.value=false } }
function handleCopyNavUri(index:number) { const uri=navigationUris.value[index]?.uri; if (!uri) return; void navigator.clipboard?.writeText(uri).catch(() => {}); window.open(uri,'_blank','noopener') }
onMounted(loadDetail)
let firstActivation=true
onActivated(() => { if(firstActivation) { firstActivation=false; return } void loadDetail() })
watch(() => route.query.id, () => { task.value=null; loadDetails.value=[]; operations.value=[]; routeData.value=null; retryPayload=undefined; editDialogVisible.value=false; operationDialogVisible.value=false; void loadDetail() })
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
.task-actions { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; }.task-actions :deep(.el-button + .el-button) { margin-left:0; }.source-products { padding:16px 24px; }.load-hint { margin-bottom:16px; }.operation-form { margin-top:16px; }
@media(max-width:800px) { .detail-header { align-items:flex-start; flex-direction:column; gap:12px; } }
</style>
