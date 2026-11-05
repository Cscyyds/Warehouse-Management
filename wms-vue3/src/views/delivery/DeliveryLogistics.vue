<template>
  <ListTemplate
    title="物流单号管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    :columns="columns"
    :table-data="tableData"
    pagination-mode="server"
    :show-index="true"
    :show-add="true"
    @add="openCreateDialog"
    @page-change="loadData"
    @sort-change="handleSortChange"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="销售订单号">
          <el-input v-model="searchForm.sales_order_no" clearable style="width:160px" />
        </el-form-item>
        <el-form-item label="系统物流单号">
          <el-input v-model="searchForm.logistics_no" clearable style="width:160px" />
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="searchForm.customer_name" clearable style="width:130px" />
        </el-form-item>
        <el-form-item label="承运类型">
          <el-select v-model="searchForm.carrier_type" clearable placeholder="全部" style="width:120px">
            <el-option label="未分配" value="UNASSIGNED" />
            <el-option label="个人司机" value="PERSONAL_DRIVER" />
            <el-option label="物流公司" value="LOGISTICS_COMPANY" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" clearable placeholder="全部" style="width:120px">
            <el-option label="待绑定" value="PENDING_BIND" />
            <el-option label="已绑定" value="ACTIVE" />
            <el-option label="已分配" value="ASSIGNED" />
            <el-option label="已完成" value="COMPLETED" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>

    <template #col-sales_order_no="{ row }">
      <span v-if="row.sales_order_count && row.sales_order_count > 1">
        {{ row.sales_order_nos?.[0] }} 等 {{ row.sales_order_count }} 个订单
      </span>
      <span v-else>{{ row.sales_order_no || row.sales_order_nos?.[0] || '-' }}</span>
    </template>
    <template #col-carrier_type="{ row }">
      <el-tag :type="carrierTagType(row.carrier_type)" size="small">{{ carrierLabel(row.carrier_type) }}</el-tag>
    </template>
    <template #col-status="{ row }">
      <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
    </template>
    <template #col-carrier_info="{ row }">
      <span v-if="row.carrier_type === 'PERSONAL_DRIVER'">{{ row.driver_name }}{{ row.driver_phone ? `（${row.driver_phone}）` : '' }}</span>
      <span v-else-if="row.carrier_type === 'LOGISTICS_COMPANY'">{{ row.logistics_company_name }}</span>
      <span v-else class="text-tertiary">-</span>
    </template>
    <template #col-actions="{ row }">
      <el-button v-perm="'GET /api/v1/tenant-delivery-logistics/detail'" link type="primary" size="small" @click="handleDetail(row)">详情</el-button>
      <el-button
        v-if="canBind(row.status)"
        v-perm="'POST /api/v1/tenant-delivery-logistics/bind-carrier'"
        link type="success" size="small"
        @click="openBindDialog(row)"
      >{{ row.carrier_type === 'UNASSIGNED' ? '绑定承运' : '调整承运' }}</el-button>
      <el-button
        v-if="canCancel(row.status)"
        v-perm="'POST /api/v1/tenant-delivery-logistics/cancel'"
        link type="danger" size="small"
        @click="handleCancel(row)"
      >取消</el-button>
    </template>
  </ListTemplate>

  <!-- 详情抽屉 -->
  <el-drawer v-model="detailVisible" title="物流记录详情" size="640px" destroy-on-close>
    <template v-if="detailRow">
      <el-descriptions :column="1" border size="default">
        <el-descriptions-item label="系统物流单号">{{ detailRow.logistics_no }}</el-descriptions-item>
        <el-descriptions-item label="承运类型">
          <el-tag :type="carrierTagType(detailRow.carrier_type)" size="small">{{ carrierLabel(detailRow.carrier_type) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="司机/物流">
          <span v-if="detailRow.carrier_type === 'PERSONAL_DRIVER'">{{ detailRow.driver_name }}（{{ detailRow.driver_phone }}）</span>
          <span v-else-if="detailRow.carrier_type === 'LOGISTICS_COMPANY'">{{ detailRow.logistics_company_name }}</span>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="第三方物流单号">{{ detailRow.carrier_waybill_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="物流状态">
          <el-tag :type="statusTagType(detailRow.status)" size="small">{{ statusLabel(detailRow.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建人">{{ detailRow.created_by_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detailRow.created_at }}</el-descriptions-item>
      </el-descriptions>

      <div style="margin-top:16px">
        <div style="font-weight:500;margin-bottom:8px">装货明细（{{ detailLoadDetails.length }}）</div>
        <el-table :data="detailLoadDetails" border size="small" max-height="400">
          <el-table-column prop="sales_order_no" label="销售订单号" min-width="150" />
          <el-table-column prop="customer_name" label="客户" min-width="120" />
          <el-table-column prop="delivery_address" label="送货地址" min-width="170" show-overflow-tooltip />
          <el-table-column prop="delivery_quantity" label="出库数量" width="120" align="right" />
          <el-table-column prop="status" label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="loadStatusTagType(row.status)" size="small">{{ loadStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </el-drawer>

  <!-- 绑定/调整承运方弹窗 -->
  <el-dialog
    v-model="bindDialogVisible"
    :title="bindForm.carrier_type === 'UNASSIGNED' ? '绑定承运方' : '调整承运方'"
    width="500px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="bindFormRef" :model="bindForm" :rules="bindRules" label-width="110px" size="default">
      <el-form-item label="承运类型" prop="carrier_type">
        <el-select v-model="bindForm.carrier_type" placeholder="请选择" style="width:100%" @change="onCarrierTypeChange">
          <el-option label="个人司机" value="PERSONAL_DRIVER" />
          <el-option label="物流公司" value="LOGISTICS_COMPANY" />
        </el-select>
      </el-form-item>

      <!-- 个人司机 -->
      <template v-if="bindForm.carrier_type === 'PERSONAL_DRIVER'">
        <el-form-item label="选择司机" prop="driver_id">
          <div class="input-suffix-wrapper">
            <el-input v-model="bindForm.driver_display" placeholder="点击选择司机档案" readonly style="width:100%" @click="openDriverPicker('bind')">
              <template #suffix>
                <el-icon class="input-suffix-icon" @click.stop="openDriverPicker('bind')"><Search /></el-icon>
              </template>
            </el-input>
          </div>
        </el-form-item>
      </template>

      <!-- 物流公司 -->
      <template v-if="bindForm.carrier_type === 'LOGISTICS_COMPANY'">
        <el-form-item label="物流公司" prop="logistics_company_id">
          <el-select
            v-model="bindForm.logistics_company_id"
            filterable
            remote
            :remote-method="searchLogisticsCompany"
            placeholder="输入公司名称搜索"
            style="width:100%"
            @change="onLogisticsCompanyChange"
          >
            <el-option
              v-for="c in logisticsCompanyOptions"
              :key="c.logistics_company_id"
              :label="c.company_name"
              :value="c.logistics_company_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="第三方物流单号" prop="carrier_waybill_no">
          <el-input v-model="bindForm.carrier_waybill_no" placeholder="请输入物流公司运单号" maxlength="64" />
        </el-form-item>
      </template>

      <el-form-item label="备注">
        <el-input v-model="bindForm.remark" placeholder="选填" maxlength="255" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="bindDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="bindSubmitting" @click="handleBindSubmit">确认绑定</el-button>
    </template>
  </el-dialog>

  <!-- 新增物流单弹窗 -->
  <el-dialog
    v-model="createDialogVisible"
    title="新增物流单"
    width="760px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="create-section-title">选择销售订单（可多选）</div>
    <el-form inline size="default" style="margin-bottom:8px">
      <el-form-item>
        <el-input v-model="eligibleKeyword" placeholder="订单号/客户名称" clearable style="width:220px" @keyup.enter="loadEligibleOrders" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadEligibleOrders">查询</el-button>
      </el-form-item>
      <el-form-item>
        <span class="text-tertiary">已选 {{ selectedOrders.length }} 个订单</span>
      </el-form-item>
    </el-form>
    <el-table :data="eligibleOrders" border size="small" max-height="280" @selection-change="handleEligibleSelection">
      <el-table-column type="selection" width="44" />
      <el-table-column prop="sales_order_no" label="销售订单号" min-width="150" />
      <el-table-column prop="customer_name" label="客户" min-width="120" />
      <el-table-column prop="receive_address" label="收货地址" min-width="170" show-overflow-tooltip />
      <el-table-column prop="actual_out_qty" label="出库数量" width="120" align="right" />
    </el-table>

    <div class="create-section-title" style="margin-top:16px">承运方</div>
    <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="120px" size="default">
      <el-form-item label="承运类型" prop="carrier_type">
        <el-radio-group v-model="createForm.carrier_type" @change="onCreateCarrierChange">
          <el-radio value="PERSONAL_DRIVER">个人司机</el-radio>
          <el-radio value="LOGISTICS_COMPANY">物流公司</el-radio>
        </el-radio-group>
      </el-form-item>

      <template v-if="createForm.carrier_type === 'PERSONAL_DRIVER'">
        <el-form-item label="选择司机" prop="driver_id">
          <div class="input-suffix-wrapper">
            <el-input v-model="createForm.driver_display" placeholder="点击选择司机档案" readonly @click="openDriverPicker('create')">
              <template #suffix>
                <el-icon class="input-suffix-icon" @click.stop="openDriverPicker('create')"><Search /></el-icon>
              </template>
            </el-input>
          </div>
        </el-form-item>
      </template>

      <template v-if="createForm.carrier_type === 'LOGISTICS_COMPANY'">
        <el-form-item label="物流公司" prop="logistics_company_id">
          <el-select v-model="createForm.logistics_company_id" filterable remote :remote-method="searchLogisticsCompany" placeholder="输入公司名称搜索" style="width:100%" @change="onCreateLogisticsCompanyChange">
            <el-option v-for="c in logisticsCompanyOptions" :key="c.logistics_company_id" :label="c.company_name" :value="c.logistics_company_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="第三方物流单号" prop="carrier_waybill_no">
          <el-input v-model="createForm.carrier_waybill_no" placeholder="请输入第三方物流公司单号" maxlength="64" />
        </el-form-item>
      </template>

      <el-form-item label="备注">
        <el-input v-model="createForm.remark" placeholder="选填" maxlength="255" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="createDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="createSubmitting" @click="handleCreateSubmit">确认创建</el-button>
    </template>
  </el-dialog>

  <!-- 司机档案选择弹窗 -->
  <el-dialog v-model="driverPickerVisible" title="选择司机" width="560px" :close-on-click-modal="false" destroy-on-close>
    <el-form inline size="default" style="margin-bottom:12px">
      <el-form-item>
        <el-input v-model="driverPickerKeyword" placeholder="姓名/电话" clearable style="width:200px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadDriverPickerOptions">查询</el-button>
      </el-form-item>
    </el-form>
    <!-- 列用 min-width 而非固定 width：固定宽度小于弹窗内容区时右侧会留出未占满的空白 -->
    <!-- 列用 min-width 而非固定 width：固定宽度小于弹窗内容区时右侧会留出未占满的空白。
         勾选框为单选语义（勾新行自动取消旧行）：driver_id 为单值字段，后端接口只收单个司机 -->
    <el-table
      ref="driverPickerTableRef"
      border
      :data="driverPickerOptions"
      style="width:100%"
      max-height="300"
      @select="handleDriverPickerSelect"
      @select-all="handleDriverPickerSelectAll"
      @row-click="handleDriverPickerRowClick"
    >
      <el-table-column type="selection" width="44" align="center" />
      <el-table-column prop="driver_name" label="姓名" min-width="140" show-overflow-tooltip />
      <el-table-column prop="driver_phone" label="电话" min-width="170" show-overflow-tooltip />
      <el-table-column prop="driver_type" label="类型" min-width="120" align="center">
        <template #default="{ row }">{{ row.driver_type === 'INTERNAL_EMPLOYEE' ? '内部员工' : '外部个体' }}</template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="driverPickerVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmDriverPicker">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import type { FormInstance, FormRules, TableInstance } from 'element-plus'
import {
  searchLogisticsRecords, bindCarrier, cancelLogisticsRecord,
  getLogisticsRecordDetail, createLogistics, getEligibleSalesOrders,
  getDriverOptions, getLogisticsCompanyList,
  type LogisticsRecordItem, type DriverOptionItem,
  type LogisticsLoadDetailItem, type EligibleSalesOrderItem,
} from '@/api'
import type { LogisticsCompanyItem } from '@/api'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const tableData = ref<LogisticsRecordItem[]>([])
const searchForm = reactive({ sales_order_no: '', logistics_no: '', customer_name: '', carrier_type: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const loading = ref(false)

const columns: Column[] = [
  { prop: 'sales_order_no', label: '销售订单号', minWidth: 160 },
  { prop: 'logistics_no', label: '系统物流单号', minWidth: 160 },
  { prop: 'carrier_type', label: '承运类型', width: 110, align: 'center' },
  { prop: 'carrier_info', label: '司机/物流公司', minWidth: 160 },
  { prop: 'carrier_waybill_no', label: '第三方物流单号', minWidth: 140 },
  { prop: 'status', label: '状态', width: 100, align: 'center' },
  { prop: 'created_by_name', label: '创建人', width: 100 },
  { prop: 'created_at', label: '创建时间', width: 170, sortable: true },
]

const CARRIER_MAP: Record<string, { label: string; type: string }> = {
  UNASSIGNED: { label: '未分配', type: 'info' },
  PERSONAL_DRIVER: { label: '个人司机', type: 'success' },
  LOGISTICS_COMPANY: { label: '物流公司', type: 'primary' },
}
const STATUS_MAP: Record<string, { label: string; type: string }> = {
  PENDING_BIND: { label: '待绑定', type: 'warning' },
  ACTIVE: { label: '已绑定', type: 'success' },
  ASSIGNED: { label: '已分配', type: 'primary' },
  COMPLETED: { label: '已完成', type: 'info' },
  CANCELLED: { label: '已取消', type: 'danger' },
  MIGRATION_PENDING: { label: '待迁移', type: 'info' },
}
function carrierLabel(v: string) { return CARRIER_MAP[v]?.label || v }
function carrierTagType(v: string) { return (CARRIER_MAP[v]?.type || '') as any }
function statusLabel(v: string) { return STATUS_MAP[v]?.label || v }
function statusTagType(v: string) { return (STATUS_MAP[v]?.type || '') as any }
function canBind(s: string) { return ['PENDING_BIND', 'ACTIVE'].includes(s) }
function canCancel(s: string) { return ['PENDING_BIND', 'ACTIVE', 'MIGRATION_PENDING'].includes(s) }

async function loadData() {
  loading.value = true
  try {
    const res = await searchLogisticsRecords({
      page: pagination.page,
      page_size: pagination.pageSize,
      sales_order_no: searchForm.sales_order_no || undefined,
      logistics_no: searchForm.logistics_no || undefined,
      customer_name: searchForm.customer_name || undefined,
      carrier_type: searchForm.carrier_type || undefined,
      status: searchForm.status || undefined,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
    })
    tableData.value = res.data.delivery_logistics
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { sales_order_no: '', logistics_no: '', customer_name: '', carrier_type: '', status: '' })
  handleSearch()
}

// ── 详情 ──────────────────────────────────────────────
const detailVisible = ref(false)
const detailRow = ref<LogisticsRecordItem | null>(null)
const detailLoadDetails = ref<LogisticsLoadDetailItem[]>([])

const LOAD_STATUS_MAP: Record<string, { label: string; type: string }> = {
  PENDING: { label: '待分配', type: 'warning' },
  LOADED: { label: '已装车', type: 'primary' },
  CANCELLED: { label: '已取消', type: 'danger' },
}
function loadStatusLabel(v: string) { return LOAD_STATUS_MAP[v]?.label || v }
function loadStatusTagType(v: string) { return (LOAD_STATUS_MAP[v]?.type || '') as any }

async function handleDetail(row: LogisticsRecordItem) {
  detailRow.value = row
  detailLoadDetails.value = []
  detailVisible.value = true
  try {
    const res = await getLogisticsRecordDetail(row.logistics_barcode_id)
    detailRow.value = res.data.logistics
    detailLoadDetails.value = res.data.loadDetails || []
  } catch (e: any) {
    if (e?.response?.data?.detail) ElMessage.error(e.response.data.detail)
  }
}

// ── 新增物流单 ────────────────────────────────────────
const createDialogVisible = ref(false)
const createSubmitting = ref(false)
const createFormRef = ref<FormInstance>()
const eligibleKeyword = ref('')
const eligibleOrders = ref<EligibleSalesOrderItem[]>([])
const selectedOrders = ref<EligibleSalesOrderItem[]>([])
const createForm = reactive({
  carrier_type: 'PERSONAL_DRIVER',
  driver_id: '',
  driver_display: '',
  logistics_company_id: '',
  carrier_waybill_no: '',
  remark: '',
})

const createRules: FormRules = {
  carrier_type: [{ required: true, message: '请选择承运类型', trigger: 'change' }],
  driver_id: [{
    validator: (_r: any, _v: any, cb: any) => {
      if (createForm.carrier_type === 'PERSONAL_DRIVER' && !createForm.driver_id) cb(new Error('请选择司机'))
      else cb()
    }, trigger: 'change'
  }],
  logistics_company_id: [{
    validator: (_r: any, _v: any, cb: any) => {
      if (createForm.carrier_type === 'LOGISTICS_COMPANY' && !createForm.logistics_company_id) cb(new Error('请选择物流公司'))
      else cb()
    }, trigger: 'change'
  }],
  carrier_waybill_no: [{
    validator: (_r: any, _v: any, cb: any) => {
      if (createForm.carrier_type === 'LOGISTICS_COMPANY' && !createForm.carrier_waybill_no.trim()) cb(new Error('请输入第三方物流单号'))
      else cb()
    }, trigger: 'blur'
  }],
}

function openCreateDialog() {
  Object.assign(createForm, {
    carrier_type: 'PERSONAL_DRIVER',
    driver_id: '',
    driver_display: '',
    logistics_company_id: '',
    carrier_waybill_no: '',
    remark: '',
  })
  selectedOrders.value = []
  eligibleOrders.value = []
  eligibleKeyword.value = ''
  createDialogVisible.value = true
  loadEligibleOrders()
}

async function loadEligibleOrders() {
  try {
    const res = await getEligibleSalesOrders({
      page: 1,
      page_size: 100,
      sales_order_no: eligibleKeyword.value || undefined,
      customer_name: eligibleKeyword.value || undefined,
    })
    eligibleOrders.value = res.data.items
  } catch {
    eligibleOrders.value = []
  }
}

function handleEligibleSelection(rows: EligibleSalesOrderItem[]) { selectedOrders.value = rows }

function onCreateCarrierChange() {
  createForm.driver_id = ''
  createForm.driver_display = ''
  createForm.logistics_company_id = ''
  createForm.carrier_waybill_no = ''
  createFormRef.value?.clearValidate()
}

function onCreateLogisticsCompanyChange() { createFormRef.value?.clearValidate('logistics_company_id') }

async function handleCreateSubmit() {
  if (selectedOrders.value.length === 0) {
    ElMessage.warning('请至少选择一张销售订单')
    return
  }
  await createFormRef.value?.validate()
  createSubmitting.value = true
  try {
    await createLogistics({
      sales_order_nos: selectedOrders.value.map(o => o.sales_order_no),
      carrier_type: createForm.carrier_type,
      driver_id: createForm.carrier_type === 'PERSONAL_DRIVER' ? createForm.driver_id : null,
      logistics_company_id: createForm.carrier_type === 'LOGISTICS_COMPANY' ? createForm.logistics_company_id : null,
      carrier_waybill_no: createForm.carrier_type === 'LOGISTICS_COMPANY' ? createForm.carrier_waybill_no : null,
      remark: createForm.remark || null,
    })
    ElMessage.success('物流单创建成功')
    createDialogVisible.value = false
    loadData()
  } catch (e: any) {
    if (e?.response?.data?.detail) ElMessage.error(e.response.data.detail)
  } finally {
    createSubmitting.value = false
  }
}

// ── 取消 ──────────────────────────────────────────────
async function handleCancel(row: LogisticsRecordItem) {
  try {
    await ElMessageBox.confirm(`确认取消物流记录「${row.logistics_no}」？`, '提示', { confirmButtonText: '确认取消', type: 'warning' })
    await cancelLogisticsRecord({ logistics_barcode_id: row.logistics_barcode_id, version_no: row.version_no })
    ElMessage.success('已取消')
    loadData()
  } catch (e: any) {
    if (e?.response?.data?.detail) ElMessage.error(e.response.data.detail)
  }
}

// ── 绑定承运方 ────────────────────────────────────────
const bindDialogVisible = ref(false)
const bindFormRef = ref<FormInstance>()
const bindSubmitting = ref(false)
const bindForm = reactive({
  logistics_barcode_id: '',
  version_no: 0,
  carrier_type: '',
  driver_id: '',
  driver_display: '',
  logistics_company_id: '',
  carrier_waybill_no: '',
  remark: '',
})

const bindRules: FormRules = {
  carrier_type: [{ required: true, message: '请选择承运类型', trigger: 'change' }],
  driver_id: [{
    validator: (_r: any, _v: any, cb: any) => {
      if (bindForm.carrier_type === 'PERSONAL_DRIVER' && !bindForm.driver_id) cb(new Error('请选择司机'))
      else cb()
    }, trigger: 'change'
  }],
  logistics_company_id: [{
    validator: (_r: any, _v: any, cb: any) => {
      if (bindForm.carrier_type === 'LOGISTICS_COMPANY' && !bindForm.logistics_company_id) cb(new Error('请选择物流公司'))
      else cb()
    }, trigger: 'change'
  }],
  carrier_waybill_no: [{
    validator: (_r: any, _v: any, cb: any) => {
      if (bindForm.carrier_type === 'LOGISTICS_COMPANY' && !bindForm.carrier_waybill_no.trim()) cb(new Error('请输入外部运单号'))
      else cb()
    }, trigger: 'blur'
  }],
}

function openBindDialog(row: LogisticsRecordItem) {
  Object.assign(bindForm, {
    logistics_barcode_id: row.logistics_barcode_id,
    version_no: row.version_no,
    carrier_type: row.carrier_type === 'UNASSIGNED' ? '' : row.carrier_type,
    driver_id: row.driver_id || '',
    driver_display: row.driver_id ? `${row.driver_name}（${row.driver_phone}）` : '',
    logistics_company_id: row.logistics_company_id || '',
    carrier_waybill_no: row.carrier_waybill_no || '',
    remark: '',
  })
  if (bindForm.logistics_company_id) {
    logisticsCompanyOptions.value = [{ logistics_company_id: row.logistics_company_id!, company_name: row.logistics_company_name!, sort_no: 0, status: 1, remark: null }]
  }
  bindDialogVisible.value = true
}

function onCarrierTypeChange() {
  bindForm.driver_id = ''
  bindForm.driver_display = ''
  bindForm.logistics_company_id = ''
  bindForm.carrier_waybill_no = ''
  bindFormRef.value?.clearValidate()
}

async function handleBindSubmit() {
  await bindFormRef.value?.validate()
  bindSubmitting.value = true
  try {
    await bindCarrier({
      logistics_barcode_id: bindForm.logistics_barcode_id,
      version_no: bindForm.version_no,
      carrier_type: bindForm.carrier_type,
      driver_id: bindForm.carrier_type === 'PERSONAL_DRIVER' ? bindForm.driver_id : undefined,
      logistics_company_id: bindForm.carrier_type === 'LOGISTICS_COMPANY' ? bindForm.logistics_company_id : undefined,
      carrier_waybill_no: bindForm.carrier_type === 'LOGISTICS_COMPANY' ? bindForm.carrier_waybill_no : undefined,
      remark: bindForm.remark || undefined,
    })
    ElMessage.success('绑定成功')
    bindDialogVisible.value = false
    loadData()
  } catch (e: any) {
    if (e?.response?.data?.detail) ElMessage.error(e.response.data.detail)
  } finally {
    bindSubmitting.value = false
  }
}

// ── 司机选择器 ────────────────────────────────────────
const driverPickerVisible = ref(false)
const driverPickerTarget = ref<'bind' | 'create'>('bind')
const driverPickerKeyword = ref('')
const driverPickerOptions = ref<DriverOptionItem[]>([])
const driverPickerTableRef = ref<TableInstance>()
let selectedDriverOption: DriverOptionItem | null = null

function openDriverPicker(target: 'bind' | 'create') {
  driverPickerTarget.value = target
  driverPickerKeyword.value = ''
  selectedDriverOption = null
  driverPickerOptions.value = []
  driverPickerVisible.value = true
  loadDriverPickerOptions()
}

async function loadDriverPickerOptions() {
  try {
    const res = await getDriverOptions({ keyword: driverPickerKeyword.value || undefined, status: 'ACTIVE', limit: 50 })
    driverPickerOptions.value = res.data.options
  } catch { driverPickerOptions.value = [] }
}

function handleDriverPickerSelect(selection: DriverOptionItem[], row: DriverOptionItem) {
  // 单选语义：勾选新行时取消其它行的勾选
  const table = driverPickerTableRef.value
  const checked = selection.includes(row)
  if (table) {
    table.clearSelection()
    if (checked) table.toggleRowSelection(row, true)
  }
  selectedDriverOption = checked ? row : null
}

function handleDriverPickerSelectAll() {
  // 表头全选框与单司机语义冲突：点击后清空并忽略
  const table = driverPickerTableRef.value
  table?.clearSelection()
  selectedDriverOption = null
}

function handleDriverPickerRowClick(row: DriverOptionItem) {
  // 保留旧行为：点击行即选中该行
  const table = driverPickerTableRef.value
  if (!table) return
  table.clearSelection()
  table.toggleRowSelection(row, true)
  selectedDriverOption = row
}
function confirmDriverPicker() {
  if (selectedDriverOption) {
    const display = `${selectedDriverOption.driver_name}（${selectedDriverOption.driver_phone}）`
    if (driverPickerTarget.value === 'create') {
      createForm.driver_id = selectedDriverOption.driver_id
      createForm.driver_display = display
      createFormRef.value?.clearValidate('driver_id')
    } else {
      bindForm.driver_id = selectedDriverOption.driver_id
      bindForm.driver_display = display
      bindFormRef.value?.clearValidate('driver_id')
    }
  }
  driverPickerVisible.value = false
}

// ── 物流公司选择器 ────────────────────────────────────
const logisticsCompanyOptions = ref<LogisticsCompanyItem[]>([])

async function searchLogisticsCompany(keyword: string) {
  if (!keyword) return
  try {
    const res = await getLogisticsCompanyList({ page: 1 })
    logisticsCompanyOptions.value = res.data.logistics_company.filter(c =>
      c.company_name.includes(keyword) && c.status === 1
    )
  } catch { logisticsCompanyOptions.value = [] }
}

function onLogisticsCompanyChange(_val: string) {
  bindFormRef.value?.clearValidate('logistics_company_id')
}

onMounted(() => { loadData() })
</script>

<style scoped>
.text-tertiary { color: var(--text-tertiary); }
.input-suffix-wrapper { width: 100%; }
.input-suffix-icon { cursor: pointer; color: var(--text-tertiary); }
.input-suffix-icon:hover { color: var(--primary); }
.create-section-title { font-weight: 500; font-size: 14px; margin-bottom: 8px; }
</style>
