<template>
  <ListTemplate
    :title="scene.title"
    :loading="loading"
    :show-add="scene.showAdd"
    :show-import="scene.showImport"
    :show-export="scene.showExport"
    :import-columns="scene.columns"
    :export-columns="scene.columns"
    :export-data="tableData"
    :export-file-name="scene.title"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
    @import="handleImport"
    @sort-change="handleSortChange"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item v-for="filter in scene.filters" :key="filter.key" :label="filter.label">
          <el-select
            v-if="filter.type === 'select'"
            v-model="searchForm[filter.key]"
            placeholder="请选择"
            clearable
            style="width: 120px"
          >
            <el-option
              v-for="option in filter.options || []"
              :key="option"
              :label="option"
              :value="option"
            />
          </el-select>
          <el-date-picker
            v-else-if="filter.type === 'date'"
            v-model="searchForm[filter.key]"
            type="date"
            placeholder="请选择"
            clearable
            style="width: 140px"
          />
          <el-date-picker
            v-else-if="filter.type === 'daterange'"
            v-model="searchForm[filter.key]"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            clearable
            :shortcuts="orderDateRangeShortcuts"
            :disabled-date="disableFutureOrderDate"
            class="order-date-range-picker"
            popper-class="order-date-range-popper"
            style="width: 280px"
          />
          <el-input
            v-else
            v-model="searchForm[filter.key]"
            placeholder="请输入"
            clearable
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>

    <template #actions>
      <!-- 天心模式下本系统写接口被后端 403 封锁：给出原因，避免用户误以为功能丢失（文案与后端 403 detail 一致） -->
      <el-tag v-if="!canWrite" type="info" effect="plain" size="small" :title="TIANXIN_WRITE_BLOCKED_TIP">
        已由天心 ERP 接管，仅提供查询
      </el-tag>
      <!-- 按钮级权限：v-perm 绑接口端点，映射到 perm_code 后与当前用户权限比对（见 scene.permEndpoints） -->
      <!-- 写入口额外叠 canWrite 门：天心模式 + 单据族场景时隐藏（见 script 内 canWrite 说明） -->
      <el-button v-if="canWrite && scene.showAdd" v-perm="scene.permEndpoints?.add" type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>新增
      </el-button>
      <el-button v-if="canWrite && scene.importUrl" v-perm="scene.permEndpoints?.import" @click="openImport('upload')">
        <el-icon><Upload /></el-icon>批量导入
      </el-button>
      <el-button v-if="scene.importUrl" v-perm="`GET /api/v1/import-tasks/${type === 'order' ? 'purchase-order' : 'supplier'}/list`" @click="openImport('records')">
        导入记录
      </el-button>
      <!-- 批量打印暂未接入后端接口，暂时隐藏；接入后恢复下方按钮（原条件 v-if="scene.showPrint"） -->
      <!-- <el-button v-if="scene.showPrint" :disabled="selectedRows.length === 0" @click="handleBatchPrint">
        <el-icon><Printer /></el-icon>批量打印
      </el-button> -->
      <el-button v-if="canWrite && scene.showAudit" v-perm="scene.permEndpoints?.audit" :disabled="selectedRows.length === 0" @click="handleBatchAudit('已审核')">
        <el-icon><Check /></el-icon>审核
      </el-button>
      <el-button v-if="canWrite && scene.showAudit" v-perm="scene.permEndpoints?.audit" :disabled="selectedRows.length === 0" @click="handleBatchAudit('未审核')">
        <el-icon><Back /></el-icon>反审核
      </el-button>
      <el-button v-if="canWrite && scene.showPurchaseStatus" v-perm="scene.permEndpoints?.purchaseStatus" :disabled="selectedRows.length === 0" @click="handleBatchConfirmPurchaseStatus">
        确认采购
      </el-button>
      <!-- 批量一键生成采购入库单：一张采购订单对应一张入库单，逐张跳转新增页继承订单数据 -->
      <el-button v-if="canWrite && type === 'order'" v-perm="scene.permEndpoints?.generateInbound" :disabled="selectedRows.length === 0" type="primary" plain @click="handleBatchGenerateInbound">
        <el-icon><MagicStick /></el-icon>一键生成采购入库单
      </el-button>
      <el-button v-if="canWrite && type === 'inbound'" v-perm="scene.permEndpoints?.sendWarehouse" :disabled="selectedRows.length === 0" type="primary" @click="handleBatchSendWarehouse">
        <el-icon><Van /></el-icon>发送仓库
      </el-button>
      <el-button v-if="canWrite && type === 'return'" v-perm="scene.permEndpoints?.sendWarehouse" :disabled="selectedRows.length === 0" type="primary" @click="handleBatchSendReturnWarehouse">
        <el-icon><Van /></el-icon>发送仓库
      </el-button>
      <el-button v-if="canWrite && type === 'return'" v-perm="scene.permEndpoints?.cancelSend" :disabled="selectedRows.length === 0" type="warning" @click="handleBatchCancelSend">
        <el-icon><Back /></el-icon>撤销发送
      </el-button>
    </template>

    <template #table>
      <el-table
        :data="tableData"
        stripe
        size="default"
        style="width: 100%"
        row-class-name="table-row"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column v-if="scene.showSelection" type="selection" width="40" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column
          v-for="column in resolvedSceneColumns"
          :key="column.key"
          :prop="column.key"
          :column-key="column.sortKey || column.key"
          :label="column.label"
          :width="column.resolvedWidth"
          :min-width="column.resolvedMinWidth"
          :sortable="column.sortable ? 'custom' : false"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <!-- 单号 link 绑 detail（与操作列的 update 分开，无编辑权仍可查看） -->
            <span v-if="column.link && !isEmpty(row[column.key])" v-perm="scene.permEndpoints?.detail" class="cell-link" @click="handleEdit(row)">{{ formatDisplayValue(column.key, row[column.key]) }}</span>
            <el-tag v-else-if="column.tag" :type="getTagType(row[column.key], column.key)" size="small">
              {{ formatCell(row[column.key], column.enum) }}
            </el-tag>
            <span v-else-if="column.money" class="table-cell-text">{{ formatMoney(row[column.key]) }}</span>
            <span v-else class="table-cell-text" :class="{ 'cell-empty': isEmpty(column.enum ? (column.enum[String(row[column.key])] ?? row[column.key]) : row[column.key]) }">{{ column.enum ? (column.enum[String(row[column.key])] ?? formatDisplayValue(column.key, row[column.key])) : formatDisplayValue(column.key, row[column.key]) }}</span>
          </template>
        </el-table-column>
        <!-- 操作列：天心模式下单据族场景无任何行内写操作（编辑/删除 + 下拉项全是写），整列隐藏，
             避免留下空列或"点进去撞 403"的入口；查看明细仍走单号链接（只读态） -->
        <el-table-column v-if="canWrite && scene.showOperations" label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button v-perm="scene.permEndpoints?.update" link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button v-perm="scene.permEndpoints?.delete" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            <el-dropdown
              v-if="getVisibleRowActions(row).length"
              trigger="click"
              @command="(command: string) => handleRowCommand(command, row)"
            >
                <el-button link type="primary" size="small">更多</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                    v-for="action in getVisibleRowActions(row)"
                      :key="action.command"
                      :command="action.command"
                      :disabled="(action as any).disabled"
                    >
                      {{ action.label }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <!-- 仓库退回弹窗（入库单 / 退货单共用） -->
  <WarehouseReturnDialog
    v-model="returnDialog.visible"
    :title="returnDialog.title"
    :biz-type="returnDialog.bizType"
    :items="returnDialog.items"
    @confirm="handleWarehouseReturnConfirm"
  />

  <!-- 审核预览弹窗（采购订单专用） -->
  <AuditPreviewDialog
    v-model="auditPreviewDialog.visible"
    :loading="auditPreviewDialog.loading"
    :data="auditPreviewDialog.data"
    :order-count="auditPreviewDialog.orderCount"
    @confirm="handleAuditPreviewConfirm"
  />

  <!-- 供应商删除预览弹窗（仅 supplier 场景） -->
  <SupplierDeletePreviewDialog
    v-if="type === 'supplier'"
    v-model="supplierDeleteDialog.visible"
    :supplier="supplierDeleteDialog.target"
    @success="handleSupplierDeleteSuccess"
  />

  <!-- Excel 批量导入弹窗（配置了 importUrl 的场景） -->
  <BatchImportDialog
    v-if="scene.importUrl"
    v-model="importDialogVisible"
    :title="`批量导入${scene.title}`"
    :task-type="type === 'order' ? 'purchase-order' : 'supplier'"
    :initial-tab="importInitialTab"
    :template-url="sceneTemplateUrl"
    :template-name="scene.importTemplateName || ''"
    :import-fn="getSceneImportFn()"
    @success="handleImportSuccess"
  />
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Printer, Check, Van, Back, Upload, MagicStick } from '@element-plus/icons-vue'
import { z } from 'zod'
import ListTemplate from '@/views/common/ListTemplate.vue'
import BatchImportDialog from '@/views/common/BatchImportDialog.vue'
import WarehouseReturnDialog from './WarehouseReturnDialog.vue'
import AuditPreviewDialog from './AuditPreviewDialog.vue'
import SupplierDeletePreviewDialog from './SupplierDeletePreviewDialog.vue'
import { useTableSort } from '@/composables/useTableSort'
import { useAgentPage } from '@/composables/useAgentPage'
import {
  TIANXIN_WRITE_BLOCKED_TIP,
  isPurchaseSceneWriteBlocked,
  useTradeModeGate,
} from '@/composables/useTradeModeGate'
import { usePermissionStore } from '@/stores/permission'
import type { WmsAgentActionDefinition } from '@/agent/types'
import type { RequestConfig } from '@/utils/request'
import { formatTableDate, isTableDateField } from '@/utils/date'
import { global_opt_width } from '@/utils/data'
import { disableFutureOrderDate, orderDateRangeShortcuts } from '@/utils/orderDateRange'
import { importPurchaseOrders, importSuppliers } from '@/api'
import {
  auditPurchaseOrder,
  auditPurchaseReturn,
  unauditPurchaseReturn,
  previewPurchaseOrderAudit,
  updatePurchaseOrderStatus,
  cancelSendPurchaseInbound,
  cancelSendPurchaseReturn,
  createPurchaseOrder,
  createSupplier,
  createSupplierType,
  deletePurchaseInbound,
  deletePurchaseOrder,
  deletePurchaseReturn,
  deleteSupplier,
  deleteSupplierType,
  getPurchaseInboundDetail,
  getPendingReceiptItemList,
  getPurchaseInboundList,
  getPurchaseInboundItemList,
  getPurchaseOrderList,
  getPurchaseReturnDetail,
  getPurchaseReturnList,
  getPurchaseReturnItemList,
  getSupplierList,
  getSupplierBalanceSummary,
  searchSupplierBalanceSummary,
  getSupplierTypeList,
  searchPurchaseInbound,
  searchPurchaseInboundItems,
  searchPurchaseOrders,
  searchPurchaseReturn,
  searchPurchaseReturnItems,
  searchSupplier,
  searchSupplierType,
  updatePurchaseInboundWarehouseStatus,
  updatePurchaseReturnWarehouseStatus,
  warehouseReturnPurchaseInbound,
  warehouseReturnPurchaseReturn
} from '@/api'
import type { AuditPreviewItem, AuditPreviewAggregated, PendingReceiptItem } from '@/api'

type FilterType = 'input' | 'select' | 'date' | 'daterange'

interface FilterConfig {
  key: string
  label: string
  type?: FilterType
  options?: string[]
  /** 筛选默认值（仅 input/select 等非 daterange 类型） */
  defaultValue?: string
}

interface ColumnConfig {
  key: string
  label: string
  sortKey?: string
  width?: number
  minWidth?: number
  money?: boolean
  tag?: boolean
  sortable?: boolean
  /** 枚举映射：原始值 → 显示文本 */
  enum?: Record<string, string>
  /** 该列渲染为可点击链接，点击进入该行数据的详情/编辑页 */
  link?: boolean
}

interface ResolvedColumnConfig extends ColumnConfig {
  resolvedWidth?: string | number
  resolvedMinWidth?: string | number
}

interface SceneConfig {
  title: string
  addType?: string
  showAdd?: boolean
  showImport?: boolean
  /** 批量导入后端接口路径（存在时渲染"批量导入"按钮，走文件上传弹窗，代替内置 show-import） */
  importUrl?: string
  /** 批量导入示例模板文件名（英文，需已放置于 public/templates/ 下，用于 URL） */
  importTemplateFile?: string
  /** 批量导入示例模板显示名（中文，用于下载文件名与卡片展示） */
  importTemplateName?: string
  showExport?: boolean
  showPrint?: boolean
  showAudit?: boolean
  showSelection?: boolean
  showOperations?: boolean
  showPurchaseStatus?: boolean
  filters: FilterConfig[]
  columns: ColumnConfig[]
  fallbackData: Record<string, any>[]
  /** 业务 ID 字段名（编辑/删除使用，而非数据库主键 id） */
  idField?: string
  /** 按钮级权限绑定的接口端点（v-perm）；detail 与 update 分开，避免无编辑权连详情也看不了 */
  permEndpoints?: {
    add?: string
    detail?: string
    update?: string
    delete?: string
    audit?: string
    import?: string
    purchaseStatus?: string
    sendWarehouse?: string
    cancelSend?: string
    /** 批量一键生成采购入库单（order 场景专用，绑入库单创建端点） */
    generateInbound?: string
  }
  /** 搜索字段映射：前端 searchForm key → 后端字段名及是否数字类型 */
  searchFields?: { key: string; field: string; isNumber?: boolean; isRange?: boolean }[]
  load?: (params: Record<string, any>, config?: RequestConfig) => Promise<any>
  /** 专用搜索接口（search_field/search_value JSON 字符串格式） */
  search?: (params: Record<string, any>, config?: RequestConfig) => Promise<any>
  remove?: (id: string) => Promise<any>
  importCreate?: (row: Record<string, any>) => Promise<any>
  rowActions?: Array<{ command: string; label: string; endpoint?: string; disabled?: boolean }>
  /** 重置创建接口端点（存在时按 audit_status=2/3 且 is_recreated=0 渲染「重置创建」入口） */
  recreateEndpoint?: string
}

const props = defineProps<{ type: string }>()

const AUTO_COLUMN_MIN_WIDTH = 96
const MAX_AUTO_COLUMN_MIN_WIDTH = 320
const CELL_HORIZONTAL_PADDING = 32
const CONTENT_SAMPLE_LIMIT = 20

const router = useRouter()
const permissionStore = usePermissionStore()
const loading = ref(false)
const tableData = ref<Record<string, any>[]>([])
const selectedRows = ref<Record<string, any>[]>([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
let loadRequestSequence = 0
let inFlightLoad: { key: string; promise: Promise<number> } | undefined
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const searchForm = reactive<Record<string, any>>({})

/** 仓库退回弹窗状态 */
const returnDialog = reactive<{
  visible: boolean
  title: string
  bizType: 'inbound' | 'return'
  bizId: string
  items: Record<string, any>[]
}>({
  visible: false,
  title: '',
  bizType: 'inbound',
  bizId: '',
  items: []
})

/** 供应商删除预览弹窗状态（仅 supplier 场景使用） */
const supplierDeleteDialog = reactive<{
  visible: boolean
  target: import('@/api').SupplierItem | null
}>({
  visible: false,
  target: null
})

/** 审核预览弹窗状态 */
const auditPreviewDialog = reactive<{
  visible: boolean
  loading: boolean
  submitting: boolean
  data: AuditPreviewAggregated | null
  orderCount: number
  ids: string[]
}>({
  visible: false,
  loading: false,
  submitting: false,
  data: null,
  orderCount: 0,
  ids: []
})

const inboundWarehouseStatusEnum: Record<string, string> = {
  '0': '待入库',
  '1': '已发送仓库',
  '2': '仓库退回',
  '3': '入库完成'
}

/** 采购入库单列表列（snake_case，匹配后端接口41/43返回字段） */
const inboundColumns: ColumnConfig[] = [
  { key: 'receipt_no', label: '入库单号', width: 160, sortable: true },
  { key: 'supplier_name', label: '供应商', minWidth: 140, sortable: true },
  { key: 'warehouse_status', label: '入库状态', width: 130, tag: true, sortable: true, enum: inboundWarehouseStatusEnum },
  { key: 'remark', label: '备注', minWidth: 140 },
  { key: 'created_by_name', label: '创建人', width: 100, sortable: true },
  { key: 'created_at', label: '创建时间', width: 160, sortable: true }
]

/** 采购订单列表列（snake_case，匹配后端接口29/31返回字段） */
const orderColumns: ColumnConfig[] = [
  { key: 'order_no', label: '订单编号', width: 150, sortable: true, link: true },
  { key: 'supplier_name', label: '供应商', minWidth: 130, sortable: true },
  { key: 'order_date', label: '订单日期', width: 120, sortable: true },
  { key: 'delivery_days', label: '送货天数', width: 110, sortable: true },
  { key: 'freight_bear_type', label: '运费承担', width: 100, sortable: true },
  { key: 'payment_method', label: '付款方式', width: 100, sortable: true },
  { key: 'rounding_amount', label: '抹零金额', width: 100, money: true },
  { key: 'order_amount', label: '订单金额', width: 110, money: true },
  { key: 'payable_amount', label: '应付金额', width: 110, money: true, sortable: true },
  { key: 'is_audited', label: '审核状态', width: 100, tag: true, sortable: true, enum: { '0': '待审核', '1': '已审核', '2': '反审核', '3': '审核失败' } },
  { key: 'purchase_status', label: '采购状态', width: 100, tag: true, enum: { '0': '未采购', '1': '已采购' } },
  { key: 'remark', label: '备注', minWidth: 140 },
  { key: 'created_by_name', label: '创建人', width: 100, sortable: true },
  { key: 'created_at', label: '创建时间', width: 160, sortable: true }
]

const returnColumns: ColumnConfig[] = [
  { key: 'return_no', label: '退货单号', width: 160, sortable: true },
  { key: 'supplier_name', label: '供应商', minWidth: 140, sortable: true },
  { key: 'purchase_order_no', label: '采购订单号', width: 150, sortable: true },
  { key: 'audit_status', label: '审核状态', width: 100, tag: true, sortable: true, enum: { '0': '待审核', '1': '审核通过', '2': '已反审核', '3': '审核失败' } },
  { key: 'settlement_method_display', label: '结算方式', width: 110, sortable: false },
  { key: 'return_address', label: '退货地址', minWidth: 160 },
  { key: 'return_amount', label: '退货金额', width: 120, money: true, sortable: true },
  { key: 'warehouse_status', label: '出库状态', width: 100, tag: true, sortable: false, enum: { '0': '待出库', '1': '已出库' } },
  { key: 'formal_return_date', label: '退货日期', width: 120, sortable: true },
  { key: 'remark', label: '备注', minWidth: 140 },
  { key: 'created_at', label: '创建时间', width: 160, sortable: true }
]

const scenes: Record<string, SceneConfig> = {
  supplierType: {
    title: '供应商类型',
    addType: 'purchaseSupplierType',
    showAdd: true,
    showExport: true,
    showSelection: true,
    showOperations: true,
    filters: [
      { key: 'type_name', label: '类型名称' },
      { key: 'status', label: '状态', type: 'select', options: ['启用', '停用'] }
    ],
    columns: [
      // { key: 'supplier_type_id', label: '供应商类型ID', width: 140, sortable: true },
      { key: 'type_name', label: '类型名称', minWidth: 150, sortable: true },
      { key: 'status', label: '状态', width: 80, tag: true, sortable: true, enum: { '0': '停用', '1': '启用' } },
      { key: 'remark', label: '备注', minWidth: 140 },
      { key: 'created_by_name', label: '创建人', width: 100, sortable: true },
      { key: 'created_at', label: '创建时间', width: 160, sortable: true },
      { key: 'updated_at', label: '更新时间', width: 160, sortable: true }
    ],
    fallbackData: [],
    idField: 'supplier_type_id',
    permEndpoints: {
      add: 'POST /api/v1/tenant-supplier-types/create',
      detail: 'GET /api/v1/tenant-supplier-types/detail',
      update: 'POST /api/v1/tenant-supplier-types/update',
      delete: 'POST /api/v1/tenant-supplier-types/delete',
    },
    searchFields: [
      { key: 'type_name', field: 'type_name' },
      { key: 'status', field: 'status', isNumber: true }
    ],
    load: (params) => getSupplierTypeList(params as any),
    search: (params) => searchSupplierType(params as any),
    remove: deleteSupplierType,
    importCreate: (row) => createSupplierType({ type_name: row.type_name || row.name, status: Number(row.status) || 1, remark: row.remark })
  },
  supplier: {
    title: '供应商档案',
    addType: 'purchaseSupplier',
    showAdd: true,
    showExport: true,
    showSelection: true,
    showOperations: true,
    importUrl: '/api/v1/tenant-suppliers/import',
    importTemplateFile: 'supplier-import-template.xlsx',
    importTemplateName: '供应商导入模板.xlsx',
    filters: [
      { key: 'supplier_name', label: '供应商名称' },
      { key: 'supplier_code', label: '供应商编码' },
      { key: 'status', label: '状态', type: 'select', options: ['启用', '停用'] }
    ],
    columns: [
      // { key: 'supplier_id', label: '供应商ID', width: 120 },
      { key: 'supplier_code', label: '编码', width: 110 },
      { key: 'supplier_name', label: '名称', minWidth: 140 },
      { key: 'short_name', label: '简称', width: 110 },
      { key: 'supplier_type_name', label: '供应商类型', width: 120 },
      { key: 'detail_address', label: '详细地址', minWidth: 180 },
      { key: 'phone1', label: '电话1', width: 130 },
      { key: 'phone2', label: '电话2', width: 130 },
      { key: 'fax_no', label: '传真号', width: 110 },
      { key: 'email', label: '邮箱', width: 150 },
      { key: 'principal_phone', label: '负责人电话', width: 130 },
      { key: 'business_contact', label: '业务联系人', width: 110 },
      { key: 'contact_phone', label: '联系人电话', width: 130 },
      { key: 'bank_name', label: '开户行', minWidth: 130 },
      { key: 'bank_account', label: '银行账号', width: 150 },
      { key: 'payee_name', label: '收款人', width: 100 },
      { key: 'balance', label: '余额', width: 110, money: true },
      { key: 'status', label: '状态', width: 80, tag: true, enum: { '0': '停用', '1': '启用' } },
      { key: 'remark', label: '备注', minWidth: 140 }
    ],
    fallbackData: [],
    idField: 'supplier_id',
    permEndpoints: {
      add: 'POST /api/v1/tenant-suppliers/create',
      detail: 'GET /api/v1/tenant-suppliers/detail',
      update: 'POST /api/v1/tenant-suppliers/update',
      delete: 'POST /api/v1/tenant-suppliers/delete',
      import: 'POST /api/v1/tenant-suppliers/import',
    },
    searchFields: [
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'supplier_code', field: 'supplier_code' },
      { key: 'status', field: 'status', isNumber: true }
    ],
    load: (params, config) => getSupplierList(params as any, config),
    search: (params, config) => searchSupplier(params as any, config),
    remove: deleteSupplier,
    importCreate: (row) => createSupplier({ supplier_name: row.supplier_name || row.name, short_name: row.short_name, status: Number(row.status) || 1, remark: row.remark })
  },
  order: {
    title: '采购订单',
    addType: 'purchaseOrder',
    showAdd: true,
    showExport: true,
    showPrint: true,
    showAudit: true,
    showPurchaseStatus: true,
    showSelection: true,
    showOperations: true,
    importUrl: '/api/v1/tenant-purchase-orders/import',
    importTemplateFile: 'purchase-order-import-template.xlsx',
    importTemplateName: '采购订单导入模板.xlsx',
    filters: [
      { key: 'order_no', label: '订单编号' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'product_name', label: '产品名称' },
      { key: 'is_audited', label: '审核状态', type: 'select', options: ['待审核', '已审核', '反审核'] },
      { key: 'created_at', label: '创建时间', type: 'daterange' }
    ],
    columns: orderColumns,
    fallbackData: [],
    idField: 'purchase_order_id',
    permEndpoints: {
      add: 'POST /api/v1/tenant-purchase-orders/create',
      detail: 'GET /api/v1/tenant-purchase-orders/detail',
      update: 'POST /api/v1/tenant-purchase-orders/update',
      delete: 'POST /api/v1/tenant-purchase-orders/delete',
      audit: 'POST /api/v1/tenant-purchase-orders/audit',
      import: 'POST /api/v1/tenant-purchase-orders/import',
      purchaseStatus: 'POST /api/v1/tenant-purchase-orders/purchase-status/update',
      generateInbound: 'POST /api/v1/tenant-purchase-receipts/create',
    },
    searchFields: [
      { key: 'order_no', field: 'order_no' },
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'product_name', field: 'product_name' },
      { key: 'is_audited', field: 'is_audited', isNumber: true },
      { key: 'created_at', field: 'created_at', isRange: true }
    ],
    load: (params, config) => getPurchaseOrderList(params as any, config),
    search: (params, config) => searchPurchaseOrders(params as any, config),
    remove: deletePurchaseOrder,
    rowActions: [
      { command: 'confirmPurchaseStatus', label: '确认采购', endpoint: 'POST /api/v1/tenant-purchase-orders/purchase-status/update' }
    ]
  },
  inbound: {
    title: '采购入库单',
    addType: 'purchaseInbound',
    showAdd: true,
    showExport: true,
    showPrint: true,
    showSelection: true,
    showOperations: true,
    filters: [
      { key: 'receipt_no', label: '入库单号' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'warehouse_status', label: '入库状态', type: 'select', options: ['待入库', '已发送仓库', '仓库退回', '入库完成'] },
      { key: 'created_at', label: '创建时间', type: 'daterange' }
    ],
    columns: inboundColumns,
    fallbackData: [],
    idField: 'purchase_receipt_id',
    permEndpoints: {
      add: 'POST /api/v1/tenant-purchase-receipts/create',
      detail: 'GET /api/v1/tenant-purchase-receipts/detail',
      update: 'POST /api/v1/tenant-purchase-receipts/update',
      delete: 'POST /api/v1/tenant-purchase-receipts/delete',
      sendWarehouse: 'POST /api/v1/tenant-purchase-receipts/warehouse/status/update',
      cancelSend: 'POST /api/v1/tenant-purchase-receipts/warehouse/cancel-send',
    },
    searchFields: [
      { key: 'receipt_no', field: 'receipt_no' },
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'warehouse_status', field: 'warehouse_status', isNumber: true },
      { key: 'created_at', field: 'created_at', isRange: true }
    ],
    load: (params, config) => getPurchaseInboundList(params as any, config),
    search: (params, config) => searchPurchaseInbound(params as any, config),
    remove: deletePurchaseInbound,
    rowActions: [
      { command: 'confirmInbound', label: '确认入库', endpoint: 'POST /api/v1/tenant-purchase-receipts/warehouse/status/update' },
      { command: 'warehouseReturn', label: '仓库退回', endpoint: 'POST /api/v1/tenant-purchase-receipts/warehouse/return' },
      { command: 'cancelSend', label: '撤销发送', endpoint: 'POST /api/v1/tenant-purchase-receipts/warehouse/cancel-send' }
    ]
  },
  return: {
    title: '采购退货单',
    addType: 'purchaseReturn',
    showAdd: true,
    showExport: true,
    showPrint: true,
    showAudit: true,
    showSelection: true,
    showOperations: true,
    filters: [
      { key: 'return_no', label: '退货单号' },
      { key: 'purchase_order_no', label: '采购订单号' },
      { key: 'settlement_type', label: '结算分组', type: 'select', options: ['月结', '非月结'], defaultValue: '非月结' }
    ],
    columns: returnColumns,
    fallbackData: [],
    idField: 'purchase_return_id',
    permEndpoints: {
      add: 'POST /api/v1/tenant-purchase-returns/create',
      detail: 'GET /api/v1/tenant-purchase-returns/detail',
      update: 'POST /api/v1/tenant-purchase-returns/update',
      delete: 'POST /api/v1/tenant-purchase-returns/delete',
      audit: 'POST /api/v1/tenant-purchase-returns/audit',
      sendWarehouse: 'POST /api/v1/tenant-purchase-returns/warehouse/status/update',
      cancelSend: 'POST /api/v1/tenant-purchase-returns/warehouse/cancel-send',
    },
    searchFields: [
      { key: 'return_no', field: 'return_no' },
      { key: 'purchase_order_no', field: 'purchase_order_no' }
    ],
    load: (params, config) => getPurchaseReturnList(params as any, config),
    search: (params, config) => searchPurchaseReturn(params as any, config),
    remove: deletePurchaseReturn,
    rowActions: [
      { command: 'confirmReturn', label: '确认出库', endpoint: 'POST /api/v1/tenant-purchase-returns/warehouse/status/update' },
      { command: 'warehouseReturn', label: '仓库退回', endpoint: 'POST /api/v1/tenant-purchase-returns/warehouse/return' },
      { command: 'cancelSend', label: '撤销发送', endpoint: 'POST /api/v1/tenant-purchase-returns/warehouse/cancel-send' }
    ],
    /** 重置创建：审核状态 2/3 且未被重新创建过的退货单可基于源单数据创建新单 */
    recreateEndpoint: 'POST /api/v1/tenant-purchase-returns/create',
  },
  returnSummary: {
    title: '采购退货汇总表',
    showAdd: false,
    showExport: true,
    filters: [
      { key: 'return_no', label: '退货单号' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'product_name', label: '产品名称' },
      { key: 'warehouse_status', label: '出库状态', type: 'select', options: ['待出库', '已出库'] }
    ],
    columns: [
      { key: 'return_no', label: '退货单号', width: 160, sortable: true },
      { key: 'supplier_name', label: '供应商', minWidth: 140, sortable: true },
      { key: 'purchase_order_no', label: '采购订单号', width: 150, sortable: true },
      { key: 'product_code', label: '商品编码', width: 120, sortable: true },
      { key: 'product_name', label: '商品名称', minWidth: 140, sortable: true },
      { key: 'category_name', label: '分类', width: 110, sortable: true },
      { key: 'specification', label: '规格', width: 110, sortable: true },
      { key: 'unit_name', label: '单位', width: 80, sortable: true },
      { key: 'return_price', label: '退货单价', width: 110, money: true, sortable: true },
      { key: 'return_qty', label: '退货数量', width: 110, sortable: true },
      { key: 'actual_return_qty', label: '实际退货数量', width: 120, sortable: true },
      { key: 'planned_return_amount', label: '计划退货金额', width: 130, money: true, sortable: true },
      { key: 'actual_return_amount', label: '实际退货金额', width: 130, money: true, sortable: true },
      { key: 'warehouse_status', label: '出库状态', width: 100, tag: true, sortable: true, enum: { '0': '待出库', '1': '已出库' } },
      { key: 'formal_return_date', label: '退货日期', width: 200, sortable: true },
      { key: 'created_at', label: '创建时间', width: 200, sortable: true }
    ],
    fallbackData: [],
    searchFields: [
      { key: 'return_no', field: 'return_no' },
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'product_name', field: 'product_name' },
      { key: 'warehouse_status', field: 'warehouse_status', isNumber: true }
    ],
    load: (params) => getPurchaseReturnItemList(params as any),
    search: (params) => searchPurchaseReturnItems(params as any)
  },
  inboundDetail: {
    title: '采购入库单明细',
    showAdd: false,
    showExport: true,
    filters: [
      { key: 'receipt_no', label: '入库单号' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'product_name', label: '产品名称' },
      { key: 'warehouse_status', label: '入库状态', type: 'select', options: ['待入库', '已发送仓库', '仓库退回', '入库完成'] },
      { key: 'formal_receipt_date', label: '入库日期', type: 'daterange' }
    ],
    columns: [
      { key: 'receipt_no', label: '入库单号', width: 160, sortable: true },
      { key: 'supplier_name', label: '供应商', minWidth: 140, sortable: true },
      { key: 'purchase_order_no', label: '采购订单号', width: 150, sortable: true },
      { key: 'product_code', label: '商品编码', width: 120, sortable: true },
      { key: 'product_name', label: '商品名称', minWidth: 140, sortable: true },
      { key: 'category_name', label: '分类', width: 110, sortable: true },
      { key: 'specification', label: '规格', width: 110, sortable: true },
      { key: 'unit_name', label: '单位', width: 80, sortable: true },
      { key: 'purchase_price', label: '采购单价', width: 110, money: true, sortable: true },
      { key: 'in_stock_qty', label: '入库数量', width: 110, sortable: true },
      { key: 'actual_in_stock_qty', label: '实际入库数量', width: 120, sortable: true },
      { key: 'planned_receipt_amount', label: '计划入库金额', width: 130, money: true, sortable: true },
      { key: 'actual_receipt_amount', label: '实际入库金额', width: 130, money: true, sortable: true },
      { key: 'warehouse_status', label: '入库状态', width: 130, tag: true, sortable: true, enum: inboundWarehouseStatusEnum },
      { key: 'formal_receipt_date', label: '入库日期', width: 120, sortable: true },
      { key: 'created_at', label: '创建时间', width: 160, sortable: true }
    ],
    fallbackData: [],
    searchFields: [
      { key: 'receipt_no', field: 'receipt_no' },
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'product_name', field: 'product_name' },
      { key: 'warehouse_status', field: 'warehouse_status', isNumber: true },
      { key: 'formal_receipt_date', field: 'formal_receipt_date', isRange: true }
    ],
    load: (params, config) => getPurchaseInboundItemList(params as any, config),
    search: (params, config) => searchPurchaseInboundItems(params as any, config)
  },
  supplierBalance: {
    title: '供应商余额表',
    showAdd: false,
    showExport: true,
    filters: [
      { key: 'supplier_name', label: '供应商' },
      { key: 'area_name', label: '所属地区' },
      { key: 'purchaser_user_name', label: '采购员' }
    ],
    columns: [
      { key: 'supplier_name', label: '供应商', minWidth: 140, sortable: true },
      { key: 'area_name', label: '所属地区', width: 150, sortable: true },
      { key: 'balance', label: '当前余额', width: 120, money: true, sortable: true },
      { key: 'is_monthly_settlement', label: '月结', width: 80, tag: true, enum: { '0': '否', '1': '是' } },
      { key: 'monthly_days', label: '月结天数', width: 100, sortable: true },
      { key: 'settlement_day', label: '结算日', width: 100, sortable: true },
      { key: 'purchaser_user_name', label: '采购员', width: 100, sortable: true }
    ],
    fallbackData: [],
    searchFields: [
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'area_name', field: 'area_name' },
      { key: 'purchaser_user_name', field: 'purchaser_user_name' }
    ],
    load: (params, config) => getSupplierBalanceSummary(params as any, config).then(res => ({
      ...res,
      data: { ...res.data, supplier: res.data.suppliers }
    })),
    search: (params, config) => searchSupplierBalanceSummary(params as any, config).then(res => ({
      ...res,
      data: { ...res.data, supplier: res.data.suppliers }
    }))
  }
}

const scene = computed(() => scenes[props.type] || scenes.supplierType)

/* ── 天心模式写入口门 ─────────────────────────────────────────────────────
 * 天心模式下后端对「采购单 / 入库单 / 采购退货」的写接口一律 403，故须隐藏写入口，
 * 避免用户点进去撞 403。供应商档案等主数据与报表**不受影响**，因此按 type 判定，
 * 不能一刀切。判定依据与适用范围见 composables/useTradeModeGate.ts。
 */
const { isTianxinMode } = useTradeModeGate()
/** 本场景的写入口是否可用（fail-open：模式未加载/失败时放行，由后端 403 兜底） */
const canWrite = computed(() => !isPurchaseSceneWriteBlocked(props.type, isTianxinMode.value))

const resolvedSceneColumns = computed<ResolvedColumnConfig[]>(() =>
  scene.value.columns.map((column) => ({
    ...column,
    resolvedWidth: resolveColumnWidth(column),
    resolvedMinWidth: resolveColumnMinWidth(column, tableData.value)
  }))
)

function initSearchForm() {
  Object.keys(searchForm).forEach((key) => delete searchForm[key])
  scene.value.filters.forEach((filter) => {
    searchForm[filter.key] = filter.type === 'daterange' ? null : filter.defaultValue ?? ''
  })
}

function filterFallbackData(rows: Record<string, any>[]) {
  return rows.filter((row) => scene.value.filters.every((filter) => {
    const searchValue = searchForm[filter.key]
    if (!searchValue) return true
    return String(row[filter.key] ?? '').includes(String(searchValue))
  }))
}

/** 将筛选框的值标准化（状态中文 → 数字） */
function normalizeSearchValue(raw: any, isNumber?: boolean) {
  if (!isNumber) return raw
  if (raw === '启用') return 1
  if (raw === '停用') return 0
  if (raw === '待审核') return 0
  if (raw === '已审核') return 1
  if (raw === '反审核') return 2
  if (raw === '待入库') return 0
  if (raw === '已发送仓库' || raw === '已入库') return 1
  if (raw === '仓库退回') return 2
  if (raw === '入库完成') return 3
  if (raw === '待出库') return 0
  if (raw === '已出库') return 1
  return Number(raw)
}

function getVisibleRowActions(row: Record<string, any>) {
  // 天心模式下单据族场景的写接口被后端封：行内下拉项全部是写操作（确认采购 / 确认入库 /
  // 仓库退回 / 撤销发送 / 重置创建），整体隐藏，避免下拉里出现必然 403 的入口。
  if (!canWrite.value) return []
  // 下拉项渲染在 body 层的 teleport 里，v-perm 覆盖不到，故在数据层按端点过滤
  const actions = (scene.value.rowActions || []).filter(
    action => !action.endpoint || permissionStore.hasUrlPerm(action.endpoint)
  )
  if (props.type === 'inbound') {
    const warehouseStatus = Number(row.warehouse_status || 0)
    const canCancelSend = Number(row.can_cancel_send || 0) === 1

    return actions.filter((action) => {
      if (action.command === 'confirmInbound') return warehouseStatus === 0
      if (action.command === 'warehouseReturn') return warehouseStatus === 1 || warehouseStatus === 2
      if (action.command === 'cancelSend') return canCancelSend
      return true
    })
  }
  if (props.type === 'order') {
    return actions.filter((action) => {
      if (action.command === 'confirmPurchaseStatus') return Number(row.purchase_status || 0) === 0
      return true
    })
  }
  if (props.type === 'return') {
    const auditStatus = Number(row.audit_status ?? 0)
    const isRecreated = Number(row.is_recreated || 0) === 1
    const returnCancelSend = Number(row.can_cancel_send || 0) === 1
    const base = actions.filter((action) => {
      if (action.command === 'cancelSend') return returnCancelSend
      return true
    })
    // 重置创建：审核失败/已反审核且未被重新创建过才显示；已重置过则置灰展示「已重置」
    if (auditStatus === 2 || auditStatus === 3) {
      base.push({ command: isRecreated ? '_recreated-done' : 'recreate', label: isRecreated ? '已重置' : '重置创建', disabled: isRecreated, endpoint: scene.value.recreateEndpoint })
    }
    return base
  }
  return actions
}

function getLoadKey(): string {
  return JSON.stringify({
    type: props.type,
    search: searchForm,
    page: pagination.page,
    pageSize: pagination.pageSize,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  })
}

function loadData(signal?: AbortSignal): Promise<number> {
  const key = getLoadKey()
  if (inFlightLoad?.key === key) return inFlightLoad.promise

  const promise = performLoadData(signal)
  inFlightLoad = { key, promise }
  promise.then(
    () => { if (inFlightLoad?.promise === promise) inFlightLoad = undefined },
    () => { if (inFlightLoad?.promise === promise) inFlightLoad = undefined },
  )
  return promise
}

async function performLoadData(signal?: AbortSignal): Promise<number> {
  const requestSequence = ++loadRequestSequence
  loading.value = true
  try {
    // 已接入后端的场景：使用真实接口，不再回退假数据
    if (scene.value.load) {
      try {
        // 构建专用 search 接口的参数（search_field/search_value JSON 字符串）
        const sf = scene.value.searchFields || []
        const activeFields = sf.filter((f) => {
          const v = searchForm[f.key]
          return v !== undefined && v !== null && v !== ''
        })

        let response
        if (scene.value.search && activeFields.length > 0) {
          const searchField: string[] = []
          const searchValue: Record<string, unknown> = {}
          activeFields.forEach((f) => {
            if (f.isRange && Array.isArray(searchForm[f.key])) {
              const range = searchForm[f.key] as [string, string]
              const s = range[0]
              const e = range[1]
              if (s || e) {
                searchField.push(f.field)
                searchValue[f.field] = { start_time: s || undefined, end_time: e || undefined }
              }
            } else {
              searchField.push(f.field)
              searchValue[f.field] = normalizeSearchValue(searchForm[f.key], f.isNumber)
            }
          })
          response = await scene.value.search({
            search_field: JSON.stringify(searchField),
            search_value: JSON.stringify(searchValue),
            page: pagination.page,
        page_size: pagination.pageSize,
            sort_by: sortBy.value || undefined,
            sort_order: sortOrder.value || undefined,
          }, signal ? { signal } : undefined)
        } else {
          response = await scene.value.load({
            page: pagination.page,
        page_size: pagination.pageSize,
            sort_by: sortBy.value || undefined,
            sort_order: sortOrder.value || undefined,
          }, signal ? { signal } : undefined)
        }
        // 后端列表数据 key：purchase_order(订单) / purchase_receipts(入库单) / purchase_returns(退货单) / supplier_type / supplier / items(入库/退货明细列表)
        if (requestSequence !== loadRequestSequence) return pagination.total
        tableData.value = response.data.purchase_order || response.data.purchase_receipts || response.data.purchase_returns || response.data.supplier_type || response.data.supplier || response.data.items || response.data.list || []
        pagination.total = response.data.total || 0
      } catch (error) {
        if (signal?.aborted) throw error
        if (requestSequence !== loadRequestSequence) return pagination.total
        tableData.value = []
        pagination.total = 0
      }
      return pagination.total
    }
    // 未接入后端的场景：沿用本地示例数据
    const filtered = filterFallbackData(scene.value.fallbackData)
    const start = (pagination.page - 1) * pagination.pageSize
    if (requestSequence !== loadRequestSequence) return pagination.total
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
    return pagination.total
  } finally {
    if (requestSequence === loadRequestSequence) loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadData()
}

function handleReset() {
  initSearchForm()
  handleSearch()
}

function handleSelectionChange(rows: Record<string, any>[]) {
  selectedRows.value = rows
}

function handleAdd() {
  if (!scene.value.addType) return
  router.push({ path: '/common/add', query: { type: scene.value.addType } })
}

function handleEdit(row: Record<string, any>) {
  if (!scene.value.addType) return
  // 编辑/删除使用业务 ID（如 supplier_id），而非数据库主键 id
  const bizId = scene.value.idField ? row[scene.value.idField] : row.id
  sessionStorage.setItem(`editData:${scene.value.addType}`, JSON.stringify(row))
  router.push({
    path: '/common/add',
    query: {
      type: scene.value.addType,
      id: bizId,
      mode: 'edit',
      // 本函数同时服务"单号链接"的查看入口（操作列的编辑按钮已被 canWrite 门隐藏）。
      // 天心模式下单据族场景的写接口被封，故以只读态打开（readonly=1 由 AddTemplate
      // 的 isReadonly 消费），避免用户查看时误保存撞 403。
      ...(canWrite.value ? {} : { readonly: '1' }),
    }
  })
}

async function handleDelete(row: Record<string, any>) {
  // 供应商档案：使用删除预览弹窗（含主供应商迁移）
  if (props.type === 'supplier') {
    supplierDeleteDialog.target = row as import('@/api').SupplierItem
    supplierDeleteDialog.visible = true
    return
  }
  const bizId = scene.value.idField ? row[scene.value.idField] : row.id
  try {
    await ElMessageBox.confirm(`确认删除 ${row.name || row.type_name || row.supplier_name || row.orderNo || row.returnNo || bizId}？`, '提示', {
      confirmButtonText: '确认删除',
      type: 'warning'
    })
    if (scene.value.remove) await scene.value.remove(bizId)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

/** 供应商删除预览弹窗成功回调 */
function handleSupplierDeleteSuccess() {
  supplierDeleteDialog.visible = false
  supplierDeleteDialog.target = null
  loadData()
}

// Excel 批量导入弹窗（文件上传方式，走后端 /import 接口）
const importDialogVisible = ref(false)
const importInitialTab = ref<'upload' | 'records'>('upload')

function openImport(tab: 'upload' | 'records') {
  importInitialTab.value = tab
  importDialogVisible.value = true
}

/** 当前场景的模板下载 URL（拼接 BASE_URL，兼容部署子路径 /wms/） */
const sceneTemplateUrl = computed(() => {
  const file = scene.value.importTemplateFile || ''
  return file ? `${import.meta.env.BASE_URL}templates/${file}?v=20260922` : ''
})

/** 当前场景对应的批量导入上传函数（supplier/order 场景配置了 importUrl） */
function getSceneImportFn() {
  if (props.type === 'supplier') return importSuppliers
  if (props.type === 'order') return importPurchaseOrders
  throw new Error(`未配置场景 ${props.type} 的批量导入函数`)
}

function handleImportSuccess() {
  loadData()
}

async function handleImport(rows: Record<string, any>[]) {
  try {
    if (scene.value.importCreate) {
      await Promise.all(rows.map((row) => scene.value.importCreate!(row)))
    }
    ElMessage.success(`已导入 ${rows.length} 条数据`)
    loadData()
  } catch {
    ElMessage.success(`已解析 ${rows.length} 条数据，请对接后端导入接口`)
  }
}

async function handleBatchAudit(status: string) {
  // 审核按钮 → 审核通过；反审核按钮 → 反审核（订单 is_audited=1/2，退货单 audit_status=1/2）
  const idField = scene.value.idField || 'id'
  const ids = selectedRows.value.map((row) => row[idField])

  // 采购退货单：审核接口已收口为仅 1=审核通过 / 3=审核失败；反审核走独立 /unaudit 接口
  if (props.type === 'return') {
    const isApprove = status === '已审核'
    try {
      await ElMessageBox.confirm(
        isApprove
          ? `确认将 ${ids.length} 条采购退货单审核通过？审核通过后退货金额将联动采购订单的待付/待退金额。`
          : `确认反审核 ${ids.length} 条采购退货单？将恢复审核通过时联动到采购订单的金额。`,
        isApprove ? '批量审核' : '批量反审核',
        { confirmButtonText: isApprove ? '确认审核' : '确认反审核', type: 'warning' }
      )
    } catch {
      return
    }
    try {
      if (isApprove) {
        await auditPurchaseReturn(ids, 1)
      } else {
        await unauditPurchaseReturn(ids)
      }
      ElMessage.success(isApprove ? '审核成功' : '反审核成功')
      loadData()
    } catch {
      // 状态流转校验等错误已由请求层统一弹出后端 detail 提示
    }
    return
  }

  // 反审核：直接提交，无预览
  if (status !== '已审核') {
    try {
      await auditPurchaseOrder(ids, 2)
      ElMessage.success(`${status}成功`)
      loadData()
    } catch {
      ElMessage.error(`${status}失败`)
    }
    return
  }

  // 审核：先调预览接口弹窗，用户确认后再真正审核
  auditPreviewDialog.ids = ids
  auditPreviewDialog.orderCount = ids.length
  auditPreviewDialog.data = null
  auditPreviewDialog.visible = true
  auditPreviewDialog.loading = true
  try {
    const res = await previewPurchaseOrderAudit(ids)
    auditPreviewDialog.data = aggregateAuditPreview(res.data.items)
  } catch {
    ElMessage.error('审核预检失败')
    auditPreviewDialog.visible = false
  } finally {
    auditPreviewDialog.loading = false
  }
}

/** 将批量预检结果中的 items 聚合为单个汇总对象供 Dialog 展示 */
function aggregateAuditPreview(items: AuditPreviewItem[]): AuditPreviewAggregated {
  const sum = (key: keyof AuditPreviewItem) =>
    items.reduce((acc, item) => {
      const val = (item as any)[key]
      return acc + (typeof val === 'string' ? Number(val) || 0 : Number(val) || 0)
    }, 0).toFixed(4)
  return {
    has_gift_overflow: items.some((item) => item.has_gift_overflow),
    gift_overflow_amount: sum('gift_overflow_amount'),
    requested_gift_amount: sum('requested_gift_amount'),
    actual_gift_amount: sum('actual_gift_amount'),
    has_prepayment_overflow: items.some((item) => item.has_prepayment_overflow),
    prepayment_overflow_amount: sum('prepayment_overflow_amount'),
    requested_prepayment_amount: sum('requested_prepayment_amount'),
    actual_prepayment_amount: sum('actual_prepayment_amount')
  }
}

async function handleAuditPreviewConfirm() {
  if (auditPreviewDialog.submitting) return
  auditPreviewDialog.submitting = true
  try {
    await auditPurchaseOrder(auditPreviewDialog.ids, 1)
    ElMessage.success('审核成功')
    auditPreviewDialog.visible = false
    loadData()
  } catch {
    ElMessage.error('审核失败')
  } finally {
    auditPreviewDialog.submitting = false
  }
}

async function handleBatchPrint() {
  ElMessage.success(`已提交 ${selectedRows.value.length} 条单据到打印队列`)
}

async function handleBatchConfirmPurchaseStatus() {
  const idField = scene.value.idField || 'id'
  const ids = selectedRows.value.map((row) => row[idField])
  try {
    await ElMessageBox.confirm(
      `确认将 ${ids.length} 条采购订单标记为已采购？`,
      '批量确认采购状态',
      { confirmButtonText: '确认采购', type: 'warning' }
    )
    await updatePurchaseOrderStatus(ids)
    ElMessage.success('批量确认采购状态成功')
    loadData()
  } catch {}
}

/** 批量一键生成采购入库单的 sessionStorage 队列键（AddTemplate 消费，见 advanceBatchQueue） */
const BATCH_INBOUND_QUEUE_KEY = 'batchQueue:purchaseInbound'
const BATCH_INBOUND_PRESET_TYPE = 'purchaseInbound'
const BATCH_INBOUND_MAX_COUNT = 20
const PENDING_RECEIPT_PAGE_SIZE = 100

interface BatchInboundQueueItem {
  sourceOrderNo: string
  sourceDocLabel: string
  preset: Record<string, any>
}

/**
 * 批量一键生成采购入库单：
 * 一张采购订单对应一张采购入库单，逐张写入预填队列后跳转新增页；
 * AddTemplate 保存成功后按队列自动带出下一张，全部完成回到采购入库单列表。
 */
async function handleBatchGenerateInbound() {
  if (selectedRows.value.length === 0) return
  if (selectedRows.value.length > BATCH_INBOUND_MAX_COUNT) {
    ElMessage.warning(`单次最多生成 ${BATCH_INBOUND_MAX_COUNT} 张采购入库单，请调整勾选数量`)
    return
  }
  // 按业务 ID 去重后校验：仅"已采购"订单可生成入库单（后端创建入库单时硬校验 purchase_status=1）
  const seenOrderIds = new Set<string>()
  const orders: Record<string, any>[] = []
  for (const row of selectedRows.value) {
    const orderId = String(row.purchase_order_id || '')
    if (!orderId || seenOrderIds.has(orderId)) continue
    seenOrderIds.add(orderId)
    orders.push(row)
  }
  const notPurchased = orders.filter((row) => Number(row.purchase_status || 0) !== 1)
  if (notPurchased.length > 0) {
    ElMessage.warning(`以下采购订单未标记为已采购，无法生成入库单：${notPurchased.map((row) => row.order_no || row.purchase_order_id).join('、')}`)
    return
  }

  loading.value = true
  try {
    // 拉取各供应商的待入库明细（available_qty>0 才允许入库），按采购订单号归集，用于剔除已无可入库量的明细
    const supplierIds = [...new Set(orders.map((row) => String(row.supplier_id || '')).filter(Boolean))]
    const pendingRowsByOrderNo = new Map<string, PendingReceiptItem[]>()
    for (const supplierId of supplierIds) {
      let page = 1
      let fetched = 0
      // 按累计数终止翻页（服务端可能将 page_size 压到请求值以下，页大小×页码的算法会漏页）
      for (;;) {
        if (page > 50) break
        const res = await getPendingReceiptItemList({ supplier_id: supplierId, page, page_size: PENDING_RECEIPT_PAGE_SIZE })
        const items = res.data?.items || []
        for (const item of items) {
          if (!item.purchase_order_no || Number(item.available_qty || 0) <= 0) continue
          const list = pendingRowsByOrderNo.get(item.purchase_order_no) || []
          list.push(item)
          pendingRowsByOrderNo.set(item.purchase_order_no, list)
        }
        fetched += items.length
        const total = Number(res.data?.total || 0)
        if (items.length === 0 || fetched >= total) break
        page += 1
      }
    }

    // 逐单组装预填数据：供应商继承订单，明细继承订单待入库行，入库数量预填订单数量由用户调整；整单无可入库明细则跳过
    const skippedOrderNos: string[] = []
    const occupiedOrderNos: string[] = []
    const batchItems: BatchInboundQueueItem[] = []
    for (const order of orders) {
      const orderNo = String(order.order_no || '')
      const rows = pendingRowsByOrderNo.get(orderNo) || []
      if (rows.length === 0) {
        skippedOrderNos.push(orderNo || String(order.purchase_order_id || ''))
        continue
      }
      let occupied = false
      const items = rows.map((row) => {
        if (Number(row.qty || 0) > Number(row.available_qty || 0)) occupied = true
        return {
          purchase_order_item_id: row.purchase_order_item_id || '',
          purchase_order_no: row.purchase_order_no,
          product_id: row.product_id || '',
          product_code: row.product_code || '',
          product_name: row.product_name || '',
          category_name: row.category_name || '',
          specification: row.specification ?? '',
          color: row.color ?? '',
          unit_name: row.unit_name || '',
          purchase_price: row.purchase_price || '',
          in_stock_qty: Number(row.qty) || 0,
          remark: ''
        }
      })
      if (occupied) occupiedOrderNos.push(orderNo)
      batchItems.push({
        sourceOrderNo: orderNo,
        sourceDocLabel: '采购订单',
        preset: {
          supplier_id: String(order.supplier_id || ''),
          supplier_id_label: String(order.supplier_name || ''),
          items
        }
      })
    }

    if (batchItems.length === 0) {
      ElMessage.warning(`勾选的采购订单均无可入库明细，无法生成：${skippedOrderNos.join('、')}`)
      return
    }

    const tips: string[] = [`将依次生成 ${batchItems.length} 张采购入库单（一张采购订单对应一张入库单），保存成功后自动进入下一张。`]
    if (skippedOrderNos.length > 0) {
      tips.push(`以下订单无可入库明细，已跳过：${skippedOrderNos.join('、')}`)
    }
    if (occupiedOrderNos.length > 0) {
      tips.push(`注意：以下订单存在已入库/占用记录，入库数量已按订单数量预填，请按可入库余量调整后再保存：${occupiedOrderNos.join('、')}`)
    }
    try {
      await ElMessageBox.confirm(h('div', { style: 'white-space: pre-line; line-height: 1.6;' }, tips.join('\n')), '批量生成采购入库单', {
        confirmButtonText: '开始生成',
        cancelButtonText: '取消',
        type: 'info'
      })
    } catch {
      return
    }

    // 批量令牌：AddTemplate 保存成功后凭令牌推进队列，避免残留队列污染后续普通新增
    const token = Date.now().toString(36)
    // ⚠️ 队列必须排除首张：首张已由下方 presetData 预填，advanceBatchQueue 用 shift() 取的是
    // 「下一张」。若整批入队，第 1 张会被 shift 再取一次 → 同一张采购订单生成两张入库单
    // （AddTemplate.commitPurchaseSplit 同口径：const [first, ...rest] = items，只入队 rest）。
    sessionStorage.setItem(BATCH_INBOUND_QUEUE_KEY, JSON.stringify({ token, total: batchItems.length, items: batchItems.slice(1) }))
    sessionStorage.setItem(
      `presetData:${BATCH_INBOUND_PRESET_TYPE}`,
      JSON.stringify({
        ...batchItems[0].preset,
        __batch: { token, index: 1, total: batchItems.length, sourceOrderNo: batchItems[0].sourceOrderNo, sourceDocLabel: batchItems[0].sourceDocLabel }
      })
    )
    router.push({ path: '/common/add', query: { type: BATCH_INBOUND_PRESET_TYPE } })
  } catch {
    // 待入库明细拉取失败等错误已由请求层统一弹出后端提示
  } finally {
    loading.value = false
  }
}

/** 批量发送仓库：勾选的入库单 warehouse_status 0→1 */
async function handleBatchSendWarehouse() {
  const idField = scene.value.idField || 'id'
  const ids = selectedRows.value.map((row) => row[idField])
  const invalidIds = selectedRows.value
    .filter((row) => Number(row.warehouse_status || 0) !== 0)
    .map((row) => row.receipt_no || row[idField])
  if (invalidIds.length > 0) {
    ElMessage.warning(`以下入库单不是待入库状态，无法发送：${invalidIds.join('、')}`)
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认将 ${ids.length} 条入库单发送仓库？此操作将同步更新仓库库存。`,
      '批量发送仓库',
      { confirmButtonText: '确认发送', type: 'warning' }
    )
    await updatePurchaseInboundWarehouseStatus(ids, 1)
    ElMessage.success(`已成功发送 ${ids.length} 条入库单到仓库`)
    loadData()
  } catch {}
}

/** 批量发送仓库：勾选的退货单 warehouse_status 0→1（后端要求审核通过 audit_status=1 后才可发送） */
async function handleBatchSendReturnWarehouse() {
  const idField = scene.value.idField || 'id'
  const ids = selectedRows.value.map((row) => row[idField])
  const invalidIds = selectedRows.value
    .filter((row) => Number(row.warehouse_status || 0) !== 0)
    .map((row) => row.return_no || row[idField])
  if (invalidIds.length > 0) {
    ElMessage.warning(`以下退货单不是待出库状态，无法发送：${invalidIds.join('、')}`)
    return
  }
  // 前置拦截未审核单据（当前数据源不含 audit_status 字段时跳过，由后端兑底校验）
  const unaudited = selectedRows.value
    .filter((row) => row.audit_status !== undefined && Number(row.audit_status) !== 1)
    .map((row) => row.return_no || row[idField])
  if (unaudited.length > 0) {
    ElMessage.warning(`以下退货单未审核通过，无法发送仓库：${unaudited.join('、')}`)
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认将 ${ids.length} 条退货单发送仓库？此操作将触发仓库退货出库。`,
      '批量发送仓库',
      { confirmButtonText: '确认发送', type: 'warning' }
    )
    await updatePurchaseReturnWarehouseStatus(ids, 1)
    ElMessage.success(`已成功发送 ${ids.length} 条退货单到仓库`)
    loadData()
  } catch {}
}

/** 批量撤销发送：勾选的退货单 warehouse_status 1→0 */
async function handleBatchCancelSend() {
  const idField = scene.value.idField || 'id'
  const ids = selectedRows.value.map((row) => row[idField])
  const invalidIds = selectedRows.value
    .filter((row) => Number(row.can_cancel_send || 0) !== 1)
    .map((row) => row.return_no || row[idField])
  if (invalidIds.length > 0) {
    ElMessage.warning(`以下退货单无法撤销发送（仓库已处理或状态不符）：${invalidIds.join('、')}`)
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认撤销 ${ids.length} 条退货单的发送仓库操作？仅当仓库尚未处理时可用。`,
      '批量撤销发送',
      { confirmButtonText: '确认撤销', type: 'warning' }
    )
    await cancelSendPurchaseReturn(ids)
    ElMessage.success(`已成功撤销 ${ids.length} 条退货单的发送`)
    loadData()
  } catch {}
}

async function handleRowCommand(command: string, row: Record<string, any>) {
  const bizId = scene.value.idField ? row[scene.value.idField] : row.id
  const warehouseStatus = Number(row.warehouse_status || 0)
  const canCancelSend = Number(row.can_cancel_send || 0) === 1
  try {
    // 确认入库（发送仓库）：入库单 warehouse_status 0→1
    if (command === 'confirmInbound') {
      if (warehouseStatus !== 0) {
        ElMessage.warning('当前入库单状态不允许确认入库')
        return
      }
      await ElMessageBox.confirm(`确认将入库单 ${row.receipt_no || bizId} 发送仓库？此操作将同步更新仓库库存。`, '确认入库', {
        confirmButtonText: '确认入库',
        type: 'warning'
      })
      await updatePurchaseInboundWarehouseStatus([bizId], 1)
      ElMessage.success('入库成功')
      loadData()
      return
    }
    // 确认出库（发送仓库）：退货单 warehouse_status 0→1
    if (command === 'confirmReturn') {
      await ElMessageBox.confirm(`确认将退货单 ${row.return_no || bizId} 发送仓库？`, '确认出库', {
        confirmButtonText: '确认出库',
        type: 'warning'
      })
      await updatePurchaseReturnWarehouseStatus([bizId], 1)
      ElMessage.success('出库成功')
      loadData()
      return
    }
    // 仓库退回：拉取明细 → 弹窗选择 → 调用退回接口（创建异常单）
    if (command === 'warehouseReturn') {
      if (props.type === 'inbound' && warehouseStatus === 0) {
        ElMessage.warning('仓库尚未处理，请先确认入库；若需撤销发送，请使用撤销发送')
        return
      }
      const isReturn = props.type === 'return'
      // 入库/退货详情后端均返回裸对象，直接使用 res.data
      const detail = isReturn
        ? (await getPurchaseReturnDetail(bizId)).data
        : (await getPurchaseInboundDetail(bizId)).data
      const items = detail?.items ?? []
      if (items.length === 0) {
        ElMessage.warning('该单据暂无明细，无法仓库退回')
        return
      }
      returnDialog.title = `仓库退回 - ${isReturn ? row.return_no : row.receipt_no}`
      returnDialog.bizType = isReturn ? 'return' : 'inbound'
      returnDialog.bizId = bizId
      returnDialog.items = items
      returnDialog.visible = true
      return
    }
    // 撤销发送：仓库未操作时 warehouse_status 1→0（不建异常单）
    if (command === 'cancelSend') {
      if (props.type === 'inbound' && !canCancelSend) {
        ElMessage.warning('仓库已处理，无法撤销发送，请使用仓库退回')
        return
      }
      const isReturn = props.type === 'return'
      const label = isReturn ? '退货单' : '入库单'
      const no = isReturn ? row.return_no : row.receipt_no
      await ElMessageBox.confirm(`确认撤销 ${label} ${no} 的发送仓库操作？仅当仓库尚未处理时可用。`, '撤销发送', {
        confirmButtonText: '确认撤销',
        type: 'warning'
      })
      if (isReturn) {
        await cancelSendPurchaseReturn([bizId])
      } else {
        await cancelSendPurchaseInbound([bizId])
      }
      ElMessage.success('撤销发送成功')
      loadData()
      return
    }
    // 确认采购状态：采购订单 purchase_status 0→1
    if (command === 'confirmPurchaseStatus') {
      if (Number(row.purchase_status || 0) !== 0) {
        ElMessage.warning('当前订单已标记为已采购')
        return
      }
      await ElMessageBox.confirm(
        `确认将采购订单 ${row.order_no || bizId} 标记为已采购？`,
        '确认采购',
        { confirmButtonText: '确认采购', type: 'warning' }
      )
      await updatePurchaseOrderStatus([bizId])
      ElMessage.success('确认采购状态成功')
      loadData()
      return
    }
    // 重置创建（采购退货单）：拉取源单详情预填，跳转新增页；保存成功后源单标记为已重置
    if (command === 'recreate') {
      const auditStatus = Number(row.audit_status ?? 0)
      if (auditStatus !== 2 && auditStatus !== 3) {
        ElMessage.warning('仅已反审核或审核失败的退货单允许重置创建')
        return
      }
      if (Number(row.is_recreated || 0) === 1) {
        ElMessage.warning('该退货单已被重新创建过，不可再次重置创建')
        return
      }
      await ElMessageBox.confirm(
        `确认基于退货单 ${row.return_no || bizId} 重置创建新退货单？将携带源单数据进入新增页。`,
        '重置创建',
        { confirmButtonText: '重置创建', type: 'warning' }
      )
      // 拉取源单完整详情（含明细/图片/附件），供新增页预填
      const detail = (await getPurchaseReturnDetail(bizId)).data as any
      sessionStorage.setItem(`presetData:${scene.value.addType}`, JSON.stringify({
        __recreateSource: {
          source_doc_id: bizId,
          source_doc_type: 'purchase_return',
          source_return_no: detail?.return_no || row.return_no || ''
        },
        supplier_id: detail?.supplier_id || '',
        supplier_id_label: detail?.supplier_name || '',
        payment_method: detail?.payment_method_display || detail?.payment_method || '',
        return_address: detail?.return_address || '',
        remark: detail?.remark || '',
        // 说明：退款信息（is_refund_prepayment/refund_prepayment_amount/is_refund_gift_amount/refund_gift_amount）
        // 已随后端改造从前端表单移除（改由退货明细与其他付款单侧管理），此处不再预填。
        items: (detail?.items || []).map((it: any) => ({
          purchase_order_item_id: it.purchase_order_item_id,
          purchase_order_id: it.purchase_order_id || detail?.purchase_order_id || '',
          purchase_order_no: it.purchase_order_no || detail?.purchase_order_no || '',
          product_id: it.product_id || '',
          product_code: it.product_code || '',
          product_name: it.product_name || '',
          category_name: it.category_name || '',
          specification: it.specification || '',
          color: it.color || '',
          unit_name: it.unit_name || '',
          purchase_price: it.purchase_price || '',
          return_price: it.return_price || '',
          return_qty: it.return_qty ?? it.planned_return_qty ?? '',
          remark: it.remark || ''
        }))
      }))
      router.push({ path: '/common/add', query: { type: scene.value.addType, recreate: '1' } })
      return
    }
    ElMessage.success('操作成功')
    loadData()
  } catch {}
}

/** 仓库退回弹窗确认回调 */
async function handleWarehouseReturnConfirm(payload: {
  items: Array<{ itemKey: string; return_qty: number; remark?: string }>
  remaining_qty_handle_mode: 0 | 1
  return_remark?: string
}) {
  const isReturn = returnDialog.bizType === 'return'
  const idField = isReturn ? 'purchase_return_item_id' : 'purchase_receipt_item_id'
  const apiItems = payload.items.map((it) => ({
    [idField]: it.itemKey,
    return_qty: it.return_qty,
    remark: it.remark
  }))
  try {
    if (isReturn) {
      await warehouseReturnPurchaseReturn(
        returnDialog.bizId,
        apiItems as any,
        payload.remaining_qty_handle_mode,
        payload.return_remark
      )
    } else {
      await warehouseReturnPurchaseInbound(
        returnDialog.bizId,
        apiItems as any,
        payload.remaining_qty_handle_mode,
        payload.return_remark
      )
    }
    ElMessage.success('仓库退回成功')
    loadData()
  } catch {
    ElMessage.error('仓库退回失败')
  }
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function getTagType(value: any, key?: string) {
  const str = String(value)
  if (key === 'warehouse_status') {
    if (str === '0') return 'info'
    if (str === '1' || str === '3') return 'success'
    if (str === '2') return 'warning'
  }
  if (['正常', '已审核', '已入库', '已出库', '已发货', '已发送', '1', '启用'].includes(str)) return 'success'
  if (['停用', '未审核', '未入库', '待入库', '未出库', '待出库', '未发货', '未发送', '0'].includes(str)) return 'info'
  if (['反审核', '审核失败', '2', '3'].includes(str)) return 'danger'
  return 'warning'
}

/** 判断单元格值是否为空（0 不算空） */
function isEmpty(value: any): boolean {
  return value === null || value === undefined || value === ''
}

/** 格式化 tag 单元格：有 enum 映射则转换，否则原样返回 */
function formatCell(value: any, enumMap?: Record<string, string>): string {
  if (isEmpty(value)) return '-'
  if (enumMap) {
    return enumMap[String(value)] ?? String(value)
  }
  return String(value)
}

function formatDisplayValue(key: string, value: any): string {
  if (isEmpty(value)) return '-'
  if (isTableDateField(key)) return formatTableDate(value)
  return String(value)
}

function resolveColumnMinWidth(column: ColumnConfig, rows: Record<string, any>[]): string | number | undefined {
  if (!isIdentifierColumn(column) && column.width !== undefined && column.width !== null) {
    return undefined
  }

  const autoWidth = calcAutoColumnMinWidth(column, rows)
  if (column.minWidth !== undefined && column.minWidth !== null) {
    return Math.max(normalizeWidthValue(column.minWidth), autoWidth)
  }
  if (isIdentifierColumn(column) && column.width !== undefined && column.width !== null) {
    return Math.max(normalizeWidthValue(column.width), autoWidth)
  }
  return autoWidth
}

function calcAutoColumnMinWidth(column: ColumnConfig, rows: Record<string, any>[]): number {
  const sampleRows = rows.slice(0, CONTENT_SAMPLE_LIMIT)
  const headerWidth = estimateTextWidth(column.label)
  const contentWidth = sampleRows.reduce((maxWidth, row) => {
    const displayValue = getColumnDisplayValue(column, row)
    return Math.max(maxWidth, estimateTextWidth(displayValue))
  }, 0)
  const targetWidth = Math.max(headerWidth, contentWidth, AUTO_COLUMN_MIN_WIDTH - CELL_HORIZONTAL_PADDING)
  return Math.min(getColumnMaxWidth(column), targetWidth + CELL_HORIZONTAL_PADDING)
}

function normalizeWidthValue(value: string | number): number {
  if (typeof value === 'number') return value
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : AUTO_COLUMN_MIN_WIDTH
}

function resolveColumnWidth(column: ColumnConfig): string | number | undefined {
  if (isIdentifierColumn(column)) return undefined
  return column.width
}

function isIdentifierColumn(column: Pick<ColumnConfig, 'key' | 'label'>): boolean {
  return isIdentifierField(column.key, column.label)
}

function isIdentifierField(key?: string, label?: string): boolean {
  const fieldKey = key || ''
  const fieldLabel = label || ''
  return /(?:^|_)(id|code|no)$/i.test(fieldKey)
    || /(?:Id|Code|No)$/.test(fieldKey)
    || /(编码|编号|ID|Id|id)/.test(fieldLabel)
}

function getColumnMaxWidth(column: Pick<ColumnConfig, 'key' | 'label'>): number {
  return isIdentifierField(column.key, column.label) ? 560 : MAX_AUTO_COLUMN_MIN_WIDTH
}

function getColumnDisplayValue(column: ColumnConfig, row: Record<string, any>): string {
  if (column.tag) return formatCell(row[column.key], column.enum)
  if (column.money) return formatMoney(row[column.key])
  return formatDisplayValue(column.key, row[column.key])
}

function estimateTextWidth(text: string): number {
  return Array.from(text).reduce((total, char) => total + getCharacterWidth(char), 0)
}

function getCharacterWidth(char: string): number {
  if (/[\u3400-\u9FFF\uF900-\uFAFF]/.test(char)) return 14
  if (/[A-Z]/.test(char)) return 9
  if (/[a-z0-9]/.test(char)) return 8
  if (/\s/.test(char)) return 4
  return 7
}

const purchaseOrderSearchSchema = z.object({
  orderNo: z.string().trim().optional(),
  supplierName: z.string().trim().optional(),
  productName: z.string().trim().optional(),
  auditStatus: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  createdStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  createdEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().positive().optional(),
})

const supplierSearchSchema = z.object({
  supplierName: z.string().trim().optional(),
  supplierCode: z.string().trim().optional(),
  status: z.union([z.literal(0), z.literal(1)]).optional(),
  page: z.number().int().positive().optional(),
})

const purchaseInboundSearchSchema = z.object({
  receiptNo: z.string().trim().optional(),
  supplierName: z.string().trim().optional(),
  warehouseStatus: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  createdStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  createdEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().positive().optional(),
})

const purchaseReturnSearchSchema = z.object({
  returnNo: z.string().trim().optional(),
  supplierName: z.string().trim().optional(),
  warehouseStatus: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  createdStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  createdEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().positive().optional(),
})

const purchaseInboundDetailSearchSchema = z.object({
  receiptNo: z.string().trim().optional(),
  supplierName: z.string().trim().optional(),
  productName: z.string().trim().optional(),
  warehouseStatus: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  receiptStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  receiptEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().positive().optional(),
})

const supplierBalanceSearchSchema = z.object({
  supplierName: z.string().trim().optional(),
  areaName: z.string().trim().optional(),
  purchaserName: z.string().trim().optional(),
  page: z.number().int().positive().optional(),
})

function markdownCell(value: unknown): string {
  const text = String(value ?? '-').trim() || '-'
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

const supplierSearchAction = {
  id: 'supplier.search',
  title: '查询供应商档案',
  description: '按供应商名称、编码和状态查询供应商档案。',
  inputSchema: supplierSearchSchema,
  inputGuide: 'supplierName?: string, supplierCode?: string, status?: 0|1, page?: positive integer',
  risk: 'read',
  confirmation: 'none',
  execute: async (input, context) => {
    context.signal.throwIfAborted()
    Object.assign(searchForm, {
      supplier_name: input.supplierName ?? '',
      supplier_code: input.supplierCode ?? '',
      status: input.status ?? '',
    })
    pagination.page = input.page ?? 1
    const total = await loadData(context.signal)
    return { total, visible: tableData.value.length, suppliers: tableData.value.slice(0, 3) }
  },
  summarizeResult: ({ total, visible, suppliers }) => [
    `供应商查询完成，共 **${total}** 条，当前页显示 **${visible}** 条。`,
    '',
    '| 供应商编码 | 供应商名称 | 类型 | 联系人 | 状态 |',
    '| --- | --- | --- | --- | --- |',
    ...suppliers.map((supplier) =>
      `| ${markdownCell(supplier.supplier_code)} | ${markdownCell(supplier.supplier_name)} | ${markdownCell(supplier.supplier_type_name)} | ${markdownCell(supplier.business_contact || supplier.contact_phone || supplier.phone1)} | ${Number(supplier.status) === 1 ? '启用' : '停用'} |`,
    ),
  ].join('\n'),
} satisfies WmsAgentActionDefinition<
  z.infer<typeof supplierSearchSchema>,
  { total: number; visible: number; suppliers: Record<string, any>[] }
>

const purchaseInboundSearchAction = {
  id: 'purchase-inbound.search',
  title: '查询采购入库单',
  description: '按入库单号、供应商、入库状态和创建日期查询采购入库单。',
  inputSchema: purchaseInboundSearchSchema,
  inputGuide: 'receiptNo?: string, supplierName?: string, warehouseStatus?: 0|1|2|3, createdStart?: YYYY-MM-DD, createdEnd?: YYYY-MM-DD, page?: positive integer',
  risk: 'read',
  confirmation: 'none',
  execute: async (input, context) => {
    context.signal.throwIfAborted()
    Object.assign(searchForm, {
      receipt_no: input.receiptNo ?? '',
      supplier_name: input.supplierName ?? '',
      warehouse_status: input.warehouseStatus ?? '',
      created_at: input.createdStart || input.createdEnd
        ? [input.createdStart ?? '', input.createdEnd ?? '']
        : null,
    })
    pagination.page = input.page ?? 1
    const total = await loadData(context.signal)
    return { total, visible: tableData.value.length, receipts: tableData.value.slice(0, 3) }
  },
  summarizeResult: ({ total, visible, receipts }) => [
    `采购入库单查询完成，共 **${total}** 条，当前页显示 **${visible}** 条。`,
    '',
    '| 入库单号 | 供应商 | 入库状态 | 创建人 | 创建时间 |',
    '| --- | --- | --- | --- | --- |',
    ...receipts.map((receipt) =>
      `| ${markdownCell(receipt.receipt_no)} | ${markdownCell(receipt.supplier_name)} | ${markdownCell(inboundWarehouseStatusEnum[String(receipt.warehouse_status)] || receipt.warehouse_status_name)} | ${markdownCell(receipt.created_by_name)} | ${markdownCell(receipt.created_at)} |`,
    ),
  ].join('\n'),
} satisfies WmsAgentActionDefinition<
  z.infer<typeof purchaseInboundSearchSchema>,
  { total: number; visible: number; receipts: Record<string, any>[] }
>

const purchaseReturnSearchAction = {
  id: 'purchase-return.search',
  title: '查询采购退货单',
  description: '按退货单号、供应商、出库状态和创建日期查询采购退货单。',
  inputSchema: purchaseReturnSearchSchema,
  inputGuide: 'returnNo?: string, supplierName?: string, warehouseStatus?: 0|1, createdStart?: YYYY-MM-DD, createdEnd?: YYYY-MM-DD, page?: positive integer',
  risk: 'read',
  confirmation: 'none',
  execute: async (input, context) => {
    context.signal.throwIfAborted()
    Object.assign(searchForm, {
      return_no: input.returnNo ?? '',
      supplier_name: input.supplierName ?? '',
      warehouse_status: input.warehouseStatus ?? '',
      created_at: input.createdStart || input.createdEnd
        ? [input.createdStart ?? '', input.createdEnd ?? '']
        : null,
    })
    pagination.page = input.page ?? 1
    const total = await loadData(context.signal)
    return {
      total,
      visible: tableData.value.length,
      purchaseReturns: tableData.value.slice(0, 3),
      queryStart: input.createdStart,
      queryEnd: input.createdEnd,
    }
  },
  summarizeResult: ({ total, visible, purchaseReturns, queryStart, queryEnd }) => {
    if (total === 0 && (queryStart || queryEnd)) {
      const start = queryStart ?? queryEnd
      const end = queryEnd ?? queryStart
      return [
        `采购退货单查询完成，查询时间范围为 **${start} 至 ${end}**。`,
        '',
        '**该时间范围内暂无采购退货单。** 页面表格为空是因为没有符合时间条件的数据，并非加载失败。',
      ].join('\n')
    }
    if (total === 0) {
      return '采购退货单查询完成，当前暂无采购退货单。'
    }
    return [
      `采购退货单查询完成，共 **${total}** 条，当前页显示 **${visible}** 条。`,
      '',
      '| 退货单号 | 供应商 | 退货金额 | 出库状态 | 创建时间 |',
      '| --- | --- | --- | --- | --- |',
      ...purchaseReturns.map((purchaseReturn) =>
        `| ${markdownCell(purchaseReturn.return_no)} | ${markdownCell(purchaseReturn.supplier_name)} | ${markdownCell(purchaseReturn.return_amount)} | ${Number(purchaseReturn.warehouse_status) === 1 ? '已出库' : '待出库'} | ${markdownCell(purchaseReturn.created_at)} |`,
      ),
    ].join('\n')
  },
} satisfies WmsAgentActionDefinition<
  z.infer<typeof purchaseReturnSearchSchema>,
  {
    total: number
    visible: number
    purchaseReturns: Record<string, any>[]
    queryStart?: string
    queryEnd?: string
  }
>

const purchaseInboundDetailSearchAction = {
  id: 'purchase-inbound-detail.search',
  title: '查询采购入库商品明细',
  description: '按入库单号、供应商、产品、入库状态和正式入库日期查询采购入库商品明细。',
  inputSchema: purchaseInboundDetailSearchSchema,
  inputGuide: 'receiptNo?: string, supplierName?: string, productName?: string, warehouseStatus?: 0|1|2|3, receiptStart?: YYYY-MM-DD, receiptEnd?: YYYY-MM-DD, page?: positive integer',
  risk: 'read',
  confirmation: 'none',
  execute: async (input, context) => {
    context.signal.throwIfAborted()
    Object.assign(searchForm, {
      receipt_no: input.receiptNo ?? '',
      supplier_name: input.supplierName ?? '',
      product_name: input.productName ?? '',
      warehouse_status: input.warehouseStatus ?? '',
      formal_receipt_date: input.receiptStart || input.receiptEnd
        ? [input.receiptStart ?? '', input.receiptEnd ?? '']
        : null,
    })
    pagination.page = input.page ?? 1
    const total = await loadData(context.signal)
    return { total, visible: tableData.value.length, items: tableData.value.slice(0, 3) }
  },
  summarizeResult: ({ total, visible, items }) => [
    `采购入库商品明细查询完成，共 **${total}** 条，当前页显示 **${visible}** 条。`,
    '',
    '| 入库单号 | 供应商 | 商品 | 计划数量 | 实际入库 | 入库日期 |',
    '| --- | --- | --- | ---: | ---: | --- |',
    ...items.map((item) =>
      `| ${markdownCell(item.receipt_no)} | ${markdownCell(item.supplier_name)} | ${markdownCell(item.product_name)} | ${markdownCell(item.in_stock_qty)} | ${markdownCell(item.actual_in_stock_qty)} | ${markdownCell(item.formal_receipt_date)} |`,
    ),
  ].join('\n'),
} satisfies WmsAgentActionDefinition<
  z.infer<typeof purchaseInboundDetailSearchSchema>,
  { total: number; visible: number; items: Record<string, any>[] }
>

const supplierBalanceSearchAction = {
  id: 'supplier-balance.search',
  title: '查询供应商余额',
  description: '按供应商、所属地区和采购员查询供应商往来余额。',
  inputSchema: supplierBalanceSearchSchema,
  inputGuide: 'supplierName?: string, areaName?: string, purchaserName?: string, page?: positive integer',
  risk: 'read',
  confirmation: 'none',
  execute: async (input, context) => {
    context.signal.throwIfAborted()
    Object.assign(searchForm, {
      supplier_name: input.supplierName ?? '',
      area_name: input.areaName ?? '',
      purchaser_user_name: input.purchaserName ?? '',
    })
    pagination.page = input.page ?? 1
    const total = await loadData(context.signal)
    return { total, visible: tableData.value.length, suppliers: tableData.value.slice(0, 3) }
  },
  summarizeResult: ({ total, visible, suppliers }) => [
    `供应商余额查询完成，共 **${total}** 条，当前页显示 **${visible}** 条。`,
    '',
    '| 供应商 | 所属地区 | 当前余额 | 月结 | 采购员 |',
    '| --- | --- | ---: | --- | --- |',
    ...suppliers.map((supplier) =>
      `| ${markdownCell(supplier.supplier_name)} | ${markdownCell(supplier.area_name)} | ${markdownCell(supplier.balance)} | ${Number(supplier.is_monthly_settlement) === 1 ? '是' : '否'} | ${markdownCell(supplier.purchaser_user_name)} |`,
    ),
  ].join('\n'),
} satisfies WmsAgentActionDefinition<
  z.infer<typeof supplierBalanceSearchSchema>,
  { total: number; visible: number; suppliers: Record<string, any>[] }
>

const purchaseOrderSearchAction = {
  id: 'purchase-order.search',
  title: '查询采购订单',
  description: '按订单号、供应商、产品名称、审核状态和创建日期查询采购订单。',
  inputSchema: purchaseOrderSearchSchema,
  inputGuide:
    'orderNo?: string, supplierName?: string, productName?: string, auditStatus?: 0|1|2, createdStart?: YYYY-MM-DD, createdEnd?: YYYY-MM-DD, page?: positive integer',
  risk: 'read',
  confirmation: 'none',
  execute: async (input, context) => {
    context.signal.throwIfAborted()
    Object.assign(searchForm, {
      order_no: input.orderNo ?? '',
      supplier_name: input.supplierName ?? '',
      product_name: input.productName ?? '',
      is_audited: input.auditStatus ?? '',
      created_at:
        input.createdStart || input.createdEnd
          ? [input.createdStart ?? '', input.createdEnd ?? '']
          : null,
    })
    pagination.page = input.page ?? 1
    const total = await loadData(context.signal)
    return { total, visible: tableData.value.length }
  },
  summarizeResult: ({ total, visible }) =>
    `采购订单查询完成，共 ${total} 条，当前页显示 ${visible} 条。`,
} satisfies WmsAgentActionDefinition<
  z.infer<typeof purchaseOrderSearchSchema>,
  { total: number; visible: number }
>

if (props.type === 'order') {
  useAgentPage(
    {
      id: 'purchase.order.list',
      title: '采购订单',
      routePath: '/purchase/order',
      description: '采购订单列表与查询页面。',
      getContext: () => ({
        visibleOrders: tableData.value.slice(0, 10).map((row) => ({
          purchaseOrderId: row.purchase_order_id,
          orderNo: row.order_no,
          supplierName: row.supplier_name,
          orderDate: row.order_date,
          auditStatus: row.is_audited,
        })),
      }),
    },
    [purchaseOrderSearchAction],
  )
}

if (props.type === 'supplier') {
  useAgentPage(
    {
      id: 'purchase.supplier.list',
      title: '供应商档案',
      routePath: '/purchase/supplier',
      description: '供应商编码、名称、类型、联系人和状态查询页面。',
      getContext: () => ({
        visibleSuppliers: tableData.value.slice(0, 10).map((supplier) => ({
          supplierId: supplier.supplier_id,
          supplierCode: supplier.supplier_code,
          supplierName: supplier.supplier_name,
          status: supplier.status,
        })),
      }),
    },
    [supplierSearchAction],
  )
}

if (props.type === 'inbound') {
  useAgentPage(
    {
      id: 'purchase.inbound.list',
      title: '采购入库单',
      routePath: '/purchase/inbound',
      description: '采购入库单号、供应商、入库状态和创建时间查询页面。',
      getContext: () => ({
        visibleReceipts: tableData.value.slice(0, 10).map((receipt) => ({
          purchaseReceiptId: receipt.purchase_receipt_id,
          receiptNo: receipt.receipt_no,
          supplierName: receipt.supplier_name,
          warehouseStatus: receipt.warehouse_status,
        })),
      }),
    },
    [purchaseInboundSearchAction],
  )
}

if (props.type === 'return') {
  useAgentPage(
    {
      id: 'purchase.return.list',
      title: '采购退货单',
      routePath: '/purchase/return',
      description: '采购退货单号、供应商、出库状态和创建时间查询页面。',
      getContext: () => ({
        visibleReturns: tableData.value.slice(0, 10).map((purchaseReturn) => ({
          purchaseReturnId: purchaseReturn.purchase_return_id,
          returnNo: purchaseReturn.return_no,
          supplierName: purchaseReturn.supplier_name,
          warehouseStatus: purchaseReturn.warehouse_status,
        })),
      }),
    },
    [purchaseReturnSearchAction],
  )
}

if (props.type === 'inboundDetail') {
  useAgentPage(
    {
      id: 'purchase.inbound-detail.list',
      title: '采购入库单明细',
      routePath: '/purchase/report/inbound-detail',
      description: '逐行查询采购入库商品、数量、供应商、状态和正式入库日期。',
      getContext: () => ({
        visibleItems: tableData.value.slice(0, 10).map((item) => ({
          purchaseReceiptItemId: item.purchase_receipt_item_id,
          receiptNo: item.receipt_no,
          supplierName: item.supplier_name,
          productName: item.product_name,
          actualInStockQuantity: item.actual_in_stock_qty,
        })),
      }),
    },
    [purchaseInboundDetailSearchAction],
  )
}

if (props.type === 'supplierBalance') {
  useAgentPage(
    {
      id: 'purchase.supplier-balance.list',
      title: '供应商余额表',
      routePath: '/purchase/report/supplier-balance',
      description: '按供应商、地区和采购员查询供应商往来余额。',
      getContext: () => ({
        visibleSuppliers: tableData.value.slice(0, 10).map((supplier) => ({
          supplierId: supplier.supplier_id,
          supplierName: supplier.supplier_name,
          balance: supplier.balance,
          purchaserName: supplier.purchaser_user_name,
        })),
      }),
    },
    [supplierBalanceSearchAction],
  )
}

onMounted(() => {
  initSearchForm()
  loadData()
})
</script>

<style scoped>
.table-cell-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
.row-actions :deep(.cell),
:deep(.el-table td.el-table__cell .cell) {
  white-space: nowrap;
}
.cell-empty { color: var(--text-tertiary); }
/* 操作列按钮垂直居中对齐：编辑/删除与“更多”下拉持平，间距统一 */
.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.row-actions :deep(.el-button) {
  margin-left: 0;          /* 覆盖 el-button 默认相邻 margin，改由 gap 统一控制 */
}
.row-actions :deep(.el-dropdown) {
  display: inline-flex;
  align-items: center;
}
.row-actions :deep(.el-dropdown + .el-button),
.row-actions :deep(.el-button + .el-dropdown) {
  margin-left: 0;
}
</style>
